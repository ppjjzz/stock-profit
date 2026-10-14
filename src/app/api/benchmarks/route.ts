import { NextResponse } from 'next/server';
import { validateSettings } from '@/lib/backtest';
import { benchmarks } from '@/lib/benchmarks';
import { getHistory, apiError } from '@/lib/longbridge';
export const runtime = 'nodejs';
export async function GET(request:Request) {
  const params=new URL(request.url).searchParams, start=params.get('start')||'', end=params.get('end')||'';
  try { validateSettings({symbols:['AAPL.US'],positions:[{symbol:'AAPL.US',inputMode:'amount',value:1}],start,end,plans:[]}); }
  catch(error) {return NextResponse.json({error:error instanceof Error?error.message:'日期区间无效'},{status:400});}
  const results=await Promise.allSettled(benchmarks.map(b=>getHistory(b.symbol,start,end,0)));
  const series=benchmarks.map((b,i)=>{
    const result=results[i];
    if(result.status==='rejected')return {...b,candles:[],error:apiError(result.reason)};
    if(!result.value.length)return {...b,candles:[],error:'所选区间没有指数行情，请检查长桥行情权限。'};
    return {...b,candles:result.value};
  });
  return NextResponse.json({start,end,series});
}
