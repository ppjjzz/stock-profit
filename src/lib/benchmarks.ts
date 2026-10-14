import type { Candle, Point } from './backtest';
export const benchmarks = [
  {symbol:'.SPX.US',name:'标普 500',color:'#b6ed68'},
  {symbol:'.IXIC.US',name:'纳斯达克综合',color:'#7caeff'},
  {symbol:'000300.SH',name:'沪深 300',color:'#c6a0fa'},
  {symbol:'000016.SH',name:'上证 50',color:'#eecc60'},
  {symbol:'399006.SZ',name:'创业板指',color:'#ffbe79'},
  {symbol:'000688.SH',name:'科创 50',color:'#8dd1f0'},
  {symbol:'HSI.HK',name:'恒生指数',color:'#63d8c5'},
  {symbol:'HSTECH.HK',name:'恒生科技指数',color:'#ef85a9'},
];
export type BenchmarkSeries = (typeof benchmarks)[number] & {candles:Candle[];error?:string};
export type BenchmarkResult = {start:string;end:string;series:BenchmarkSeries[]};
export function compareReturns(points:Point[],selected:string,candles:Candle[]) {
  const prices=candles.filter(c=>Number.isFinite(c.close)&&c.close>0).toSorted((a,b)=>a.date.localeCompare(b.date));
  let index=0, lastClose:number|null=null, baseline:number|null=null;
  return points.map(point=>{
    while(index<prices.length&&prices[index].date<=point.date)lastClose=prices[index++].close;
    const value=selected==='total'?point.total:point.values[selected]??0;
    const cost=selected==='total'?point.invested:point.contributions[selected]??0;
    if(cost>0&&baseline===null&&lastClose!==null)baseline=lastClose;
    const mine=cost>0?(value-cost)/cost*100:null;
    const benchmark=cost>0&&baseline!==null&&lastClose!==null?(lastClose/baseline-1)*100:null;
    return {date:point.date,mine,benchmark,outperformance:mine!==null&&benchmark!==null?mine-benchmark:null};
  });
}
export function normalizeBenchmarks(series: BenchmarkSeries[]) {
  const valid = series.map(s=>({...s,candles:s.candles.filter(c=>Number.isFinite(c.close)&&c.close>0).sort((a,b)=>a.date.localeCompare(b.date))}));
  const dates = [...new Set(valid.flatMap(s=>s.candles.map(c=>c.date)))].sort();
  const maps = new Map(valid.map(s=>[s.symbol,new Map(s.candles.map(c=>[c.date,c.close]))]));
  const last = new Map<string,number>();
  return dates.map(date=>{
    const values:Record<string,number|string> = {date};
    for (const s of valid) {
      const close=maps.get(s.symbol)?.get(date);
      if(close!==undefined)last.set(s.symbol,close);
      const price=last.get(s.symbol);
      if(price!==undefined&&s.candles.length)values[s.symbol]=(price/s.candles[0].close-1)*100;
    }
    return values;
  });
}
