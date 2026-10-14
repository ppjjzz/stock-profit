import { connection } from 'next/server';
import { recentYears } from '@/lib/dates';
import { BacktestWorkbench } from '@/components/backtest-workbench';

export default async function Page() {
  await connection();
  return <BacktestWorkbench initialRange={recentYears(1)}/>;
}
