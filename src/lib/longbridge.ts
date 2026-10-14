import 'server-only';
import type { QuoteContext } from 'longbridge';
import type { Candle, Stock } from './backtest';
import { isNativeBindingError, longbridgeErrorMessage } from './longbridge-error';
let context: Promise<QuoteContext> | undefined;
let sdk: Promise<typeof import('longbridge')> | undefined;
function getSdk() {
  if (!sdk) sdk = import('longbridge').catch(error => { sdk = undefined; throw error; });
  return sdk;
}
export function getContext() {
  if (!process.env.LONGBRIDGE_APP_KEY || !process.env.LONGBRIDGE_APP_SECRET || !process.env.LONGBRIDGE_ACCESS_TOKEN) throw new Error('服务器未配置长桥 API 密钥');
  if (!context) context = getSdk().then(({ Config, QuoteContext }) => QuoteContext.new(Config.fromApikeyEnv())).catch(error => { context = undefined; throw error; });
  return context;
}
export async function stockInfo(symbols: string[]): Promise<Stock[]> {
  const ctx = await getContext();
  const info = await ctx.staticInfo(symbols);
  return info.map(s => ({symbol:s.symbol, name:s.nameCn || s.nameEn || s.symbol, currency:s.currency}));
}
const historyCache = new Map<string, { expires: number; candles: Candle[] }>();
export async function getHistory(symbol: string, start: string, end: string, adjustment: 0 | 1 = 1): Promise<Candle[]> {
  const key = `${symbol}:${start}:${end}:${adjustment}`;
  const cached = historyCache.get(key);
  if (cached && cached.expires > Date.now()) return cached.candles;
  const ctx = await getContext();
  const { NaiveDate } = await getSdk();
  const date = (s: string) => { const [y,m,d] = s.split('-').map(Number); return new NaiveDate(y,m,d); };
  // Fetch in yearly chunks to stay below the daily-candle request limit.
  const candles: Candle[] = [];
  let cursor = start;
  while (cursor <= end) {
    const limit = new Date(`${cursor}T00:00:00Z`); limit.setUTCDate(limit.getUTCDate()+364);
    const until = limit.toISOString().slice(0,10) < end ? limit.toISOString().slice(0,10) : end;
    const rows = await ctx.historyCandlesticksByDate(symbol, 14 /* Period.Day */, adjustment, date(cursor), date(until), 0 /* TradeSessions.Intraday */);
    const timezone = symbol.endsWith('.US') ? 'America/New_York' : symbol.endsWith('.SG') ? 'Asia/Singapore' : 'Asia/Shanghai';
    rows.forEach(c => candles.push({date: new Intl.DateTimeFormat('en-CA',{timeZone:timezone}).format(c.timestamp), close: Number(c.close.toString())}));
    const next = new Date(`${until}T00:00:00Z`); next.setUTCDate(next.getUTCDate()+1); cursor = next.toISOString().slice(0,10);
  }
  const unique = [...new Map(candles.map(c => [c.date,c])).values()].filter(c=>c.date>=start && c.date<=end).sort((a,b)=>a.date.localeCompare(b.date));
  if (historyCache.size >= 100) historyCache.delete(historyCache.keys().next().value!);
  historyCache.set(key,{expires:Date.now()+15*60*1000,candles:unique});
  return unique;
}
export function apiError(error: unknown) {
  const text = longbridgeErrorMessage(error);
  console.error('Longbridge quote error:', text);
  if (/服务器未配置长桥 API 密钥/.test(text)) return text;
  if (isNativeBindingError(text)) return '服务器未能加载长桥原生模块，请检查 Vercel 部署依赖。';
  if (/401|403|token|permission|auth|package|subscription/i.test(text)) return '长桥认证或行情权限不足，请检查 API 密钥、令牌和该市场行情权限。';
  return '长桥行情请求失败，请检查网络、股票代码和行情权限后重试。';
}

let cnSecurities: {expires:number; stocks:Stock[]} | undefined;
let cnRequest: Promise<Stock[]> | undefined;
export async function getChinaStocks(): Promise<Stock[]> {
  if (cnSecurities && cnSecurities.expires > Date.now()) return cnSecurities.stocks;
  if (!cnRequest) cnRequest = getContext().then(ctx => ctx.securityList(3 /* Market.CN */)).then(items => {
    const stocks = items.filter(s => /^\d{6}\.(SH|SZ)$/.test(s.symbol)).map(s => ({symbol:s.symbol,name:s.nameCn || s.nameEn,currency:'CNY'}));
    cnSecurities = {expires:Date.now()+24*60*60*1000,stocks};
    return stocks;
  }).finally(()=>{cnRequest=undefined;});
  return cnRequest;
}

const chartCache = new Map<string,{expires:number;data:import('./stock-chart').StockChartData}>();
export async function getStockChart(symbol:string, period:import('./stock-chart').ChartPeriod, start:string, end:string):Promise<import('./stock-chart').StockChartData> {
  const {marketTimezone,cleanOhlc,cleanIntraday} = await import('./stock-chart');
  const key = `${symbol}:${period}:${start}:${end}`;
  const cached = chartCache.get(key);
  if(cached && cached.expires>Date.now())return cached.data;
  const ctx=await getContext();
  const {NaiveDate}=await getSdk();
  const timezone=marketTimezone(symbol);
  const data:import('./stock-chart').StockChartData={symbol,period,timezone,candles:[],intraday:[]};
  if(period==='intraday') {
    const rows=await ctx.intraday(symbol,0 /* TradeSessions.Intraday */);
    data.intraday=cleanIntraday(rows.map(r=>({time:Math.floor(r.timestamp.getTime()/1000),price:Number(r.price.toString()),average:Number(r.avgPrice.toString()),volume:r.volume})));
  } else {
    const date=(s:string)=>{const [y,m,d]=s.split('-').map(Number);return new NaiveDate(y,m,d);};
    const sdkPeriod={day:14,month:16,quarter:17,year:18}[period];
    const candles:import('./stock-chart').Ohlc[]=[];
    let cursor=start;
    while(cursor<=end) {
      const chunk=new Date(`${cursor}T00:00:00Z`);chunk.setUTCDate(chunk.getUTCDate()+364);
      const until=period==='day'&&chunk.toISOString().slice(0,10)<end?chunk.toISOString().slice(0,10):end;
      const rows=await ctx.historyCandlesticksByDate(symbol,sdkPeriod,1 /* ForwardAdjust */,date(cursor),date(until),0);
      rows.forEach(r=>candles.push({date:new Intl.DateTimeFormat('en-CA',{timeZone:timezone}).format(r.timestamp),open:Number(r.open.toString()),high:Number(r.high.toString()),low:Number(r.low.toString()),close:Number(r.close.toString()),volume:r.volume}));
      const next=new Date(`${until}T00:00:00Z`);next.setUTCDate(next.getUTCDate()+1);cursor=next.toISOString().slice(0,10);
    }
    data.candles=cleanOhlc(candles);
  }
  if(data.candles.length||data.intraday.length) {
    if(chartCache.size>=40)chartCache.delete(chartCache.keys().next().value!);
    chartCache.set(key,{expires:Date.now()+(period==='intraday'?30*1000:5*60*1000),data});
  }
  return data;
}
