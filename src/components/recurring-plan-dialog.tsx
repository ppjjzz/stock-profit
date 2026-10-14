'use client';
import { useEffect, useState } from 'react';
import type { Stock, ConfiguredPlan, RecurringPlan } from '@/lib/backtest';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { CalendarClock, Check, Info, LoaderCircle, Search } from 'lucide-react';

export function RecurringPlanDialog({stocks,plan,currency,onClose,onSave}:{stocks:Stock[];plan?:ConfiguredPlan;currency?:string;onClose:()=>void;onSave:(plan:ConfiguredPlan)=>string|undefined}) {
  const [selected,setSelected] = useState<Stock|null>(plan?.stock || null);
  const [query,setQuery] = useState('');
  const [search,setSearch] = useState<{query:string;stocks:Stock[];error:string}|null>(null);
  const [frequency,setFrequency] = useState<RecurringPlan['frequency']>(plan?.frequency || 'month');
  const [weekday,setWeekday] = useState(plan?.weekday || 1);
  const [monthDay,setMonthDay] = useState(plan?.monthDay || 1);
  const [amount,setAmount] = useState(String(plan?.amount ?? 500));
  const [error,setError] = useState('');
  const term = query.trim();
  const busy = !!term && search?.query !== term;
  useEffect(()=>{
    if (!term) return;
    const controller = new AbortController();
    const timer = setTimeout(async()=>{
      try {
        const r = await fetch(`/api/stocks?q=${encodeURIComponent(term)}&market=all`,{signal:controller.signal});
        const data = await r.json();
        if (!controller.signal.aborted) setSearch({query:term,stocks:r.ok ? data.stocks || [] : [],error:data.error || ''});
      } catch(e) {
        if (!controller.signal.aborted) setSearch({query:term,stocks:[],error:e instanceof Error ? e.message : '搜索失败，请重试'});
      }
    },250);
    return ()=>{clearTimeout(timer);controller.abort();};
  },[term]);
  function choose(stock: Stock) { setSelected(stock);setError(''); }
  function save(event: React.FormEvent) {
    event.preventDefault();
    if (!selected) {setError('请选择定投股票');return;}
    const value = Number(amount);
    if (!Number.isFinite(value) || value <= 0 || value > 1e9) {setError('定投金额应大于 0 且不超过 10 亿');return;}
    const next: ConfiguredPlan = {id:plan?.id || crypto.randomUUID(),symbol:selected.symbol,stock:selected,frequency,amount:value,...(frequency==='month'?{monthDay}:frequency==='day'?{}:{weekday})};
    const message = onSave(next);
    if (message) setError(message);
  }
  function stockButton(stock: Stock) {
    const incompatible = !!currency && stock.currency !== currency;
    return <Button key={stock.symbol} type="button" variant="outline" className={selected?.symbol===stock.symbol?'plan-stock-option selected':'plan-stock-option'} aria-label={`选择${stock.name} ${stock.symbol}`} aria-pressed={selected?.symbol===stock.symbol} disabled={incompatible} onClick={()=>choose(stock)}><span><strong>{stock.name}</strong><small>{stock.symbol} · {stock.currency}{incompatible?' · 币种不匹配':''}</small></span>{selected?.symbol===stock.symbol?<Check size={16}/>:null}</Button>;
  }
  return <Dialog open onOpenChange={open=>{if(!open)onClose();}}><DialogContent className="stock-dialog recurring-dialog sm:max-w-[520px]">
    <DialogHeader><div className="dialog-eyebrow"><CalendarClock size={15}/> RECURRING PLAN</div><DialogTitle>{plan?'编辑定投计划':'添加定投计划'}</DialogTitle><DialogDescription>选择股票，设置每期金额和执行日期。初始持仓使用已添加股票的配置。</DialogDescription></DialogHeader>
    <form className="stock-config-form" onSubmit={save}>
      <div className="plan-stock-picker"><Label htmlFor="plan-stock-search">定投股票</Label><div className="searchbox"><Search size={16}/><Input id="plan-stock-search" placeholder="搜索名称或代码，如 茅台、AAPL.US" value={query} onChange={e=>setQuery(e.target.value)}/></div>
        {term?<div className="plan-search-results" aria-live="polite">{busy?<p><LoaderCircle size={14} className="spin"/> 正在搜索…</p>:search?.error?<p className="error-text" role="alert">{search.error}</p>:search?.stocks.length?search.stocks.map(stockButton):<p>没有匹配结果，试试完整股票代码</p>}</div>:null}
        {stocks.length && !term?<><p className="plan-picker-caption">从已添加的股票选择</p><div className="plan-stock-options">{stocks.map(stockButton)}</div></>:null}
        {selected?<div className="plan-selected-stock"><Check size={14}/><span>已选择：{selected.name} · {selected.symbol} · {selected.currency}</span></div>:null}
        {currency?<p className="plan-picker-caption">当前组合币种：{currency}，请选择同币种股票。</p>:null}
      </div>
      <div className="plan-schedule-fields"><div><Label htmlFor="plan-frequency">定投频率</Label><select id="plan-frequency" value={frequency} onChange={e=>setFrequency(e.target.value as RecurringPlan['frequency'])}><option value="day">每日</option><option value="month">每月</option><option value="week">每周</option><option value="biweek">每两周</option></select></div>
        {frequency==='month'?<div><Label htmlFor="plan-month-day">每月几号</Label><select id="plan-month-day" value={monthDay} onChange={e=>setMonthDay(Number(e.target.value))}>{Array.from({length:31},(_,i)=><option key={i+1} value={i+1}>{i+1} 号</option>)}</select></div>:frequency!=='day'?<div><Label htmlFor="plan-weekday">周几执行</Label><select id="plan-weekday" value={weekday} onChange={e=>setWeekday(Number(e.target.value))}>{['周一','周二','周三','周四','周五','周六','周日'].map((day,i)=><option key={day} value={i+1}>{day}</option>)}</select></div>:null}
      </div>
      <div className="dialog-field"><Label htmlFor="plan-amount">定投金额（{selected?.currency || currency || '股票币种'}）</Label><Input id="plan-amount" type="number" inputMode="decimal" min="0.000001" max="1000000000" step="any" value={amount} onChange={e=>{setAmount(e.target.value);setError('');}} placeholder="例如 500" aria-describedby="plan-schedule-help"/><p>每期按金额买入，允许小数份额。</p></div>
      <div className="dialog-note" id="plan-schedule-help"><Info size={14}/><span>{frequency==='day'?'从回测开始日起，每个可用交易日执行一次，休市日不扣款。':frequency==='month'?'从回测开始日起按所选日号执行；不足该日号的月份取月末，休市顺延到下一交易日。':`从回测开始日起遇到的第一个所选星期开始，之后每 ${frequency==='biweek'?'14':'7'} 天执行；休市顺延到下一交易日。`} 新搜索的股票可仅定投，无需设置初始持仓。</span></div>
      {error?<p className="error-text" role="alert">{error}</p>:null}
      <DialogFooter><Button type="button" variant="outline" onClick={onClose}>取消</Button><Button type="submit">{plan?'保存计划':'添加计划'}</Button></DialogFooter>
    </form>
  </DialogContent></Dialog>;
}
