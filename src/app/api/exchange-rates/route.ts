import { parseExchangeRates } from '@/lib/currency';

export async function GET() {
  try {
    const response=await fetch('https://api.frankfurter.dev/v2/rates?base=USD&quotes=HKD,CNY', {
      next:{revalidate:3600}, signal:AbortSignal.timeout(10000),
    });
    if (!response.ok) throw new Error('汇率服务暂时不可用');
    return Response.json(parseExchangeRates(await response.json()));
  } catch {
    return Response.json({error:'无法获取 Frankfurter 汇率，请重试'}, {status:502});
  }
}
