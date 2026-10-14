'use client';

import { useState } from 'react';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import type { Point, Stock } from '@/lib/backtest';
import { Button } from '@/components/ui/button';

const colors = ['#7caeff','#c6a0fa','#ffbe79','#63d8c5','#ef85a9','#eecc60','#8dd1f0','#b6ed68'];
const money = (value: number) => new Intl.NumberFormat('zh-CN',{minimumFractionDigits:2,maximumFractionDigits:2}).format(value);

export function HoldingsPanel({stocks,point,currency,displayMoney}:{
  stocks: Stock[];
  point?: Point;
  currency: string;
  displayMoney: (value:number)=>string;
}) {
  const [view,setView] = useState<'table'|'chart'>('table');
  const holdings = stocks.map((stock,index)=>({
    ...stock,
    color: colors[index%colors.length],
    value: Math.max(0,point?.values[stock.symbol]??0),
    contribution: point?.contributions[stock.symbol]??0,
    shares: point?.shares[stock.symbol]??0,
  }));
  const total = holdings.reduce((sum,holding)=>sum+holding.value,0);
  const pieData = holdings.filter(holding=>holding.value>0);

  return <section className="holdings panel">
    <div className="holdings-heading">
      <div><h2>组合持仓</h2><span>{stocks.length} 只股票 <span className="separator">/</span> 独立配置</span></div>
      <div className="holdings-view-switch" role="group" aria-label="组合持仓展示方式">
        <Button type="button" variant="ghost" aria-pressed={view==='table'} onClick={()=>setView('table')}>表格</Button>
        <Button type="button" variant="ghost" aria-pressed={view==='chart'} onClick={()=>setView('chart')}>图表</Button>
      </div>
    </div>
    {view==='table'?<div className="table-wrap"><table><thead><tr><th>股票名称</th><th>持有份额</th><th>累计投入 <small>{currency}</small></th><th>当前市值 <small>{currency}</small></th><th>收益率</th></tr></thead><tbody>{holdings.map(holding=>{
      const rate=holding.contribution?(holding.value-holding.contribution)/holding.contribution*100:0;
      return <tr key={holding.symbol}><td><span className="table-dot" style={{background:holding.color}}/><strong>{holding.name}</strong><small>{holding.symbol}</small></td><td>{point?money(holding.shares):'—'}</td><td>{point?displayMoney(holding.contribution):'—'}</td><td>{point?displayMoney(holding.value):'—'}</td><td className={rate<0?'negative':'positive'}>{point?`${rate>=0?'+':''}${rate.toFixed(2)}%`:'—'}</td></tr>;
    })}</tbody></table></div>:total>0?<div className="holdings-chart">
      <div className="holdings-pie"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius="56%" outerRadius="86%" paddingAngle={pieData.length>1?2:0} stroke="none" isAnimationActive={false}>{pieData.map(holding=><Cell key={holding.symbol} fill={holding.color}/>)}</Pie><Tooltip contentStyle={{background:'var(--popover)',border:'1px solid var(--control-border)',borderRadius:8,color:'var(--foreground)',fontSize:11}} formatter={(value,name)=>[`${displayMoney(Number(value))} ${currency} · ${(Number(value)/total*100).toFixed(1)}%`,name]}/></PieChart></ResponsiveContainer><div className="holdings-pie-center"><span>组合市值</span><strong>{displayMoney(total)}</strong><small>{currency}</small></div></div>
      <ul className="holdings-chart-legend" aria-label="个股市值占比">{holdings.map(holding=><li key={holding.symbol}><span className="table-dot" style={{background:holding.color}}/><div><strong>{holding.name}</strong><small>{holding.symbol}</small></div><span className="holdings-chart-value">{displayMoney(holding.value)} <small>{currency}</small></span><b>{(holding.value/total*100).toFixed(1)}%</b></li>)}</ul>
    </div>:<div className="holdings-chart-empty">{point?'当前日期暂无持仓市值':'开始回测后查看个股市值占比'}</div>}
  </section>;
}
