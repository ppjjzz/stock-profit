'use client';
import { useState } from 'react';
import type { Stock, PositionConfig } from '@/lib/backtest';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArrowRight, Wallet, Info } from 'lucide-react';
export function StockConfigDialog({stock,config,switchingFrom,onClose,onSave}:{stock:Stock;config?:PositionConfig;switchingFrom?:string;onClose:()=>void;onSave:(config:PositionConfig)=>void}) {
  const [inputMode,setInputMode] = useState<'amount'|'shares'>(config?.inputMode || 'amount');
  const [value,setValue] = useState(String(config?.value ?? 5000));
  const [error,setError] = useState('');
  function save(event: React.FormEvent) {
    event.preventDefault();
    const initial = Number(value);
    if (!Number.isFinite(initial) || initial <= 0 || initial > 1e9) {setError('请输入大于 0 且不超过 10 亿的初始金额或股数');return;}
    onSave({symbol:stock.symbol,inputMode,value:initial});
  }
  return <Dialog open onOpenChange={open=>{if(!open)onClose();}}><DialogContent className="stock-dialog sm:max-w-[440px]">
    <DialogHeader><div className="dialog-eyebrow"><Wallet size={15}/> STOCK ALLOCATION</div><DialogTitle>{config?'编辑股票配置':'设置初始持仓'}</DialogTitle><DialogDescription>为这只股票设置独立的初始投入，保存后加入回测组合。</DialogDescription></DialogHeader>
    <div className="dialog-stock"><div><strong>{stock.name}</strong><span>{stock.symbol}</span></div><Badge variant="secondary">{stock.currency}</Badge></div>
    {switchingFrom?<div className="currency-switch-note" role="note"><Info size={15}/><p>当前组合使用 {switchingFrom}。保存后将切换为 {stock.currency} 组合，移除原有股票和定投计划；取消则保留原组合。不同币种不能直接相加。</p></div>:null}
    <form onSubmit={save} className="stock-config-form">
      <Label>初始投入方式</Label><Tabs value={inputMode} onValueChange={v=>{setInputMode(v as 'amount'|'shares');setValue('');setError('');}}><TabsList className="w-full"><TabsTrigger value="amount" className="flex-1">按金额投入</TabsTrigger><TabsTrigger value="shares" className="flex-1">按股数投入</TabsTrigger></TabsList></Tabs>
      <div className="dialog-field"><Label htmlFor="initial-value">{inputMode==='amount'?`初始投入金额（${stock.currency}）`:'初始投入股数'}</Label><Input id="initial-value" type="number" inputMode="decimal" min="0.000001" max="1000000000" step="any" value={value} onChange={e=>{setValue(e.target.value);setError('');}} placeholder={inputMode==='amount'?'例如 5000':'例如 100'} aria-invalid={!!error} aria-describedby="stock-config-help"/><p id="stock-config-help">{inputMode==='amount'?'首个可用交易日按收盘价换算持仓份额。':'按首个可用交易日前复权收盘价估算成本；此处股数为复权份额。'}</p></div>
      <div className="dialog-note"><Info size={14}/><span>使用前复权历史价格，未单独核算现金分红、税费或红利再投资。</span></div>
      {error?<p className="error-text" role="alert">{error}</p>:null}
      <DialogFooter><Button type="button" variant="outline" onClick={onClose}>取消</Button><Button type="submit">{config?'保存配置':switchingFrom?`切换为${stock.currency==='CNY'?'人民币':stock.currency==='HKD'?'港元':stock.currency==='USD'?'美元':stock.currency}组合并添加`:'添加到组合'}<ArrowRight size={14}/></Button></DialogFooter>
    </form>
  </DialogContent></Dialog>;
}
