import type { Point, Result, Stock } from './backtest';

export type DailyHolding = Stock & {profit:number;change:number|null;shares:number;value:number;newPosition:boolean};
export type IncomeDay = {date:string;profit:number;rate:number|null;trading:boolean;holdings:DailyHolding[]};
export type IncomePeriod = {key:string;profit:number;rate:number|null;holdings:DailyHolding[]};
const clean=(value:number)=>Math.abs(value)<1e-7?0:value;

export function buildIncomeCalendar(result:Result):IncomeDay[] {
  if (!result.points.length) return [];
  const start=result.settings.start||result.points[0].date;
  const end=result.settings.end||result.points.at(-1)!.date;
  const points=new Map(result.points.map(point=>[point.date,point]));
  const days:IncomeDay[]=[];
  let previous:Point|undefined;
  for (const cursor=new Date(`${start}T00:00:00Z`);cursor.toISOString().slice(0,10)<=end;cursor.setUTCDate(cursor.getUTCDate()+1)) {
    const date=cursor.toISOString().slice(0,10),point=points.get(date),current=point||previous;
    const holdings=result.stocks.flatMap(stock=>{
      const symbol=stock.symbol,shares=current?.shares[symbol]??0,previousShares=previous?.shares[symbol]??0;
      if(shares<=0&&previousShares<=0)return [];
      const value=current?.values[symbol]??0,previousValue=previous?.values[symbol]??0;
      const contribution=current?.contributions[symbol]??0,previousContribution=previous?.contributions[symbol]??0;
      const profit=point?clean(value-previousValue-(contribution-previousContribution)):0;
      const price=shares>0?value/shares:null,previousPrice=previousShares>0?previousValue/previousShares:null;
      const change=previousPrice!==null&&previousPrice>0&&price!==null?clean((price/previousPrice-1)*100):null;
      return [{...stock,shares,value,profit,change,newPosition:!!point&&previousShares===0&&shares>0}];
    });
    const profit=clean(holdings.reduce((sum,holding)=>sum+holding.profit,0));
    const rate=previous&&previous.total>0?clean(profit/previous.total*100):current&&current.invested>0?0:null;
    days.push({date,profit,rate,trading:!!point,holdings});
    if(point)previous=point;
  }
  return days;
}

export function monthCells(month:string) {
  const [year,index]=month.split('-').map(Number);
  const offset=new Date(Date.UTC(year,index-1,1)).getUTCDay();
  const count=new Date(Date.UTC(year,index,0)).getUTCDate();
  const cells:(string|null)[]=Array(offset).fill(null);
  for(let day=1;day<=count;day++)cells.push(`${month}-${String(day).padStart(2,'0')}`);
  while(cells.length%7)cells.push(null);
  return cells;
}

export function aggregateIncomePeriods(days:IncomeDay[],unit:'month'|'year'):IncomePeriod[] {
  const groups=new Map<string,IncomeDay[]>();
  for(const day of days) {
    const key=day.date.slice(0,unit==='month'?7:4);
    const group=groups.get(key)||[];
    group.push(day);groups.set(key,group);
  }
  return [...groups].map(([key,group])=>{
    const holdings=new Map<string,{last:DailyHolding;profit:number;growth:number;hasChange:boolean}>();
    let profit=0,growth=1,hasRate=false;
    for(const day of group) {
      profit+=day.profit;
      if(day.rate!==null){growth*=1+day.rate/100;hasRate=true;}
      for(const holding of day.holdings) {
        const aggregate=holdings.get(holding.symbol)||{last:holding,profit:0,growth:1,hasChange:false};
        aggregate.last=holding;aggregate.profit+=holding.profit;
        if(holding.change!==null){aggregate.growth*=1+holding.change/100;aggregate.hasChange=true;}
        holdings.set(holding.symbol,aggregate);
      }
    }
    return {key,profit:clean(profit),rate:hasRate?clean((growth-1)*100):null,holdings:[...holdings.values()].map(h=>({...h.last,profit:clean(h.profit),change:h.hasChange?clean((h.growth-1)*100):null,newPosition:false}))};
  });
}
