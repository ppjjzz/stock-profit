import type { Stock } from './backtest';
export function normalizeSymbol(query: string): string | null {
  const q = query.trim().toUpperCase();
  if (/^6\d{5}$/.test(q)) return `${q}.SH`;
  if (/^[03]\d{5}$/.test(q)) return `${q}.SZ`;
  if (/^\d+\.HK$/.test(q)) return `${Number(q.split('.')[0])}.HK`;
  return /^[A-Z0-9.\-]{1,24}\.(US|HK|SH|SZ|SG)$/.test(q) ? q : null;
}
export function filterStocks(stocks: Stock[], query: string, market: string) {
  const q = query.trim().toLowerCase();
  return stocks.filter(s => (market==='all' || (market==='CN'?/\.(SH|SZ)$/.test(s.symbol):s.symbol.endsWith(`.${market}`))) && `${s.name} ${s.symbol}`.toLowerCase().includes(q)).sort((a,b)=>{
    const exact = (s:Stock) => s.symbol.split('.')[0].toLowerCase()===q || s.name.toLowerCase()===q;
    return Number(exact(b))-Number(exact(a));
  }).slice(0,15);
}
