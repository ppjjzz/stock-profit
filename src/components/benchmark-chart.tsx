'use client';
import { useEffect, useMemo, useState } from 'react';
import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { ChartNoAxesCombined, LoaderCircle, RotateCcw } from 'lucide-react';
import { benchmarks, normalizeBenchmarks, type BenchmarkResult } from '@/lib/benchmarks';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
export function BenchmarkChart({start,end}:{start:string;end:string}) {
  const [data,setData]=useState<BenchmarkResult|null>(null), [loading,setLoading]=useState(true), [error,setError]=useState(''), [retry,setRetry]=useState(0);
  const [visible,setVisible]=useState<string[]>(benchmarks.map(b=>b.symbol));
  useEffect(()=>{
    const controller=new AbortController();
    const timer=setTimeout(async()=>{
      setLoading(true);setError('');
      try {
        const response=await fetch(`/api/benchmarks?start=${start}&end=${end}`,{signal:controller.signal});
        const json=await response.json();
        if(!response.ok)throw new Error(json.error||'指数行情请求失败');
        if(!controller.signal.aborted)setData(json);
      } catch(e) {if(!controller.signal.aborted){setData(null);setError(e instanceof Error?e.message:'指数行情请求失败');}}
      finally {if(!controller.signal.aborted)setLoading(false);}
    },400);
    return ()=>{clearTimeout(timer);controller.abort();};
  },[start,end,retry]);
  const current = data?.start===start&&data.end===end?data:null;
  const points=useMemo(()=>normalizeBenchmarks(current?.series||[]),[current]);
  const missing=current?.series.filter(s=>s.error)||[];
  return <section className="benchmark-panel panel"><div className="chart-header"><div><div className="eyebrow">MARKET BENCHMARKS</div><h2>同期指数走势 <Badge variant="secondary">区间涨跌幅</Badge></h2></div><Button variant="ghost" size="icon-sm" aria-label="刷新指数行情" onClick={()=>setRetry(r=>r+1)} disabled={loading}><RotateCcw size={15}/></Button></div>
    <div className="benchmark-legend">{benchmarks.map(b=>{const series=current?.series.find(s=>s.symbol===b.symbol);const last=series?.candles.at(-1);const first=series?.candles[0];const rate=last&&first?(last.close/first.close-1)*100:null;return <Button key={b.symbol} variant="outline" size="sm" aria-pressed={visible.includes(b.symbol)} className={visible.includes(b.symbol)?'index-label selected-index':'index-label'} onClick={()=>setVisible(v=>v.includes(b.symbol)?v.filter(s=>s!==b.symbol):[...v,b.symbol])}><i style={{background:b.color}}/><span>{b.name}</span><small>{loading||!current?'…':rate===null?'不可用':`${rate>=0?'+':''}${rate.toFixed(2)}%`}</small></Button>;})}</div>
    <div className="benchmark-stage">{loading||!current&&!error?<div className="benchmark-empty"><LoaderCircle className="spin" size={22}/><span>正在获取六大指数历史行情…</span></div>:error?<div className="benchmark-empty"><ChartNoAxesCombined size={28}/><span role="alert">{error}</span><Button size="sm" variant="outline" onClick={()=>setRetry(r=>r+1)}>重新加载</Button></div>:points.length?<ResponsiveContainer width="100%" height="100%"><LineChart data={points} margin={{top:20,right:20,bottom:5,left:0}}><CartesianGrid stroke="var(--chart-grid)" vertical={false} strokeDasharray="3 5"/><XAxis dataKey="date" minTickGap={65} tickFormatter={d=>d.slice(0,7)} tick={{fill:'var(--chart-axis)',fontSize:10}} tickLine={false} axisLine={false}/><YAxis tickFormatter={v=>`${v.toFixed(0)}%`} tick={{fill:'var(--chart-axis)',fontSize:10}} tickLine={false} axisLine={false} width={55}/><ReferenceLine y={0} stroke="var(--chart-axis)" strokeDasharray="5 5"/><Tooltip contentStyle={{background:'var(--popover)',border:'1px solid var(--control-border)',borderRadius:10,fontSize:11}} labelStyle={{color:'var(--foreground)'}} formatter={(v,name)=>[`${Number(v).toFixed(2)}%`,name]}/>{benchmarks.filter(b=>visible.includes(b.symbol)).map(b=><Line key={b.symbol} dataKey={p=>p[b.symbol]} name={b.name} stroke={b.color} type="monotone" dot={false} strokeWidth={2} isAnimationActive={false} connectNulls={false}/>)}</LineChart></ResponsiveContainer>:<div className="benchmark-empty"><ChartNoAxesCombined size={28}/><span>六个指数暂无可用行情</span></div>}</div>
    <div className="benchmark-footnote"><span>{start} — {end}</span><p>各指数以区间首个可用收盘价为 0%，休市日沿用上一收盘价；为价格指数走势，不含汇率换算或股息再投资。</p>{missing.map(s=><p key={s.symbol} className="benchmark-error">{s.name}：{s.error}</p>)}</div>
  </section>;
}
