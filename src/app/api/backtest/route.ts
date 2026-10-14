import { NextResponse } from 'next/server';
import { calculateBacktest, validateSettings } from '@/lib/backtest';
import { stockInfo, getHistory, apiError } from '@/lib/longbridge';
export const runtime = 'nodejs';
export async function POST(request: Request) {
  let settings;
  try { settings = validateSettings(await request.json()); } catch (error) { return NextResponse.json({error: error instanceof Error ? error.message : '参数无效'}, {status:400}); }
  let stocks, histories;
  try {
    [stocks, histories] = await Promise.all([stockInfo(settings.symbols), Promise.all(settings.symbols.map(s => getHistory(s,settings.start,settings.end)))]);
  } catch (error) { return NextResponse.json({error:apiError(error)},{status:502}); }
  try {
    if (stocks.length !== settings.symbols.length) throw new Error('部分股票代码无法识别');
    const data = calculateBacktest(settings,stocks,Object.fromEntries(settings.symbols.map((s,i)=>[s,histories[i]])));
    return NextResponse.json(data);
  } catch (error) { return NextResponse.json({error: error instanceof Error ? error.message : '回测计算失败'},{status:422}); }
}
