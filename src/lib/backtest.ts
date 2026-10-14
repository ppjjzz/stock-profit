export type Stock = { symbol: string; name: string; currency: string };
export type Candle = { date: string; close: number };
export type PositionConfig = { symbol: string; inputMode: 'amount' | 'shares'; value: number };
export type ConfiguredStock = Stock & { config: PositionConfig };
export type RecurringPlan = { id: string; symbol: string; amount: number; frequency: 'day' | 'week' | 'biweek' | 'month'; weekday?: number; monthDay?: number };
export type ConfiguredPlan = RecurringPlan & { stock: Stock };
export type Settings = { symbols: string[]; positions: PositionConfig[]; plans: RecurringPlan[]; start: string; end: string };
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
  if (!Array.isArray(s.positions) || s.positions.length > s.symbols.length || new Set(s.positions.map(p => p?.symbol)).size !== s.positions.length) throw new Error('股票初始配置无效或重复');
  for (const p of s.positions) {
    if (!p || !s.symbols.includes(p.symbol) || !['amount', 'shares'].includes(p.inputMode)) throw new Error('股票初始配置无效');
    if (typeof p.value !== 'number' || !Number.isFinite(p.value) || p.value <= 0 || p.value > 1e9) throw new Error('初始金额或股数应大于 0 且不超过 10 亿');
  }
  if (!Array.isArray(s.plans) || s.plans.length > 32 || new Set(s.plans.map(p => p?.id)).size !== s.plans.length) throw new Error('定投计划无效、重复或超过 32 条');
  for (const p of s.plans) {
    if (!p || typeof p.id !== 'string' || !p.id || p.id.length > 100 || !s.symbols.includes(p.symbol) || !['day','week','biweek','month'].includes(p.frequency)) throw new Error('定投计划股票或频率无效');
    if (typeof p.amount !== 'number' || !Number.isFinite(p.amount) || p.amount <= 0 || p.amount > 1e9) throw new Error('定投金额应大于 0 且不超过 10 亿');
    if ((p.frequency === 'week' || p.frequency === 'biweek') && (!Number.isInteger(p.weekday) || p.weekday! < 1 || p.weekday! > 7)) throw new Error('请选择周一至周日的定投日期');
    if (p.frequency === 'month' && (!Number.isInteger(p.monthDay) || p.monthDay! < 1 || p.monthDay! > 31)) throw new Error('请选择每月 1–31 号的定投日期');
  }
  if (s.symbols.some(symbol => !s.positions.some(p => p.symbol === symbol) && !s.plans.some(p => p.symbol === symbol))) throw new Error('每只股票需要初始持仓或定投计划');
  return { symbols:s.symbols, positions:s.positions, plans:s.plans, start:s.start, end:s.end };
}

function dateKey(d: Date): string { return d.toISOString().slice(0,10); }
function monthDate(year: number, month: number, day: number): string {
  const last = new Date(Date.UTC(year,month+1,0)).getUTCDate();
  return dateKey(new Date(Date.UTC(year,month,Math.min(day,last))));
}
function firstDue(plan: RecurringPlan, start: string): string {
  const d = new Date(`${start}T00:00:00Z`);
  if (plan.frequency === 'month') {
    const due = monthDate(d.getUTCFullYear(),d.getUTCMonth(),plan.monthDay!);
    return due >= start ? due : monthDate(d.getUTCFullYear(),d.getUTCMonth()+1,plan.monthDay!);
  }
  if (plan.frequency !== 'day') d.setUTCDate(d.getUTCDate() + (plan.weekday! - (d.getUTCDay() || 7) + 7) % 7);
  return dateKey(d);
}
function nextDue(plan: RecurringPlan, date: string): string {
  const d = new Date(`${date}T00:00:00Z`);
  if (plan.frequency === 'month') return monthDate(d.getUTCFullYear(),d.getUTCMonth()+1,plan.monthDay!);
  d.setUTCDate(d.getUTCDate() + (plan.frequency === 'biweek' ? 14 : 7));
  return dateKey(d);
}
export function planScheduleLabel(plan: RecurringPlan): string {
  const weekdays = ['','周一','周二','周三','周四','周五','周六','周日'];
  if (plan.frequency === 'day') return '每日（交易日）';
  if (plan.frequency === 'month') return `每月 ${plan.monthDay} 号`;
  return `${plan.frequency === 'biweek' ? '每两周' : '每周'} · ${weekdays[plan.weekday!]}`;
}

export function calculateBacktest(settings: Settings, stocks: Stock[], history: Record<string, Candle[]>): Result {
  if (new Set(stocks.map(s => s.currency)).size !== 1) throw new Error('同一组合请选择同币种股票（不包含汇率换算）');
  const maps = Object.fromEntries(stocks.map(s => [s.symbol, new Map((history[s.symbol] || []).filter(c => c.date >= settings.start && c.date <= settings.end && c.close > 0 && Number.isFinite(c.close)).map(c => [c.date,c.close]))]));
  for (const s of stocks) if (!maps[s.symbol].size) throw new Error(`${s.name} 在所选区间没有有效行情`);
  const dates = [...new Set(stocks.flatMap(s => [...maps[s.symbol].keys()]))].sort();
  const shares: Record<string, number> = {}, prices: Record<string, number> = {}, contributions: Record<string, number> = {};
  stocks.forEach(s => { shares[s.symbol] = 0; contributions[s.symbol] = 0; });
  const configs = new Map(settings.positions.map(p => [p.symbol,p]));
  const schedules = new Map(stocks.map(s => [s.symbol, settings.plans.filter(p => p.symbol === s.symbol).map(plan => ({plan,due:firstDue(plan,settings.start)}))]));
  const points: Point[] = [];
  for (const date of dates) {
    for (const stock of stocks) {
      const symbol = stock.symbol, close = maps[symbol].get(date);
      if (close === undefined) continue;
      const firstAvailable = prices[symbol] === undefined;
      prices[symbol] = close;
      const purchase = (amount: number) => { shares[symbol] += amount / close; contributions[symbol] += amount; };
      const config = configs.get(symbol);
      if (firstAvailable && config) purchase(config.inputMode === 'shares' ? config.value * close : config.value);
      for (const schedule of schedules.get(symbol)!) {
        if (schedule.plan.frequency === 'day') {
          // Daily plans buy once per available trading day, with no weekend deposits.
          purchase(schedule.plan.amount);
        } else {
          // Calendar dates remain anchored even when execution rolls past a holiday.
          while (schedule.due <= date) {
            purchase(schedule.plan.amount);
            schedule.due = nextDue(schedule.plan,schedule.due);
            // A late first quote never charges a backlog of historical installments.
            if (firstAvailable) while (schedule.due <= date) schedule.due = nextDue(schedule.plan,schedule.due);
          }
        }
      }
    }
    const values = Object.fromEntries(stocks.map(s => [s.symbol, shares[s.symbol] * (prices[s.symbol] ?? 0)]));
    points.push({ date, total: Object.values(values).reduce((a,b)=>a+b,0), invested: Object.values(contributions).reduce((a,b)=>a+b,0), values, contributions: {...contributions}, shares: {...shares} });
  }
  if (!points.length) throw new Error('所选区间没有交易日');
  const warnings = stocks.flatMap(s => {
    const first = [...maps[s.symbol].keys()].sort()[0];
    return first > settings.start ? [`${s.name} 首个可用交易日为 ${first}，从该日开始投入；此前多期定投不累计补缴。`] : [];
  });
  return {stocks, points, settings, currency: stocks[0].currency, warnings};
}
