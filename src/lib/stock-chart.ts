export const chartPeriods = ['intraday','day','month','quarter','year'] as const;
export type ChartPeriod = (typeof chartPeriods)[number];
export type Ohlc = {date:string;open:number;high:number;low:number;close:number;volume:number};
export type IntradayPoint = {time:number;price:number;average:number;volume:number};
export type StockChartData = {symbol:string;period:ChartPeriod;candles:Ohlc[];intraday:IntradayPoint[];timezone:string};
export function marketTimezone(symbol:string) { return symbol.endsWith('.US')?'America/New_York':symbol.endsWith('.SG')?'Asia/Singapore':'Asia/Shanghai'; }
export function cleanOhlc(candles:Ohlc[]) {
  return [...new Map(candles.filter(c=>/^\d{4}-\d{2}-\d{2}$/.test(c.date)&&[c.open,c.high,c.low,c.close].every(p=>Number.isFinite(p)&&p>0)&&c.high>=Math.max(c.open,c.close,c.low)&&c.low<=Math.min(c.open,c.close)).map(c=>[c.date,c])).values()].sort((a,b)=>a.date.localeCompare(b.date));
}
export function cleanIntraday(points:IntradayPoint[]) {
  return [...new Map(points.filter(p=>Number.isFinite(p.time)&&Number.isFinite(p.price)&&p.price>0).map(p=>[p.time,p])).values()].sort((a,b)=>a.time-b.time);
}
