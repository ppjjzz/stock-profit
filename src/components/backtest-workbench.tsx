'use client';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Area, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { ArrowDownToLine, ArrowRight, ChartNoAxesCombined, CircleHelp, Clock3, Layers3, LoaderCircle, Pause, Play, Plus, RotateCcw, Search, Settings2, Pencil, CandlestickChart, X } from 'lucide-react';
import { planScheduleLabel } from '@/lib/backtest';
import type { Stock, ConfiguredStock, ConfiguredPlan, PositionConfig, Result } from '@/lib/backtest';
import { catalog } from '@/lib/catalog';
import { recentYears } from '@/lib/dates';
import dynamic from 'next/dynamic';
import { StockConfigDialog } from '@/components/stock-config-dialog';
import { RecurringPlanDialog } from '@/components/recurring-plan-dialog';
import { BenchmarkChart } from '@/components/benchmark-chart';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Slider } from '@/components/ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tooltip as HelpTooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
const StockChartDialog = dynamic(()=>import('@/components/stock-chart-dialog').then(m=>m.StockChartDialog),{ssr:false});
const colors = ['#b6ed68','#7caeff','#c6a0fa','#ffbe79','#63d8c5','#ef85a9','#eecc60','#8dd1f0'];
const money = (v: number) => new Intl.NumberFormat('zh-CN',{minimumFractionDigits:2,maximumFractionDigits:2}).format(v);
const compact = (v: number) => Math.abs(v)>=10000 ? `${(v/10000).toFixed(1)}万` : v.toLocaleString('zh-CN',{maximumFractionDigits:0});
export function BacktestWorkbench({initialRange}:{initialRange:{start:string;end:string}}) {
  const [stocks,setStocks] = useState<ConfiguredStock[]>(()=>catalog.slice(0,2).map(s=>({...s,config:{symbol:s.symbol,inputMode:'amount',value:5000}})));
  const [chartStock,setChartStock] = useState<Stock|null>(null);
  const [market,setMarket] = useState('all'); const [dialogStock,setDialogStock] = useState<Stock|null>(null);
  const [query,setQuery] = useState(''); const [searching,setSearching] = useState(false); const [options,setOptions] = useState<Stock[]>([]); const [searchError,setSearchError] = useState(''); const [searchBusy,setSearchBusy] = useState(false);
  const range = initialRange;
  const [start,setStart] = useState(range.start); const [end,setEnd] = useState(range.end);
  const [plans,setPlans] = useState<ConfiguredPlan[]>([]);
  const [planDialog,setPlanDialog] = useState<{plan?:ConfiguredPlan}|null>(null);
  const portfolioStocks = [...new Map([...stocks,...plans.map(p=>p.stock)].map(s=>[s.symbol,s])).values()];
  const portfolioCurrency = portfolioStocks[0]?.currency;
  const [result,setResult] = useState<Result|null>(null); const [loading,setLoading] = useState(false); const [error,setError] = useState('');
  const [position,setPosition] = useState(0); const [playing,setPlaying] = useState(false); const [speed,setSpeed] = useState(1); const [selected,setSelected] = useState('total'); const [showCost,setShowCost] = useState(true);
  useEffect(()=>{
    if (!searching) return;
    const controller = new AbortController();
    const timeout = setTimeout(async()=>{
      setSearchBusy(true); setSearchError('');
      try { const r = await fetch(`/api/stocks?q=${encodeURIComponent(query)}&market=${market}`,{signal:controller.signal}); const data = await r.json(); setOptions(data.stocks || []); setSearchError(data.error || ''); }
      catch(e) { if (!controller.signal.aborted) setSearchError(e instanceof Error ? e.message : '搜索失败'); }
      finally { if (!controller.signal.aborted) setSearchBusy(false); }
    },250);
    return ()=>{clearTimeout(timeout);controller.abort();};
  },[query,searching,market]);
  useEffect(()=>{
    if (!playing || !result) return;
    const id = window.setInterval(()=>setPosition(p=>Math.min(p+1,result.points.length-1)),180/speed);
    return ()=>clearInterval(id);
  },[playing,result,speed]);
  const finished = !!result && position >= result.points.length-1;
  const isPlaying = playing && !finished;
  const point = result?.points[position];
  const value = point ? selected==='total' ? point.total : point.values[selected] ?? 0 : 0;
  const cost = point ? selected==='total' ? point.invested : point.contributions[selected] ?? 0 : 0;
  const profit = value-cost; const rate = cost>0 ? profit/cost*100 : 0;
  const chartData = useMemo(()=>result?.points.slice(0,position+1).map(p=>({date:p.date,value:selected==='total'?p.total:p.values[selected],cost:selected==='total'?p.invested:p.contributions[selected]})) || [],[result,position,selected]);
  const domain = useMemo(()=>{
    if (!result) return [0,15000];
    const values = result.points.flatMap(p=>[selected==='total'?p.total:p.values[selected],selected==='total'?p.invested:p.contributions[selected]]);
    const max=Math.max(...values,1); return [0,Math.ceil(max*1.12/100)*100];
  },[result,selected]);
  const maxDrawdown = useMemo(()=>{
    if (!result) return 0;
    let prevValue=0, nav=1, peak=1, drawdown=0, prevCost=0;
    for (const p of result.points.slice(0,position+1)) {
      const v=selected==='total'?p.total:p.values[selected], c=selected==='total'?p.invested:p.contributions[selected];
      if (prevValue>0) nav *= (v-(c-prevCost))/prevValue;
      peak=Math.max(peak,nav); drawdown=Math.max(drawdown,(peak-nav)/peak); prevValue=v; prevCost=c;
    }
    return drawdown*100;
  },[result,position,selected]);
  async function run() {
    setError(''); setLoading(true); setPlaying(false);
    try {
      const r=await fetch('/api/backtest',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({symbols:portfolioStocks.map(s=>s.symbol),positions:stocks.map(s=>s.config),plans:plans.map(p=>({id:p.id,symbol:p.symbol,amount:p.amount,frequency:p.frequency,weekday:p.weekday,monthDay:p.monthDay})),start,end})});
      const data=await r.json(); if(!r.ok) throw new Error(data.error || '回测失败');
      setResult(data);setSelected('total');setPosition(0);setPlaying(true);
    } catch(e) {setError(e instanceof Error?e.message:'回测失败');} finally {setLoading(false);}
  }
  function add(stock: Stock) {
    if(portfolioStocks.length>=8 && portfolioCurrency===stock.currency && !portfolioStocks.some(s=>s.symbol===stock.symbol)) {setSearchError('最多添加 8 只股票');return;}
    setDialogStock(stock);setSearching(false);setSearchError('');
  }
  function saveStock(config:PositionConfig) {
    if(!dialogStock)return;
    const stock = {...dialogStock,config};
    const switching = !!portfolioCurrency && portfolioCurrency !== stock.currency;
    setStocks(current=>switching?[stock]:current.some(s=>s.symbol===stock.symbol)?current.map(s=>s.symbol===stock.symbol?stock:s):[...current,stock]);
    if(switching){setPlans([]);setResult(null);setPlaying(false);setPosition(0);setSelected('total');}
    setDialogStock(null);setQuery('');
  }
  function savePlan(plan:ConfiguredPlan):string|undefined {
    if (portfolioCurrency && plan.stock.currency!==portfolioCurrency) return '定投股票必须与组合使用相同币种';
    const nextPlans=plans.some(p=>p.id===plan.id)?plans.map(p=>p.id===plan.id?plan:p):[...plans,plan];
    if (nextPlans.length>32) return '最多添加 32 条定投计划';
    if (new Set([...stocks.map(s=>s.symbol),...nextPlans.map(p=>p.symbol)]).size>8) return '初始持仓和定投计划合计最多 8 只股票';
    setPlans(nextPlans);setPlanDialog(null);
  }
  function exportCsv() {
    if(!result)return;
    const rows=[['日期','累计投入',`总市值 (${result.currency})`,...result.stocks.map(s=>s.symbol)],...result.points.map(p=>[p.date,p.invested.toFixed(2),p.total.toFixed(2),...result.stocks.map(s=>p.values[s.symbol].toFixed(2))])];
    const url=URL.createObjectURL(new Blob(['\uFEFF'+rows.map(r=>r.join(',')).join('\n')],{type:'text/csv;charset=utf-8;'})); const a=document.createElement('a');a.href=url;a.download='时盈-回测结果.csv';a.click();URL.revokeObjectURL(url);
  }
  return <TooltipProvider><div className="app-shell">
    <header className="topbar"><Link href="/" className="brand"><span className="brand-mark"><ChartNoAxesCombined size={23}/></span>时盈<span className="brand-en">TIMEFOLIO</span></Link><nav><span className="nav-active">收益回测</span><span className="nav-description">让时间，验证你的投资</span></nav><div className="provider"><i/>Longbridge 行情<span className="provider-tag">API</span></div></header>
    <main><div className="page-heading"><div><div className="eyebrow">INVESTMENT BACKTEST</div><h1>回到过去，看见收益<span>.</span></h1><p>如果当时开始投资，今天会有什么不同？</p></div><div className="heading-note"><Clock3 size={15}/> 每一个交易日，都值得回看</div></div>
      <div className="workspace">
        <aside className="config panel"><div className="panel-title"><Settings2 size={18}/><h2>回测配置</h2><span>01</span></div>
          <section><div className="field-title"><label htmlFor="stock-search">选择股票</label><span>{portfolioStocks.length} / 8</span></div><div className="searchbox"><Search size={16}/><Input id="stock-search" placeholder="名称 / 代码，如 茅台、600519" value={query} onFocus={()=>setSearching(true)} onChange={e=>{setQuery(e.target.value);setSearching(true);}}/><Button variant="ghost" size="icon-xs" aria-label="关闭搜索" onClick={()=>setSearching(s=>!s)}>{searching?<X size={15}/>:<Plus size={16}/>}</Button></div>
          {searching?<div className="search-results"><Tabs value={market} onValueChange={setMarket}><TabsList className="w-full"><TabsTrigger value="all">全部</TabsTrigger><TabsTrigger value="CN">A 股</TabsTrigger><TabsTrigger value="US">美股</TabsTrigger><TabsTrigger value="HK">港股</TabsTrigger></TabsList></Tabs><div className="search-hint">A 股全市场名称 / 六位代码搜索 · 沪深交易所</div>{searchBusy?<p>正在搜索…</p>:options.filter(o=>!stocks.some(s=>s.symbol===o.symbol)).map(o=><Button variant="ghost" key={o.symbol} onClick={()=>add(o)}><span>{o.name}<small>{o.symbol} · {o.symbol.endsWith('.SH')?'沪市':o.symbol.endsWith('.SZ')?'深市':o.currency}</small></span><Plus size={16}/></Button>)}{!searchBusy&&!options.length?<p>没有匹配结果，试试完整股票代码</p>:null}{searchError?<p className="error-text">{searchError}</p>:null}</div>:null}
          <div className="stock-list">{stocks.map((s,i)=><div className="stock-chip" key={s.symbol}><span className="stock-avatar" style={{color:colors[i],background:`${colors[i]}15`}}>{s.symbol.split('.')[0].slice(0,2)}</span><div><strong>{s.name}</strong><small>{s.symbol}</small></div><Badge variant="outline" className="allocation-badge">{s.config.inputMode==='amount'?`${compact(s.config.value)} ${s.currency}`:`${compact(s.config.value)} 股`}</Badge><Button variant="ghost" size="icon-xs" className="stock-chart-button" aria-label={`查看${s.name}K线`} title="查看个股 K 线" onClick={()=>setChartStock(s)}><CandlestickChart size={14}/></Button><Button variant="ghost" size="icon-xs" className="edit-stock" aria-label={`编辑${s.name}配置`} onClick={()=>{setSearching(false);setDialogStock(s);}}><Pencil size={13}/></Button><Button variant="ghost" size="icon-xs" aria-label={`移除${s.name}`} onClick={()=>setStocks(stocks.filter(x=>x.symbol!==s.symbol))}><X size={14}/></Button></div>)}</div><div className="field-note">图表图标查看行情 · 铅笔修改初始配置</div></section>
          <section><div className="field-title"><label>回测区间</label></div><div className="date-row"><div><span>开始日期</span><Input aria-label="开始日期" type="date" value={start} onChange={e=>setStart(e.target.value)}/></div><ArrowRight size={14}/><div><span>结束日期</span><Input aria-label="结束日期" type="date" value={end} onChange={e=>setEnd(e.target.value)}/></div></div><div className="presets">{[1,3,5].map(y=><Button variant="ghost" key={y} onClick={()=>{const r=recentYears(y);setEnd(r.end);setStart(r.start);}}>近 {y} 年</Button>)}</div></section>
          <section className="recurring-config"><div className="field-title"><span className="recurring-section-title">定投计划</span><span>可选 · {plans.length} 条</span></div>
            {plans.length?<div className="recurring-plan-list">{plans.map((p,i)=><div className="recurring-plan-card" key={p.id}><div className="recurring-plan-heading"><strong>{p.stock.name}</strong><Button variant="ghost" size="icon-xs" aria-label={`编辑${p.stock.name}定投计划 ${i+1}`} onClick={()=>setPlanDialog({plan:p})}><Pencil size={13}/></Button><Button variant="ghost" size="icon-xs" aria-label={`删除${p.stock.name}定投计划 ${i+1}`} onClick={()=>setPlans(plans.filter(x=>x.id!==p.id))}><X size={14}/></Button></div><small>{p.symbol} · {planScheduleLabel(p)}</small><div className="recurring-plan-amount">{money(p.amount)} <span>{p.stock.currency} / 期</span></div></div>)}</div>:<div className="recurring-empty"><Clock3 size={19}/><p>尚未添加定投计划</p><span>初始持仓按各股票配置投入，可按需追加定投。</span></div>}
            <Button variant="outline" className="add-plan-button" onClick={()=>{setSearching(false);setPlanDialog({});}}><Plus size={15}/>添加定投计划</Button>
            <div className="field-note">各计划独立执行；不添加计划时仅使用初始持仓。</div>
          </section>
          {error?<div role="alert" className="error-banner">{error}</div>:null}<Button className="run-button" disabled={loading||!portfolioStocks.length} onClick={run}>{loading?<LoaderCircle size={17} className="spin"/>:<Play size={16} fill="currentColor"/>}{loading?'正在获取历史行情…':'开始回测'}{!loading?<ArrowRight size={17}/>:null}</Button><div className="config-footer"><Layers3 size={13}/> 长桥前复权日线 · 真实历史行情</div>
        </aside>
        <div className="results-column"><div className="metrics"><div className="metric"><span>{selected==='total'?'当前总市值':'当前持仓市值'} <small>{result?.currency||portfolioCurrency||'USD'}</small></span><strong>{point?money(value):'—'}</strong><div><i className="green-dot"/>{point?point.date:'等待开始回测'}</div></div><div className="metric"><span>累计投入</span><strong>{point?money(cost):'—'}</strong><div>{(result?result.settings.plans.length:plans.length)?'含定投计划':'仅初始持仓'}</div></div><div className="metric"><span>累计收益 <HelpTooltip><TooltipTrigger asChild><Button variant="ghost" className="metric-help" aria-label="查看收益计算口径"><CircleHelp size={14}/></Button></TooltipTrigger><TooltipContent className="max-w-72"><p>持仓市值减累计投入。基于前复权价格，未逐笔核算现金分红、税费或红利再投，不是完整含息总回报。</p></TooltipContent></HelpTooltip></span><strong className={profit<0?'negative':'positive'}>{point?`${profit>=0?'+':''}${money(profit)}`:'—'}</strong><div className={profit<0?'negative':'positive'}>{point?`${rate>=0?'+':''}${rate.toFixed(2)}%`:'投入后开始计算'}</div></div><div className="metric"><span>最大回撤 <CircleHelp size={14}/></span><strong>{point?`${maxDrawdown.toFixed(2)}%`:'—'}</strong><div>剔除入金影响的净值回撤</div></div></div>
          <section className="chart-panel panel"><div className="chart-header"><div><div className="eyebrow">PORTFOLIO PERFORMANCE</div><h2>资产成长轨迹</h2></div><Button variant="outline" size="sm" className="icon-button export" onClick={exportCsv} disabled={!result}><ArrowDownToLine size={15}/>导出数据</Button></div><div className="chart-toolbar"><div className="series-tabs"><Button variant="ghost" className={selected==='total'?'chosen':''} onClick={()=>setSelected('total')}><i style={{background:colors[0]}}/>总市值</Button>{result?.stocks.map((s,i)=><Button variant="ghost" key={s.symbol} className={selected===s.symbol?'chosen':''} onClick={()=>setSelected(s.symbol)}><i style={{background:colors[(i+1)%colors.length]}}/>{s.name}</Button>)}</div><label className="cost-toggle"><input type="checkbox" checked={showCost} onChange={e=>setShowCost(e.target.checked)}/>累计投入</label></div>
          <div className="chart-stage"><span className="axis-caption">市值 / {result?.currency||portfolioCurrency||'USD'}</span>{result?<ResponsiveContainer width="100%" height="100%"><ComposedChart data={chartData} margin={{top:30,right:22,bottom:5,left:0}}><defs><linearGradient id="chart-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#b6ed68" stopOpacity={0.19}/><stop offset="100%" stopColor="#b6ed68" stopOpacity={0}/></linearGradient></defs><CartesianGrid stroke="var(--chart-grid)" vertical={false} strokeDasharray="3 5"/><XAxis dataKey="date" tick={{fill:'var(--chart-axis)',fontSize:11}} tickLine={false} axisLine={false} minTickGap={70} tickFormatter={d=>d.slice(0,7)}/><YAxis domain={domain} tickFormatter={compact} tick={{fill:'var(--chart-axis)',fontSize:11}} tickLine={false} axisLine={false} width={60}/><Tooltip contentStyle={{background:'var(--popover)',border:'1px solid var(--control-border)',borderRadius:10,fontSize:12}} labelStyle={{color:'var(--foreground)'}} formatter={(v,name)=>[money(Number(v)),name==='value'?'持仓市值':'累计投入']}/>{showCost?<Line type="stepAfter" dataKey="cost" stroke="var(--chart-cost)" strokeDasharray="5 5" dot={false} isAnimationActive={false}/>:null}<Area type="monotone" dataKey="value" stroke="#b6ed68" strokeWidth={2.5} fill="url(#chart-fill)" isAnimationActive={false} dot={chartData.length===1?{r:4}:false} activeDot={{r:5,stroke:'var(--panel)',strokeWidth:3}}/></ComposedChart></ResponsiveContainer>:<div className="chart-empty"><div className="empty-grid"/><div className="empty-icon"><ChartNoAxesCombined size={30}/></div><h3>你的投资故事，从这里开始</h3><p>选择股票与时间区间，回放资产成长的每一天</p><span>配置策略 <ArrowRight size={13}/> 开始回测 <ArrowRight size={13}/> 看见收益</span></div>}</div>
          <div className="playback"><div className="playback-top"><div className="play-controls"><Button size="icon" className="play-circle" disabled={!result} aria-label={isPlaying?'暂停':'播放'} onClick={()=>{if(finished){setPosition(0);setPlaying(true);}else setPlaying(p=>!p);}}>{isPlaying?<Pause size={16} fill="currentColor"/>:<Play size={16} fill="currentColor"/>}</Button><Button variant="ghost" size="icon-sm" className="reset" disabled={!result} aria-label="从头回放" onClick={()=>{setPosition(0);setPlaying(false);}}><RotateCcw size={16}/></Button><span>{point?.date||'— — —'}<small>{result?`${position+1} / ${result.points.length} 个交易日`:'时间轴尚未开始'}</small></span></div><div className="speed"><span>播放速度</span><Select value={String(speed)} onValueChange={v=>setSpeed(Number(v))}><SelectTrigger aria-label="播放倍速" className="w-20"><SelectValue/></SelectTrigger><SelectContent>{[0.5,1,2,4,8].map(s=><SelectItem key={s} value={String(s)}>{s}×</SelectItem>)}</SelectContent></Select></div></div><Slider className="timeline" aria-label="回测播放进度" min={0} max={Math.max((result?.points.length||1)-1,1)} value={[position]} disabled={!result} onValueChange={([p])=>{setPosition(p);setPlaying(false);}}/><div className="timeline-dates"><span>{result?.points[0].date||start}</span><span>{finished?'回测完成':isPlaying?'正在回放':'可拖动时间轴查看任意交易日'}</span><span>{result?.points.at(-1)?.date||end}</span></div></div></section>
          <BenchmarkChart start={result?.settings.start || start} end={result?.settings.end || end}/>
          <div className="return-disclosure"><CircleHelp size={15}/><div><strong>收益口径：前复权价格回测</strong><p>未单独核算现金股息、分红扣税或红利再投；前复权调整不能替代完整含息总回报。</p></div><Badge variant="outline">现金分红未入账</Badge></div>
          <section className="holdings panel"><div className="holdings-heading"><h2>组合持仓</h2><span>{result?.stocks.length||portfolioStocks.length} 只股票 <span className="separator">/</span> 独立配置</span></div><div className="table-wrap"><table><thead><tr><th>股票名称</th><th>持有份额</th><th>累计投入</th><th>当前市值</th><th>收益率</th></tr></thead><tbody>{(result?.stocks||portfolioStocks).map((s,i)=>{const v=point?.values[s.symbol]||0,c=point?.contributions[s.symbol]||0,r=c?(v-c)/c*100:0;return <tr key={s.symbol}><td><span className="table-dot" style={{background:colors[(i+1)%colors.length]}}/><strong>{s.name}</strong><small>{s.symbol}</small></td><td>{point?money(point.shares[s.symbol]):'—'}</td><td>{point?money(c):'—'}</td><td>{point?money(v):'—'}</td><td className={r<0?'negative':'positive'}>{point?`${r>=0?'+':''}${r.toFixed(2)}%`:'—'}</td></tr>;})}</tbody></table></div></section>
          {result?.warnings.length?<div className="data-notes">{result.warnings.join(' ')}</div>:null}
        </div>
      </div><footer className="page-footer"><span>时盈 TIMEFOLIO <span className="separator">/</span> 让投资拥有时间的视角</span><span>前复权收盘价 · 允许小数份额 · 不计交易费用、税费及单独现金分红</span></footer>
    </main>
    {dialogStock?<StockConfigDialog key={dialogStock.symbol} stock={dialogStock} switchingFrom={portfolioCurrency && portfolioCurrency!==dialogStock.currency?portfolioCurrency:undefined} config={stocks.find(s=>s.symbol===dialogStock.symbol)?.config} onClose={()=>setDialogStock(null)} onSave={saveStock}/>:null}
    {planDialog?<RecurringPlanDialog stocks={portfolioStocks} plan={planDialog.plan} currency={portfolioCurrency} onClose={()=>setPlanDialog(null)} onSave={savePlan}/>:null}
    {chartStock?<StockChartDialog key={chartStock.symbol} stock={chartStock} start={start} end={end} onClose={()=>setChartStock(null)}/>:null}
  </div></TooltipProvider>;
}
