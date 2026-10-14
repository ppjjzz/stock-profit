'use client';
import { memo, useMemo, useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import type { Result } from '@/lib/backtest';
import { aggregateIncomePeriods, buildIncomeCalendar, monthCells } from '@/lib/income-calendar';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const number=(value:number)=>new Intl.NumberFormat('zh-CN',{minimumFractionDigits:2,maximumFractionDigits:2}).format(value);
const signed=(value:number)=>`${value>0?'+':''}${number(value)}`;
const tone=(value:number)=>value>0?'gain':value<0?'loss':'flat';
const monthLabel=(month:string)=>`${Number(month.slice(0,4))}年 ${Number(month.slice(5))}月`;

export const IncomeCalendar = memo(function IncomeCalendar({result,currency,exchangeFactor}:{result:Result|null;currency:string;exchangeFactor:number|null}) {
  return result?<IncomeCalendarContent result={result} currency={currency} exchangeFactor={exchangeFactor}/>:<div className="calendar-empty"><CalendarDays size={30}/><h3>开始回测，查看每天的投资收益</h3><p>收益日历展示完整回测结果，不随回放动画变化。</p></div>;
});

function IncomeCalendarContent({result,currency,exchangeFactor}:{result:Result;currency:string;exchangeFactor:number|null}) {
  const days=useMemo(()=>buildIncomeCalendar(result),[result]);
  const dayMap=useMemo(()=>new Map(days.map(day=>[day.date,day])),[days]);
  const months=useMemo(()=>[...new Set(days.map(day=>day.date.slice(0,7)))],[days]);
  const monthly=useMemo(()=>aggregateIncomePeriods(days,'month'),[days]);
  const yearly=useMemo(()=>aggregateIncomePeriods(days,'year'),[days]);
  const years=useMemo(()=>yearly.map(period=>period.key),[yearly]);
  const latest=result.points.at(-1)?.date||'';
  const [view,setView]=useState('day');
  const [year,setYear]=useState(latest.slice(0,4));
  const [month,setMonth]=useState(latest.slice(0,7));
  const [date,setDate]=useState(latest);
  const [unit,setUnit]=useState('amount');
  const [sort,setSort]=useState('desc');
  const currentMonth=months.includes(month)?month:months.at(-1)||'';
  const selectedDate=dayMap.has(date)&&date.startsWith(currentMonth)?date:days.find(day=>day.date.startsWith(currentMonth))?.date||latest;
  const currentYear=years.includes(year)?year:years.at(-1)||'';
  const selectedMonth=currentMonth.startsWith(currentYear)?currentMonth:months.find(m=>m.startsWith(currentYear))||'';
  const selected=view==='day'?dayMap.get(selectedDate):view==='month'?monthly.find(p=>p.key===selectedMonth):yearly.find(p=>p.key===currentYear);
  const detailKey=view==='day'?selectedDate:view==='month'?selectedMonth:currentYear;
  const periodName=view==='day'?'当日':view==='month'?'当月':'当年';
  const yearIndex=years.indexOf(currentYear);
  const navigate= view==='day'?months:years;
  const navigateIndex=view==='day'?months.indexOf(currentMonth):yearIndex;
  const changeYear=(next:string)=>{setYear(next);const first=months.find(m=>m.startsWith(next));if(first)changeMonth(first);};
  const cells=useMemo(()=>currentMonth?monthCells(currentMonth):[],[currentMonth]);
  const monthProfit=useMemo(()=>days.filter(day=>day.date.startsWith(currentMonth)).reduce((sum,day)=>sum+day.profit,0),[days,currentMonth]);
  const summaryProfit=view==='day'?monthProfit:view==='month'?yearly.find(p=>p.key===currentYear)?.profit||0:yearly.reduce((sum,p)=>sum+p.profit,0);
  const summaryLabel=view==='day'?'本月收益':view==='month'?'本年收益':'区间收益';
  const holdings=useMemo(()=>selected?.holdings.toSorted((a,b)=>sort==='desc'?b.profit-a.profit:a.profit-b.profit)||[],[selected,sort]);
  const amount=(value:number)=>exchangeFactor===null?'—':signed(value*exchangeFactor);
  const changeMonth=(next:string)=>{setMonth(next);setYear(next.slice(0,4));setDate(days.find(day=>day.date.startsWith(next))?.date||latest);};
  return <div className="income-calendar">
    <div className="calendar-topline"><div><span>{summaryLabel} <small>{currency}</small></span><strong className={`calendar-${tone(summaryProfit)}`}>{amount(summaryProfit)}</strong></div><div className="calendar-view-controls"><Tabs value={view} onValueChange={setView}><TabsList aria-label="收益日历粒度"><TabsTrigger value="day">日</TabsTrigger><TabsTrigger value="month">月</TabsTrigger><TabsTrigger value="year">年</TabsTrigger></TabsList></Tabs><Tabs value={unit} onValueChange={setUnit}><TabsList aria-label="日历收益单位"><TabsTrigger value="amount">金额 · {currency}</TabsTrigger><TabsTrigger value="percent">收益率 · %</TabsTrigger></TabsList></Tabs></div></div>
    {view!=='year'?<div className="calendar-navigation"><Button variant="outline" size="icon-sm" aria-label={view==='day'?'上个月':'上一年'} disabled={navigateIndex<=0} onClick={()=>view==='day'?changeMonth(navigate[navigateIndex-1]):changeYear(navigate[navigateIndex-1])}><ChevronLeft size={17}/></Button><Select value={view==='day'?currentMonth:currentYear} onValueChange={view==='day'?changeMonth:changeYear}><SelectTrigger aria-label={view==='day'?'收益日历月份':'收益日历年份'}><SelectValue/></SelectTrigger><SelectContent>{navigate.map(key=><SelectItem key={key} value={key}>{view==='day'?monthLabel(key):`${key}年`}</SelectItem>)}</SelectContent></Select><Button variant="outline" size="icon-sm" aria-label={view==='day'?'下个月':'下一年'} disabled={navigateIndex>=navigate.length-1} onClick={()=>view==='day'?changeMonth(navigate[navigateIndex+1]):changeYear(navigate[navigateIndex+1])}><ChevronRight size={17}/></Button></div>:<div className="calendar-year-range">{years[0]} — {years.at(-1)}年</div>}
    {view==='day'?<>
    <div className="calendar-weekdays" aria-hidden="true">{['日','一','二','三','四','五','六'].map(day=><span key={day}>{day}</span>)}</div>
    <div className="calendar-grid" role="group" aria-label={`${monthLabel(currentMonth)}收益日历`}>{cells.map((cell,index)=>{
      if(!cell)return <div className="calendar-spacer" key={`empty-${index}`}/>;
      const day=dayMap.get(cell),value=unit==='percent'?day?.rate:day?.profit;
      const label=day?unit==='percent'?(day.rate===null?'—':`${signed(day.rate)}%`):amount(day.profit):'—';
      return <Button variant="ghost" key={cell} className={`calendar-day calendar-${day?tone(value??0):'outside'} ${selectedDate===cell?'calendar-selected':''}`} disabled={!day} aria-label={`${cell} ${day?'当日收益 '+label:'不在回测区间'}`} aria-pressed={selectedDate===cell} onClick={()=>setDate(cell)}><span className="calendar-day-number">{Number(cell.slice(8))}</span><strong>{label}</strong>{day&&!day.trading?<small>休市</small>:null}</Button>;
    })}</div>
    </>:<div className="calendar-grid calendar-period-grid" role="group" aria-label={view==='month'?`${currentYear}年月度收益`:'年度收益'}>{(view==='month'?Array.from({length:12},(_,i)=>`${currentYear}-${String(i+1).padStart(2,'0')}`):years).map(key=>{
      const period=(view==='month'?monthly:yearly).find(period=>period.key===key);
      const value=unit==='percent'?period?.rate:period?.profit;
      const label=period?unit==='percent'?(period.rate===null?'—':`${signed(period.rate)}%`):amount(period.profit):'—';
      return <Button variant="ghost" key={key} className={`calendar-day calendar-${period?tone(value??0):'outside'} ${detailKey===key?'calendar-selected':''}`} disabled={!period} aria-label={`${key} ${period?periodName+'收益 '+label:'不在回测区间'}`} aria-pressed={detailKey===key} onClick={()=>view==='month'?changeMonth(key):setYear(key)}><span className="calendar-day-number">{view==='month'?`${Number(key.slice(5))}月`:`${key}年`}</span><strong>{label}</strong></Button>;
    })}</div>}
    <div className="calendar-detail-heading"><div><h3>{periodName}收益明细 <small>{detailKey}</small></h3><p>{periodName}收益 <span className={`calendar-${tone(selected?.profit??0)}`}>{amount(selected?.profit??0)} {currency}</span></p></div><Select value={sort} onValueChange={setSort}><SelectTrigger aria-label={`${periodName}收益排序`}><SelectValue/></SelectTrigger><SelectContent><SelectItem value="desc">收益从高到低</SelectItem><SelectItem value="asc">收益从低到高</SelectItem></SelectContent></Select></div>
    {holdings.length?<div className="table-wrap calendar-holdings"><table><thead><tr><th>持仓股票</th><th>{periodName}收益 <small>{currency}</small></th><th>{periodName}涨跌幅</th></tr></thead><tbody>{holdings.map(holding=><tr key={holding.symbol}><td><strong>{holding.name}</strong><small>{holding.symbol}</small>{holding.newPosition?<span className="calendar-new-position">首次买入</span>:null}</td><td className={`calendar-${tone(holding.profit)}`}>{amount(holding.profit)}</td><td className={`calendar-${tone(holding.change??0)}`}>{holding.change===null?'—':`${signed(holding.change)}%`}</td></tr>)}</tbody></table></div>:<p className="calendar-no-holdings">{periodName}暂无持仓。</p>}
    <p className="calendar-note">每日收益 = 当日市值 − 前一交易日市值 − 当日新增投入。日收益率按前一交易日组合市值计算；个股涨跌幅按前复权价格计算，首次买入不展示涨跌幅。月、年收益为期间每日收益之和，收益率按日收益率复合计算；仅统计回测区间内的数据。休市日收益为 0，日历独立于回放动画。</p>
  </div>;
}
