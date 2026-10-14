export const displayCurrencies = ['USD', 'HKD', 'CNY'] as const;
export type DisplayCurrency = typeof displayCurrencies[number];
export type ExchangeRates = {
  rates: Record<DisplayCurrency, number>;
  dates: Record<'HKD' | 'CNY', string>;
};

export function parseExchangeRates(data: unknown): ExchangeRates {
  if (!Array.isArray(data)) throw new Error('汇率数据格式无效');
  const rates: ExchangeRates = {rates:{USD:1,HKD:0,CNY:0},dates:{HKD:'',CNY:''}};
  for (const currency of ['HKD','CNY'] as const) {
    const row = data.find(row=>row?.base==='USD'&&row?.quote===currency);
    if (!row || typeof row.rate!=='number' || !Number.isFinite(row.rate) || row.rate<=0 || typeof row.date!=='string' || !/^\d{4}-\d{2}-\d{2}$/.test(row.date)) throw new Error(`缺少有效的 ${currency} 汇率`);
    rates.rates[currency]=row.rate;
    rates.dates[currency]=row.date;
  }
  return rates;
}

export function conversionRate(data: ExchangeRates | null, base: string, quote: DisplayCurrency): number | null {
  if (base===quote) return 1;
  if (!data || !displayCurrencies.includes(base as DisplayCurrency)) return null;
  const from=data.rates[base as DisplayCurrency], to=data.rates[quote];
  return Number.isFinite(from)&&from>0&&Number.isFinite(to)&&to>0 ? to/from : null;
}
