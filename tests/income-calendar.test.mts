import assert from 'node:assert/strict';
import test from 'node:test';
import { calculateBacktest } from '../src/lib/backtest.ts';
import { aggregateIncomePeriods, buildIncomeCalendar, monthCells } from '../src/lib/income-calendar.ts';

test('daily profit removes new deposits and individual changes use prices rather than invested amounts',()=>{
 const result=calculateBacktest({symbols:['A.US','B.US'],positions:[{symbol:'A.US',inputMode:'amount',value:1000},{symbol:'B.US',inputMode:'amount',value:1000}],plans:[{id:'daily',symbol:'A.US',amount:500,frequency:'day'}],start:'2026-09-01',end:'2026-09-06'},[{symbol:'A.US',name:'A',currency:'USD'},{symbol:'B.US',name:'B',currency:'USD'}],{'A.US':[{date:'2026-09-01',close:100},{date:'2026-09-02',close:110},{date:'2026-09-04',close:100}],'B.US':[{date:'2026-09-01',close:100},{date:'2026-09-02',close:90},{date:'2026-09-04',close:100}]});
 const days=buildIncomeCalendar(result);
 assert.equal(days.length,6);
 assert.equal(days[0].profit,0);assert.equal(days[0].holdings[0].change,null);assert.equal(days[0].holdings[0].newPosition,true);
 assert.equal(days[1].profit,50);assert.equal(days[1].rate,2);
 assert.equal(days[1].holdings[0].profit,150);assert.equal(days[1].holdings[1].profit,-100);
 assert.ok(Math.abs(days[1].holdings[0].change!-10)<1e-9);
 assert.equal(days[2].trading,false);assert.equal(days[2].profit,0);assert.equal(days[2].holdings[0].change,0);
 assert.ok(days[3].profit<0);
 assert.equal(days[5].profit,0);assert.equal(days[5].holdings.length,2);
 assert.ok(Math.abs(days.reduce((sum,day)=>sum+day.profit,0)-(result.points.at(-1)!.total-result.points.at(-1)!.invested))<1e-7);
});
test('unfunded days have no holdings and late purchases never count deposits as profit',()=>{
 const result=calculateBacktest({symbols:['A.US'],positions:[],plans:[{id:'weekly',symbol:'A.US',amount:1000,frequency:'week',weekday:4}],start:'2026-09-01',end:'2026-09-04'},[{symbol:'A.US',name:'A',currency:'USD'}],{'A.US':[{date:'2026-09-01',close:100},{date:'2026-09-03',close:120},{date:'2026-09-04',close:132}]});
 const days=buildIncomeCalendar(result);
 assert.equal(days[0].rate,null);assert.equal(days[0].holdings.length,0);
 assert.equal(days[2].profit,0);assert.equal(days[2].holdings[0].newPosition,true);
 assert.equal(days[2].holdings[0].change,null);
 assert.ok(Math.abs(days[3].profit-100)<1e-7);
});
test('month grid aligns Sunday columns and accounts for leap years and year boundaries',()=>{
 const september=monthCells('2026-09');
 assert.deepEqual(september.slice(0,3),[null,null,'2026-09-01']);
 assert.equal(september.length,35);
 assert.equal(monthCells('2024-02').filter(Boolean).length,29);
 assert.equal(monthCells('2025-02').filter(Boolean).length,28);
 assert.equal(monthCells('2026-12').filter(Boolean).at(-1),'2026-12-31');
});


test('monthly and yearly aggregation sums cash profit, compounds rates and respects year boundaries',()=>{
 const holding={symbol:'A.US',name:'A',currency:'USD',shares:10,value:1000,newPosition:false};
 const days=[
  {date:'2025-12-31',profit:100,rate:10,trading:true,holdings:[{...holding,profit:100,change:10}]},
  {date:'2026-01-01',profit:0,rate:0,trading:false,holdings:[{...holding,profit:0,change:0}]},
  {date:'2026-01-02',profit:100,rate:10,trading:true,holdings:[{...holding,profit:100,change:10}]},
  {date:'2026-01-03',profit:-110,rate:-10,trading:true,holdings:[{...holding,profit:-110,change:-10}]},
  {date:'2026-02-01',profit:20,rate:2,trading:true,holdings:[{...holding,profit:20,change:2}]},
 ];
 const monthly=aggregateIncomePeriods(days,'month');
 assert.deepEqual(monthly.map(p=>p.key),['2025-12','2026-01','2026-02']);
 assert.equal(monthly[1].profit,-10);assert.ok(Math.abs(monthly[1].rate!+1)<1e-9);
 assert.equal(monthly[1].holdings[0].profit,-10);assert.ok(Math.abs(monthly[1].holdings[0].change!+1)<1e-9);
 const yearly=aggregateIncomePeriods(days,'year');
 assert.deepEqual(yearly.map(p=>p.key),['2025','2026']);assert.equal(yearly[1].profit,10);
 assert.ok(Math.abs(yearly[1].rate!-0.98)<1e-9);
 assert.equal(yearly[1].holdings[0].profit,10);
 const unfunded=aggregateIncomePeriods([{date:'2026-01-01',profit:0,rate:null,trading:false,holdings:[]}],'month');
 assert.equal(unfunded[0].rate,null);assert.equal(unfunded[0].holdings.length,0);
});
