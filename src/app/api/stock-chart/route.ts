import { NextResponse } from 'next/server';
import { chartPeriods, type ChartPeriod } from '@/lib/stock-chart';
import { validateSettings } from '@/lib/backtest';
import { normalizeSymbol } from '@/lib/stock-search';
import { getStockChart, apiError } from '@/lib/longbridge';
export const runtime='nodejs';
export async function GET(request:Request) {
  const params=new URL(request.url).searchParams;
  const symbol=normalizeSymbol(params.get('symbol')||'');
  const period=params.get('period')||'day',start=params.get('start')||'',end=params.get('end')||'';
  if(!symbol||!chartPeriods.includes(period as ChartPeriod))return NextResponse.json({error:'股票代码或图表周期无效'},{status:400});
  if(period!=='intraday') {
    try {validateSettings({symbols:[symbol],positions:[{symbol,inputMode:'amount',value:1}],start,end,plans:[]});}
    catch(error){return NextResponse.json({error:error instanceof Error?error.message:'日期区间无效'},{status:400});}
  }
  try {
    const data=await getStockChart(symbol,period as ChartPeriod,start,end);
    return NextResponse.json(data);
  } catch(error){return NextResponse.json({error:apiError(error)},{status:502});}
}
