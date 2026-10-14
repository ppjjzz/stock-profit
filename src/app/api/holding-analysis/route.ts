import { NextResponse } from 'next/server';
import { validateSettings } from '@/lib/backtest';
import { analysisProgress, analysisQuery, analysisResult, type AnalysisEvent } from '@/lib/agent-analysis';
import { agentApiError, getAgentContext } from '@/lib/longbridge-agent';

export const runtime = 'nodejs';
export const maxDuration = 300;
export async function POST(request: Request) {
  let settings;
  try {
    const input = await request.json();
    settings = validateSettings(input.settings);
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : '分析参数无效' }, { status: 400 }); }
  let context;
  try { context = getAgentContext(); }
  catch (error) { return NextResponse.json({ error: agentApiError(error) }, { status: 503 }); }
  const query = analysisQuery(settings);
  const encoder = new TextEncoder();
  let closed = false;
  let cleanup = () => {};
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const send = (event: AnalysisEvent) => {
        if (!closed) controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      };
      const close = () => {
        if (closed) return;
        closed = true; cleanup(); controller.close();
      };
      const heartbeat = setInterval(() => { if (!closed) controller.enqueue(encoder.encode(': ping\n\n')); }, 15000);
      const timeout = setTimeout(() => { send({ type: 'error', text: '分析超时，请稍后重试。' }); close(); }, 290000);
      cleanup = () => { clearInterval(heartbeat); clearTimeout(timeout); request.signal.removeEventListener('abort', close); };
      request.signal.addEventListener('abort', close, { once: true });
      if (request.signal.aborted) { close(); return; }
      send({ type: 'status', text: '正在连接长桥 Agent…' });
      // The SDK consumes upstream SSE and calls back once per event.
      // It has no cancellation API; after disconnect, ignore late callbacks.
      void context.conversationStreamed('chatbot', query, undefined, undefined, (error, event) => {
        if (closed) return;
        if (error) { send({ type: 'error', text: agentApiError(error) }); close(); return; }
        const progress = analysisProgress(event);
        if (progress) send(progress);
      }).then(result => { send(analysisResult(result)); close(); }).catch(error => { send({ type: 'error', text: agentApiError(error) }); close(); });
    },
    cancel() { closed = true; cleanup(); },
  });
  return new Response(stream, { headers: { 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-cache, no-transform', 'X-Accel-Buffering': 'no' } });
}
