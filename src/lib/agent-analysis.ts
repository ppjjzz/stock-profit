import type { ConversationResponse, ConversationStreamEvent } from 'longbridge';
import type { Settings } from './backtest';

export type AnalysisEvent =
  | { type: 'status'; text: string }
  | { type: 'delta'; key: string; section: 'answer' | 'process' | 'think'; text: string }
  | { type: 'result'; status: 'succeeded' | 'interrupted' | 'failed' | 'stopped'; answer: string; questions: string[]; references: { title: string; url: string }[]; error?: string }
  | { type: 'error'; text: string };

export function analysisQuery(settings: Settings) {
  // Explicitly pick fields: never forward arbitrary client data to the Agent.
  const config = {
    symbols: settings.symbols,
    positions: settings.positions.map(p => ({ symbol: p.symbol, inputMode: p.inputMode, value: p.value })),
    plans: settings.plans.map(p => ({ symbol: p.symbol, amount: p.amount, frequency: p.frequency, weekday: p.weekday, monthDay: p.monthDay })),
    start: settings.start, end: settings.end,
  };
  return `请用中文分析以下用户配置的模拟持仓及回测策略，包括组合集中度、行业和市场风险、定投安排与可改进之处。这里只提供配置，未提供回测结果，不要编造收益、回撤或历史表现。请以配置风险分析为主，无需重新执行回测或计算历史相关性，控制篇幅在1200字以内。可查询必要的行情和公司资料，并注明数据日期与来源。只分析此模拟组合，不要读取用户真实账户持仓或执行交易。回测采用前复权收盘价，允许小数份额，未单独核算现金分红、税费、手续费或红利再投；按股数配置的是复权份额。请给出清晰的分析结论。\n回测配置（JSON）：\n${JSON.stringify(config, null, 2)}`;
}

export function analysisResult(result: ConversationResponse): AnalysisEvent {
  return {
    type: 'result', status: (['succeeded', 'interrupted', 'failed', 'stopped'] as const)[result.status] ?? 'failed',
    answer: result.answer || '', error: result.error?.message,
    questions: result.interrupt?.questions.map(q => q.question) || [],
    references: (result.references || []).filter(r => /^https?:\/\//i.test(r.url)).map(r => ({ title: r.title, url: r.url })),
  };
}

export function analysisProgress(event: ConversationStreamEvent): AnalysisEvent | null {
  if (event.kind === 'message' && event.message) {
    const m = event.message;
    return { type: 'delta', key: m.key || m.messageType || 'answer', section: m.messageType === 'think' ? 'think' : m.messageType === 'process' ? 'process' : 'answer', text: m.text };
  }
  const tool = event.nodeToolUseStarted || event.nodeToolUseFinished;
  if (tool) return { type: 'status', text: tool.tips || `${tool.toolName || '工具'}${event.kind.endsWith('finished') ? '已完成' : '执行中…'}` };
  const labels: Record<string, string> = {
    chat_started: '已连接长桥 Agent', workflow_started: '开始分析回测配置…',
    thinking_started: 'Agent 正在分析持仓…', thinking_finished: '持仓分析完成，正在整理回答…',
    subagent_started: '正在进行专项分析…', subagent_finished: '专项分析完成',
    agent_tool_started: '正在调用分析工具…', agent_tool_finished: '分析工具已返回',
    context_compress_started: '正在整理分析上下文…', context_compress_finished: '分析上下文已整理',
  };
  return labels[event.kind] ? { type: 'status', text: labels[event.kind] } : null;
}

// Fetch POST supports request bodies; EventSource only supports GET.
// Parse SSE incrementally, including split UTF-8, CR/LF and multi-line data.
export async function readAnalysisStream(body: ReadableStream<Uint8Array>, onEvent: (event: AnalysisEvent) => void) {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '', data: string[] = [];
  const line = (value: string) => {
    if (!value) {
      if (data.length) onEvent(JSON.parse(data.join('\n')) as AnalysisEvent);
      data = [];
    } else if (value.startsWith('data:')) data.push(value.slice(5).replace(/^ /, ''));
  };
  const drain = (final: boolean) => {
    let index: number;
    while ((index = buffer.search(/[\r\n]/)) !== -1) {
      if (!final && buffer[index] === '\r' && index === buffer.length - 1) break;
      const length = buffer[index] === '\r' && buffer[index + 1] === '\n' ? 2 : 1;
      line(buffer.slice(0, index)); buffer = buffer.slice(index + length);
    }
  };
  try {
    while (true) {
      const { value, done } = await reader.read();
      buffer += done ? decoder.decode() : decoder.decode(value, { stream: true });
      drain(done);
      if (done) { if (buffer) line(buffer); line(''); break; }
    }
  } finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
}
