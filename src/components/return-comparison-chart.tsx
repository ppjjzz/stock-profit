'use client';
import { useId, useMemo } from 'react';
import { Area, CartesianGrid, ComposedChart, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { LoaderCircle } from 'lucide-react';
import type { Result } from '@/lib/backtest';
import { benchmarks, compareReturns } from '@/lib/benchmarks';
import type { BenchmarkData } from '@/components/use-benchmark-data';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';

const percent=(value:number|null|undefined)=>value==null?'—':`${value>0?'+':''}${value.toFixed(2)}%`;
const gainColor=(value:number|null|undefined)=>value==null||value===0?'var(--foreground)':value>0?'#ff9391':'var(--green)';

export function ReturnComparisonChart({result,position,selected,benchmarkSymbol,onBenchmarkChange,benchmarkData}:{
  result:Result|null;position:number;selected:string;benchmarkSymbol:string;onBenchmarkChange:(symbol:string)=>void;benchmarkData:BenchmarkData;
}) {
  const id=useId();
  const {data,loading,error,reload}=benchmarkData;
  const series=data?.series.find(s=>s.symbol===benchmarkSymbol);
  const points=useMemo(()=>compareReturns(result?.points||[],selected,series?.candles||[]),[result,selected,series]);
  const visiblePoints=useMemo(()=>points.slice(0,position+1),[points,position]);
  const current=points[position];
  const domain=useMemo(()=>{
    const values=points.flatMap(p=>[p.mine??0,p.benchmark??0]);
    const min=Math.min(0,...values),max=Math.max(0,...values),padding=Math.max((max-min)*0.12,1);
    return [min-padding,max+padding];
  },[points]);
  const benchmarkError=error||(!loading&&result&&(!series?.candles.length||series.error)?series?.error||'所选指数暂无行情':'');
  const benchmarkValue=loading||benchmarkError?null:current?.benchmark;
  const difference=benchmarkValue==null?null:current?.outperformance;
  return <div className="return-comparison">
    <div className="return-summary">
      <div className="return-summary-item"><span><i className="mine-line"/>我的收益率</span><strong style={{color:gainColor(current?.mine)}}>{percent(current?.mine)}</strong></div>
      <div className="return-summary-item"><div className="return-benchmark-select"><i className="benchmark-line"/><Select value={benchmarkSymbol} onValueChange={onBenchmarkChange}><SelectTrigger aria-label="对比指数"><SelectValue/></SelectTrigger><SelectContent>{benchmarks.map(b=><SelectItem key={b.symbol} value={b.symbol}>{b.name}</SelectItem>)}</SelectContent></Select></div><strong style={{color:gainColor(benchmarkValue)}}>{loading&&result?'…':percent(benchmarkValue)}</strong></div>
      <div className="return-summary-item"><span>跑赢指数</span><strong style={{color:gainColor(difference)}}>{difference==null?'—':`${difference>0?'+':''}${difference.toFixed(2)}`}<small>{difference==null?'':'个百分点'}</small></strong></div>
    </div>
    <div className="chart-stage return-chart-stage">
      <span className="axis-caption">收益率 / %</span>
      {result?<ResponsiveContainer width="100%" height="100%"><ComposedChart data={visiblePoints} margin={{top:30,right:22,bottom:5,left:0}}>
        <defs><linearGradient id={`${id}-return-fill`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#287df5" stopOpacity={0.16}/><stop offset="100%" stopColor="#287df5" stopOpacity={0}/></linearGradient></defs>
        <CartesianGrid stroke="var(--chart-grid)" vertical={false} strokeDasharray="3 5"/>
        <XAxis dataKey="date" minTickGap={70} tickFormatter={d=>d.slice(0,7)} tick={{fill:'var(--chart-axis)',fontSize:11}} axisLine={false} tickLine={false}/>
        <YAxis domain={domain} tickFormatter={v=>`${v>0?'+':''}${v.toFixed(1)}%`} tick={{fill:'var(--chart-axis)',fontSize:11}} axisLine={false} tickLine={false} width={72}/>
        <ReferenceLine y={0} stroke="var(--chart-axis)" strokeDasharray="5 5"/>
        <Tooltip contentStyle={{background:'var(--popover)',border:'1px solid var(--control-border)',borderRadius:10,fontSize:12}} labelStyle={{color:'var(--foreground)'}} formatter={(value,name)=>[percent(Number(value)),name]}/>
        <Area dataKey="mine" name="我的收益率" type="linear" baseValue={0} stroke="#287df5" strokeWidth={2.5} fill={`url(#${id}-return-fill)`} isAnimationActive={false} connectNulls={false} dot={visiblePoints.length===1?{r:4}:false}/>
        {!loading&&!benchmarkError?<Line dataKey="benchmark" name={series?.name||'指数'} type="linear" stroke="#ff9e22" strokeWidth={2.2} dot={visiblePoints.length===1?{r:4}:false} connectNulls={false} isAnimationActive={false}/>:null}
      </ComposedChart></ResponsiveContainer>:<div className="chart-empty"><h3>开始回测，比较你的收益表现</h3><p>蓝线展示我的收益率，橙线展示所选指数</p></div>}
    </div>
    {result&&loading?<div className="return-chart-status"><LoaderCircle size={13} className="spin"/>正在加载指数行情…</div>:null}
    {benchmarkError?<div className="return-chart-status"><span role="alert">{benchmarkError}</span><Button variant="ghost" size="sm" onClick={reload}>重试指数</Button></div>:null}
    {result&&current?.mine===null?<div className="return-chart-status">所选持仓尚未投入，收益率将在首次投入后展示。</div>:null}
    <p className="return-chart-note">我的收益率 = 累计收益 / 累计投入；指数以开始投入时首个可用收盘价为基准，休市日沿用上一收盘价。跑赢指数为两者之差，不计汇率收益。</p>
  </div>;
}
