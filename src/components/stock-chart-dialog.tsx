'use client';
import { useEffect, useRef, useState } from 'react';
import type { IChartApi, Time, UTCTimestamp } from 'lightweight-charts';
import type { Stock } from '@/lib/backtest';
import type { ChartPeriod, Ohlc, IntradayPoint, StockChartData } from '@/lib/stock-chart';
import { recentYears } from '@/lib/dates';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CandlestickChart, LoaderCircle, RotateCcw } from 'lucide-react';
const labels:Record<ChartPeriod,string>={intraday:'分时',day:'日',month:'月',quarter:'季',year:'年'};
const price=(n:number)=>n.toLocaleString('zh-CN',{minimumFractionDigits:2,maximumFractionDigits:3});
export function StockChartDialog({stock,start,end,onClose}:{stock:Stock;start:string;end:string;onClose:()=>void}) {
  const [period,setPeriod]=useState<ChartPeriod>('day'),[span,setSpan]=useState('backtest'),[retry,setRetry]=useState(0);
  const [data,setData]=useState<StockChartData|null>(null),[loading,setLoading]=useState(true),[error,setError]=useState('');
  const [hovered,setHovered]=useState<Ohlc|IntradayPoint|null>(null);
  const container=useRef<HTMLDivElement>(null),chartRef=useRef<IChartApi|null>(null);
  const range=span==='backtest'?{start,end}:recentYears(Number(span));
  useEffect(()=>{
    const controller=new AbortController();
    async function load() {
      setLoading(true);setError('');setHovered(null);setData(null);
      try {
        const response=await fetch(`/api/stock-chart?symbol=${encodeURIComponent(stock.symbol)}&period=${period}&start=${range.start}&end=${range.end}`,{signal:controller.signal});
        const json=await response.json();if(!response.ok)throw new Error(json.error||'行情加载失败');
        if(!controller.signal.aborted)setData(json);
      } catch(e){if(!controller.signal.aborted)setError(e instanceof Error?e.message:'行情加载失败');}
      finally{if(!controller.signal.aborted)setLoading(false);}
    }
    void load();return()=>controller.abort();
  },[stock.symbol,period,range.start,range.end,retry]);
  useEffect(()=>{
    if(!container.current||!data||data.period!==period||!data.candles.length&&!data.intraday.length)return;
    let disposed=false,chart:IChartApi|undefined;
    const target=container.current;
    const dateKey=(time:Time)=>typeof time==='object'?`${time.year}-${String(time.month).padStart(2,'0')}-${String(time.day).padStart(2,'0')}`:String(time);
    const formatTime=(time:Time)=>typeof time==='number'?new Intl.DateTimeFormat('zh-CN',{timeZone:data.timezone,month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date(time*1000)):dateKey(time);
    async function draw() {
      const lib=await import('lightweight-charts');if(disposed)return;
      chart=lib.createChart(target,{autoSize:true,height:350,layout:{background:{type:lib.ColorType.Solid,color:'#131e2e'},textColor:'#b0bed0',fontSize:11,attributionLogo:true},grid:{vertLines:{color:'#3a4b63'},horzLines:{color:'#3a4b63'}},rightPriceScale:{borderColor:'#52657f',scaleMargins:{top:0.08,bottom:0.25}},timeScale:{borderColor:'#52657f',timeVisible:period==='intraday',secondsVisible:false,tickMarkFormatter:(time:Time)=>period==='intraday'&&typeof time==='number'?new Intl.DateTimeFormat('en-GB',{timeZone:data!.timezone,hour:'2-digit',minute:'2-digit'}).format(new Date(time*1000)):dateKey(time)},localization:{locale:'zh-CN',timeFormatter:formatTime}});
      chartRef.current=chart;
      if(period==='intraday') {
        const line=chart.addSeries(lib.AreaSeries,{lineColor:'#b6ed68',topColor:'#b6ed682a',bottomColor:'#b6ed6800',lineWidth:2,priceFormat:{type:'price',precision:3,minMove:0.001}});
        line.setData(data!.intraday.map(p=>({time:p.time as UTCTimestamp,value:p.price})));
        const avg=chart.addSeries(lib.LineSeries,{color:'#e6b773',lineWidth:1,priceLineVisible:false,lastValueVisible:false});
        avg.setData(data!.intraday.filter(p=>Number.isFinite(p.average)&&p.average>0).map(p=>({time:p.time as UTCTimestamp,value:p.average})));
      } else {
        const candles=chart.addSeries(lib.CandlestickSeries,{upColor:'#f18f85',downColor:'#76cf9b',wickUpColor:'#f18f85',wickDownColor:'#76cf9b',borderVisible:false,priceFormat:{type:'price',precision:3,minMove:0.001}});
        candles.setData(data!.candles.map(c=>({time:c.date,open:c.open,high:c.high,low:c.low,close:c.close})));
      }
      const volume=chart.addSeries(lib.HistogramSeries,{priceScaleId:'volume',priceFormat:{type:'volume'},priceLineVisible:false,lastValueVisible:false});
      volume.priceScale().applyOptions({scaleMargins:{top:0.82,bottom:0}});
      volume.setData(period==='intraday'?data!.intraday.map(p=>({time:p.time as UTCTimestamp,value:p.volume,color:'#8fa3be90'})):data!.candles.map(c=>({time:c.date,value:c.volume,color:c.close>=c.open?'#f18f8590':'#76cf9b90'})));
      const lookup=new Map<string,Ohlc|IntradayPoint>(period==='intraday'?data!.intraday.map(p=>[String(p.time),p]):data!.candles.map(c=>[c.date,c]));
      chart.subscribeCrosshairMove(param=>{setHovered(param.time===undefined?null:lookup.get(dateKey(param.time))||null);});
      chart.timeScale().fitContent();
    }
    void draw().catch(()=>{if(!disposed)setError('图表渲染失败，请刷新重试。');});
    return()=>{disposed=true;chart?.remove();if(chartRef.current===chart)chartRef.current=null;};
  },[data,period]);
  const current=hovered||(period==='intraday'?data?.intraday.at(-1):data?.candles.at(-1));
  const empty=!loading&&!error&&data&&!data.candles.length&&!data.intraday.length;
  return <Dialog open onOpenChange={open=>{if(!open)onClose();}}><DialogContent className="price-dialog sm:max-w-[900px]">
    <DialogHeader><div className="dialog-eyebrow"><CandlestickChart size={15}/> SECURITY CHART</div><DialogTitle>{stock.name}<Badge variant="secondary">{stock.symbol}</Badge></DialogTitle><DialogDescription>长桥真实行情 · {stock.currency} · {period==='intraday'?'最新交易日分时价格与均价':'前复权 OHLC K 线'}</DialogDescription></DialogHeader>
    <div className="price-chart-toolbar"><Tabs value={period} onValueChange={v=>setPeriod(v as ChartPeriod)}><TabsList>{Object.entries(labels).map(([p,l])=><TabsTrigger key={p} value={p}>{l}</TabsTrigger>)}</TabsList></Tabs>{period!=='intraday'?<Select value={span} onValueChange={setSpan}><SelectTrigger aria-label="K线日期范围" className="w-32"><SelectValue/></SelectTrigger><SelectContent><SelectItem value="backtest">回测区间</SelectItem><SelectItem value="1">最近 1 年</SelectItem><SelectItem value="5">最近 5 年</SelectItem><SelectItem value="10">最近 10 年</SelectItem></SelectContent></Select>:null}<Button variant="ghost" size="icon-sm" aria-label="重新加载个股行情" disabled={loading} onClick={()=>setRetry(r=>r+1)}><RotateCcw size={15}/></Button></div>
    <div className="ohlc-readout">{current?'date' in current?<><span>{current.date}</span><span>开 <b>{price(current.open)}</b></span><span>高 <b>{price(current.high)}</b></span><span>低 <b>{price(current.low)}</b></span><span>收 <b>{price(current.close)}</b></span><span>量 <b>{current.volume.toLocaleString('zh-CN')}</b></span></>:<><span>{new Intl.DateTimeFormat('zh-CN',{timeZone:data?.timezone||'Asia/Shanghai',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date(current.time*1000))}</span><span>价格 <b>{price(current.price)}</b></span><span>均价 <b>{price(current.average)}</b></span><span>量 <b>{current.volume.toLocaleString('zh-CN')}</b></span></>:<span>移动光标查看行情详情</span>}</div>
    <div className="price-chart-stage"><div className="price-chart-canvas" ref={container} role="img" aria-label={`${stock.name}${labels[period]}行情图`}/>{loading?<div className="price-chart-overlay"><LoaderCircle className="spin" size={24}/><span>正在获取{labels[period]}行情…</span></div>:error?<div className="price-chart-overlay" role="alert"><span>{error}</span><Button variant="outline" onClick={()=>setRetry(r=>r+1)}>重试</Button></div>:empty?<div className="price-chart-overlay"><span>{period==='intraday'?'该股票暂无最新交易日分时数据':'所选区间暂无此周期 K 线'}</span></div>:null}</div>
    <div className="price-chart-footer"><p>{period==='intraday'?'分时展示长桥返回的最新交易日，不回放历史日；黄色线为当日均价。':'可拖动、滚轮缩放；红涨绿跌。月、季、年 K 线包含边界所在周期，当前周期可能未收盘。'}</p><span>{period==='intraday'?'最新交易日':`${range.start} — ${range.end}`}<Button variant="ghost" size="xs" onClick={()=>chartRef.current?.timeScale().fitContent()}>适应全部</Button></span><a href="https://www.tradingview.com/" target="_blank" rel="noreferrer">Charts by TradingView</a></div>
  </DialogContent></Dialog>;
}
