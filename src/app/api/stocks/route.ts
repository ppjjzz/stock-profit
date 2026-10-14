import { NextResponse } from 'next/server';
import { catalog } from '@/lib/catalog';
import { stockInfo, getChinaStocks, apiError } from '@/lib/longbridge';
import { normalizeSymbol, filterStocks } from '@/lib/stock-search';
export const runtime = 'nodejs';
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const q = (params.get('q') || '').trim().slice(0,60);
  const market = params.get('market') || 'all';
  if (!['all','CN','US','HK'].includes(market)) return NextResponse.json({error:'市场无效',stocks:[]},{status:400});
  const symbol = normalizeSymbol(q);
  if (symbol) {
    try { const live = await stockInfo([symbol]); return NextResponse.json({stocks:filterStocks(live,'',market)}); }
    catch(error) { return NextResponse.json({stocks:[],error:apiError(error)},{status:502}); }
  }
  try {
    const cn = market==='CN' || (market==='all' && q) ? await getChinaStocks() : [];
    const universe = [...new Map([...catalog,...cn].map(s=>[s.symbol,s])).values()];
    return NextResponse.json({stocks:filterStocks(universe,q,market)});
  } catch(error) {
    return NextResponse.json({stocks:filterStocks(catalog,q,market),error:`A 股完整列表暂时不可用。${apiError(error)} 可尝试完整代码。`},{status:502});
  }
}
