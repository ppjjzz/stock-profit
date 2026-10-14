'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { LoaderCircle, Sparkles, Square, RotateCcw } from 'lucide-react';
import type { Settings } from '@/lib/backtest';
import { readAnalysisStream, type AnalysisEvent } from '@/lib/agent-analysis';
import { AnalysisMarkdown } from '@/components/analysis-markdown';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';

type Block = { key: string; section: 'answer' | 'process' | 'think'; text: string };
type State = 'running' | 'succeeded' | 'failed' | 'stopped' | 'interrupted';
export function HoldingAnalysisDialog({ settings, onClose }: { settings: Settings; onClose: () => void }) {
  const [state, setState] = useState<State>('running');
  const [status, setStatus] = useState('正在连接长桥 Agent…');
  const [history, setHistory] = useState<string[]>([]);
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [result, setResult] = useState<Extract<AnalysisEvent, { type: 'result' }> | null>(null);
  const [error, setError] = useState('');
  const activeRequest = useRef<AbortController | null>(null);
  const startTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scrollArea = useRef<HTMLDivElement>(null);
  const follow = useRef(true);
  useEffect(() => {
    const area = scrollArea.current;
    if (area && follow.current) area.scrollTop = area.scrollHeight;
  }, [blocks, history, result]);

  function stop() {
    if (startTimer.current !== null) clearTimeout(startTimer.current);
    activeRequest.current?.abort(); activeRequest.current = null;
    setState('stopped'); setStatus('已停止接收分析');
  }
  function close() { if (startTimer.current !== null) clearTimeout(startTimer.current); activeRequest.current?.abort(); onClose(); }
  const analyze = useCallback(async () => {
    if (activeRequest.current) return;
    const controller = new AbortController(); activeRequest.current = controller;
    setState('running'); setStatus('正在连接长桥 Agent…'); setHistory([]); setBlocks([]); setResult(null); setError(''); follow.current = true;
    let terminal = false;
    try {
      const response = await fetch('/api/holding-analysis', { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' }, body: JSON.stringify({ settings }), signal: controller.signal });
      if (!response.ok) { const data = await response.json(); throw new Error(data.error || '分析请求失败'); }
      if (!response.body || !response.headers.get('content-type')?.includes('text/event-stream')) throw new Error('分析服务未返回实时数据流');
      await readAnalysisStream(response.body, event => {
        if (controller.signal.aborted || terminal) return;
        if (event.type === 'status') {
          setStatus(event.text);
          setHistory(items => items.at(-1) === event.text ? items : [...items.slice(-99), event.text]);
        } else if (event.type === 'delta') {
          if (!event.text) return;
          setBlocks(items => {
            const index = items.findIndex(b => b.key === event.key && b.section === event.section);
            if (index === -1) return [...items, { key: event.key, section: event.section, text: event.text }];
            return items.map((b, i) => i === index ? { ...b, text: b.text + event.text } : b);
          });
        } else if (event.type === 'result') {
          terminal = true; setResult(event); setState(event.status);
          setStatus({ succeeded: '分析完成', interrupted: 'Agent 需要补充信息', failed: '分析失败', stopped: 'Agent 已停止分析' }[event.status]);
          if (event.status === 'failed') setError(event.error || 'Agent 分析失败，请重试');
        } else if (event.type === 'error') { throw new Error(event.text); }
      });
      if (!terminal && !controller.signal.aborted) throw new Error('分析连接意外中断，已保留收到的内容，请重试。');
    } catch (error) {
      if (!controller.signal.aborted) { setState('failed'); setStatus('分析失败'); setError(error instanceof Error ? error.message : '分析请求失败'); }
    } finally { if (activeRequest.current === controller) activeRequest.current = null; }
  }, [settings]);
  useEffect(() => {
    // Defer until after the effect setup: Strict Mode cleanup cancels the
    // first timer before it can create an extra upstream conversation.
    const timer = setTimeout(() => void analyze(), 0);
    startTimer.current = timer;
    return () => { clearTimeout(timer); activeRequest.current?.abort(); activeRequest.current = null; };
  }, [analyze]);
  const running = state === 'running';
  const processBlocks = blocks.filter(b => b.section !== 'answer');
  const answer = result?.answer || blocks.filter(b => b.section === 'answer').map(b => b.text).join('');
  return <Dialog open onOpenChange={open => { if (!open) close(); }}><DialogContent className="stock-dialog analysis-dialog sm:max-w-[760px]">
    <DialogHeader><div className="dialog-eyebrow"><Sparkles size={15}/> AI PORTFOLIO ANALYSIS</div><DialogTitle>AI 持仓分析</DialogTitle><DialogDescription>将本次打开时的回测配置发送给长桥 Agent，实时展示分析进度与结果。</DialogDescription></DialogHeader>
    <div className="analysis-config">{settings.symbols.join(' · ')}<span>{settings.start} 至 {settings.end} · {settings.positions.length} 项初始持仓 · {settings.plans.length} 条定投</span></div>
    <div className="analysis-status" role="status" aria-live="polite">{running ? <LoaderCircle size={16} className="spin"/> : <Sparkles size={16}/>}<span>{status}</span></div>
    <div className="analysis-scroll" ref={scrollArea} onScroll={e => { const area = e.currentTarget; follow.current = area.scrollHeight - area.scrollTop - area.clientHeight < 60; }}>
      {history.length ? <details className="analysis-progress"><summary>分析进度</summary><ol>{history.map((text, i) => <li key={i}>{text}</li>)}</ol></details> : null}
      {processBlocks.length ? <details className="analysis-thinking"><summary>思考过程</summary>{processBlocks.map(b => <AnalysisMarkdown key={`${b.section}:${b.key}`} text={b.text}/>)}</details> : null}
      {answer ? <div className="analysis-answer"><h3>分析结果</h3><AnalysisMarkdown text={answer}/></div> : <p className="analysis-placeholder">{running ? '正在等待 Agent 返回分析内容…' : '暂无分析结果，可重新分析。'}</p>}
      {result?.questions.length ? <div className="analysis-questions"><strong>Agent 请求补充信息</strong>{result.questions.map((q, i) => <p key={i}>{q}</p>)}<p>本次分析已暂停，可调整回测配置后重新分析。</p></div> : null}
      {error ? <p className="error-text" role="alert">{error}</p> : null}
      {result?.references.length ? <div className="analysis-sources"><h3>参考来源</h3>{result.references.map((r, i) => <a key={i} href={r.url} target="_blank" rel="noopener noreferrer">{i + 1}. {r.title || r.url}</a>)}</div> : null}
    </div>
    <DialogFooter><Button variant="outline" onClick={close}>关闭</Button>{running ? <Button variant="outline" onClick={stop}><Square size={14}/>停止接收</Button> : <Button onClick={() => void analyze()}><RotateCcw size={14}/>重新分析</Button>}</DialogFooter>
  </DialogContent></Dialog>;
}
