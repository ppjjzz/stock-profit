export type Stock = { symbol: string; name: string; currency: string };
export type Candle = { date: string; close: number };
export type Settings = { symbols: string[]; start: string; end: string; amount: number; mode: 'once' | 'recurring'; frequency: 'week' | 'month' };
export type Point = { date: string; total: number; invested: number; values: Record<string, number>; contributions: Record<string, number>; shares: Record<string, number> };
export type Result = { stocks: Stock[]; points: Point[]; settings: Settings; currency: string; warnings: string[] };

export function validateSettings(value: unknown): Settings {
  if (!value || typeof value !== 'object') throw new Error('回测参数无效');
  const s = value as Settings;
  if (!Array.isArray(s.symbols) || !s.symbols.length || s.symbols.length > 8 || new Set(s.symbols).size !== s.symbols.length || s.symbols.some(x => typeof x !== 'string' || !/^[A-Z0-9.\-]{1,24}\.(US|HK|SH|SZ|SG)$/.test(x))) throw new Error('请选择 1–8 只有效且不重复的股票');
  const validDate = (x: string) => typeof x === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(x) && Number.isFinite(Date.parse(x)) && new Date(x).toISOString().slice(0,10) === x;
  if (!validDate(s.start) || !validDate(s.end) || s.start >= s.end) throw new Error('结束日期必须晚于开始日期');
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai' }).format(new Date());
  if (s.end > today || s.start < '1990-01-01') throw new Error('请选择 1990 年至今天之间的日期');
  if (Date.parse(s.end) - Date.parse(s.start) > 366 * 86400000 * 10) throw new Error('单次回测区间最多 10 年');
  if (typeof s.amount !== 'number' || !Number.isFinite(s.amount) || s.amount <= 0 || s.amount > 1e9) throw new Error('投入金额应大于 0 且不超过 10 亿');
  if (!['once', 'recurring'].includes(s.mode) || !['week', 'month'].includes(s.frequency)) throw new Error('投资模式无效');
  return s;
}

function nextDue(date: string, frequency: Settings['frequency']): string {
  const d = new Date(`${date}T00:00:00Z`);
  if (frequency === 'week') d.setUTCDate(d.getUTCDate() + 7);
  else {
    const day = d.getUTCDate();
    d.setUTCDate(1); d.setUTCMonth(d.getUTCMonth() + 1);
    const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
    d.setUTCDate(Math.min(day, last));
  }
  return d.toISOString().slice(0,10);
}

export function calculateBacktest(settings: Settings, stocks: Stock[], history: Record<string, Candle[]>): Result {
  if (new Set(stocks.map(s => s.currency)).size !== 1) throw new Error('同一组合请选择同币种股票（不包含汇率换算）');
  const maps = Object.fromEntries(stocks.map(s => [s.symbol, new Map(history[s.symbol].filter(c => c.close > 0 && Number.isFinite(c.close)).map(c => [c.date,c.close]))]));
  for (const s of stocks) if (!maps[s.symbol].size) throw new Error(`${s.name} 在所选区间没有有效行情`);
  const dates = [...new Set(stocks.flatMap(s => [...maps[s.symbol].keys()]))].filter(d => d >= settings.start && d <= settings.end).sort();
  const shares: Record<string, number> = {}, prices: Record<string, number> = {}, contributions: Record<string, number> = {}, due: Record<string, string> = {};
  stocks.forEach(s => { shares[s.symbol] = 0; contributions[s.symbol] = 0; due[s.symbol] = settings.start; });
  const points: Point[] = [];
  for (const date of dates) {
    for (const stock of stocks) {
      const symbol = stock.symbol, close = maps[symbol].get(date);
      if (close === undefined) continue;
      prices[symbol] = close;
      if (date >= due[symbol] && (settings.mode === 'recurring' || contributions[symbol] === 0)) {
        // Each scheduled deposit is executed on this stock's next trading day.
        do {
          const amount = settings.amount / stocks.length;
          shares[symbol] += amount / close; contributions[symbol] += amount;
          due[symbol] = settings.mode === 'once' ? '9999-12-31' : nextDue(due[symbol], settings.frequency);
        } while (due[symbol] <= date);
      }
    }
    const values = Object.fromEntries(stocks.map(s => [s.symbol, shares[s.symbol] * (prices[s.symbol] ?? 0)]));
    points.push({ date, total: Object.values(values).reduce((a,b)=>a+b,0), invested: Object.values(contributions).reduce((a,b)=>a+b,0), values, contributions: {...contributions}, shares: {...shares} });
  }
  if (!points.length) throw new Error('所选区间没有交易日');
  const warnings = stocks.flatMap(s => {
    const first = [...maps[s.symbol].keys()].sort()[0];
    return first > settings.start ? [`${s.name} 首个可用交易日为 ${first}，从该日开始投入。`] : [];
  });
  return {stocks, points, settings, currency: stocks[0].currency, warnings};
}
