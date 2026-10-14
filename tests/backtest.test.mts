import assert from 'node:assert/strict';
import test from 'node:test';
import { calculateBacktest, validateSettings, type Settings } from '../src/lib/backtest.ts';
import { recentYears } from '../src/lib/dates.ts';
import { normalizeSymbol, filterStocks } from '../src/lib/stock-search.ts';
import { normalizeBenchmarks } from '../src/lib/benchmarks.ts';
const settings:Settings={symbols:['AAPL.US','MSFT.US'],positions:[{symbol:'AAPL.US',inputMode:'amount',value:500},{symbol:'MSFT.US',inputMode:'amount',value:500}],start:'2025-01-01',end:'2025-04-01',plans:[]};
const stocks=[{symbol:'AAPL.US',name:'苹果',currency:'USD'},{symbol:'MSFT.US',name:'微软',currency:'USD'}];
const single={symbols:['AAPL.US'],positions:[{symbol:'AAPL.US',inputMode:'amount' as const,value:1000}]};
test('per-stock amounts and holiday carry-forward retain correct portfolio value',()=>{
 const result=calculateBacktest(settings,stocks,{'AAPL.US':[{date:'2025-01-02',close:100},{date:'2025-01-03',close:120}], 'MSFT.US':[{date:'2025-01-02',close:50},{date:'2025-01-06',close:60}]});
 assert.equal(result.points.at(-1)!.total,1200);assert.equal(result.points.at(-1)!.invested,1000);assert.equal(result.points[1].values['MSFT.US'],500);
});
test('initial shares and different investment amounts are applied independently',()=>{
 const config={...settings,positions:[{symbol:'AAPL.US',inputMode:'shares' as const,value:10},{symbol:'MSFT.US',inputMode:'amount' as const,value:250}]};
 const result=calculateBacktest(config,stocks,{'AAPL.US':[{date:'2025-01-02',close:100},{date:'2025-01-03',close:120}], 'MSFT.US':[{date:'2025-01-02',close:50},{date:'2025-01-03',close:60}]});
 assert.equal(result.points[0].shares['AAPL.US'],10);assert.equal(result.points[0].invested,1250);assert.equal(result.points.at(-1)!.total,1500);
});
test('monthly plans preserve the 31st through short months and are independent of initial amounts',()=>{
 const result=calculateBacktest({...settings,...single,start:'2025-01-30',plans:[{id:'monthly',symbol:'AAPL.US',frequency:'month',monthDay:31,amount:100}]},[stocks[0]],{'AAPL.US':[{date:'2025-01-30',close:100},{date:'2025-01-31',close:100},{date:'2025-02-28',close:100},{date:'2025-03-28',close:100},{date:'2025-03-31',close:100},{date:'2025-04-01',close:100}]});
 assert.deepEqual(result.points.map(p=>p.invested),[1000,1100,1200,1200,1300,1300]);
});
test('weekly plans use the chosen weekday and roll holidays without moving their anchor',()=>{
 const result=calculateBacktest({...settings,...single,plans:[{id:'weekly',symbol:'AAPL.US',frequency:'week',weekday:5,amount:100}]},[stocks[0]],{'AAPL.US':[{date:'2025-01-02',close:100},{date:'2025-01-06',close:100},{date:'2025-01-09',close:100},{date:'2025-01-10',close:100}]});
 assert.deepEqual(result.points.map(p=>p.invested),[1000,1100,1100,1200]);
});
test('biweekly plans use first selected weekday on or after range start, then 14 day intervals',()=>{
 const result=calculateBacktest({...settings,...single,plans:[{id:'biweekly',symbol:'AAPL.US',frequency:'biweek',weekday:1,amount:100}]},[stocks[0]],{'AAPL.US':[{date:'2025-01-02',close:100},{date:'2025-01-06',close:100},{date:'2025-01-13',close:100},{date:'2025-01-21',close:100},{date:'2025-01-27',close:100},{date:'2025-02-03',close:100}]});
 assert.deepEqual(result.points.map(p=>p.invested),[1000,1100,1100,1200,1200,1300]);
});
test('daily plans run per-stock on trading days only, alongside share-based initial holdings',()=>{
 const result=calculateBacktest({...settings,positions:[{symbol:'AAPL.US',inputMode:'shares',value:2},{symbol:'MSFT.US',inputMode:'amount',value:300}],plans:[{id:'daily',symbol:'AAPL.US',frequency:'day',amount:100}]},stocks,{'AAPL.US':[{date:'2025-01-02',close:100},{date:'2025-01-06',close:200}],'MSFT.US':[{date:'2025-01-02',close:50},{date:'2025-01-03',close:100}]});
 assert.equal(result.points.at(-1)!.shares['AAPL.US'],3.5);assert.equal(result.points[1].contributions['AAPL.US'],300);assert.equal(result.points.at(-1)!.contributions['MSFT.US'],300);assert.equal(result.points.at(-1)!.invested,700);
});
test('plan-only stocks need no initial deposit and multiple plans execute independently',()=>{
 const config=validateSettings({...settings,positions:[settings.positions[0]],plans:[{id:'daily',symbol:'MSFT.US',frequency:'day',amount:50},{id:'weekly',symbol:'MSFT.US',frequency:'week',weekday:5,amount:100}]});
 const result=calculateBacktest(config,stocks,{'AAPL.US':[{date:'2025-01-02',close:100},{date:'2025-01-03',close:100}],'MSFT.US':[{date:'2025-01-02',close:50},{date:'2025-01-03',close:50}]});
 assert.equal(result.points[0].invested,550);assert.equal(result.points[1].invested,700);assert.equal(result.points[1].shares['MSFT.US'],4);
});
test('late first history avoids charging historical installment backlogs',()=>{
 const result=calculateBacktest({...settings,...single,plans:[{id:'weekly',symbol:'AAPL.US',frequency:'week',weekday:1,amount:100}]},[stocks[0]],{'AAPL.US':[{date:'2025-03-03',close:100},{date:'2025-03-10',close:100}]});
 assert.deepEqual(result.points.map(p=>p.invested),[1100,1200]);
});
test('mixed currencies and missing prices fail clearly',()=>{
 assert.throws(()=>calculateBacktest(settings,[stocks[0],{...stocks[1],currency:'HKD'}],{}),/同币种/);
 assert.throws(()=>calculateBacktest(settings,stocks,{'AAPL.US':[],'MSFT.US':[]}),/没有有效行情/);
});
test('invalid dates, uncovered stocks, duplicate securities and invalid plans are rejected',()=>{
 for(const patch of [{start:'2025-02-30'},{positions:[]},{positions:[{...single.positions[0],value:-1},settings.positions[1]]},{symbols:['AAPL.US','AAPL.US']},{end:'2024-01-01'}]) assert.throws(()=>validateSettings({...settings,...patch}));
 const valid={id:'weekly',symbol:'AAPL.US',frequency:'week',weekday:1,amount:100};
 for(const plan of [{...valid,amount:0},{...valid,amount:NaN},{...valid,symbol:'TSLA.US'},{...valid,weekday:0},{...valid,weekday:8},{...valid,weekday:1.5},{...valid,frequency:'month',monthDay:32},{...valid,frequency:'month'},{...valid,frequency:'year'}]) assert.throws(()=>validateSettings({...settings,plans:[plan]}));
 assert.throws(()=>validateSettings({...settings,plans:[valid,valid]}),/重复/);
 assert.equal(validateSettings({...settings,positions:[],plans:stocks.map((s,i)=>({id:String(i),symbol:s.symbol,frequency:'day',amount:100}))}).positions.length,0);
});
test('recent-year default uses Shanghai today and handles leap day',()=>{
 assert.deepEqual(recentYears(1,new Date('2026-10-13T16:30:00Z')),{start:'2025-10-14',end:'2026-10-14'});
 assert.deepEqual(recentYears(1,new Date('2024-02-29T04:00:00Z')),{start:'2023-02-28',end:'2024-02-29'});
});
test('A-share bare codes, HK padding and Chinese names are searchable',()=>{
 assert.equal(normalizeSymbol('600519'),'600519.SH');assert.equal(normalizeSymbol('300750'),'300750.SZ');assert.equal(normalizeSymbol('000001'),'000001.SZ');assert.equal(normalizeSymbol('00700.HK'),'700.HK');
 const list=[{symbol:'600519.SH',name:'贵州茅台',currency:'CNY'},...stocks];
 assert.equal(filterStocks(list,'茅台','CN')[0].symbol,'600519.SH');assert.equal(filterStocks(list,'6005','CN')[0].symbol,'600519.SH');assert.equal(filterStocks(list,'苹果','CN').length,0);
});
test('benchmark normalization never backfills future prices and retains dot-prefixed symbols',()=>{
 const points=normalizeBenchmarks([{symbol:'.SPX.US',name:'标普',color:'#fff',candles:[{date:'2025-01-02',close:100},{date:'2025-01-06',close:110}]},{symbol:'000300.SH',name:'沪深',color:'#aaa',candles:[{date:'2025-01-03',close:200},{date:'2025-01-06',close:180}]}]);
 assert.equal(points[0]['000300.SH'],undefined);assert.equal(points[1]['.SPX.US'],0);assert.ok(Math.abs(Number(points[2]['.SPX.US'])-10)<1e-8);assert.ok(Math.abs(Number(points[2]['000300.SH'])+10)<1e-8);
});


test('OHLC data is sorted, deduplicated and invalid price ranges are removed',async()=>{
 const {cleanOhlc,cleanIntraday}=await import('../src/lib/stock-chart.ts');
 const candle={date:'2025-01-02',open:10,high:12,low:9,close:11,volume:100};
 const rows=cleanOhlc([{...candle,date:'2025-01-03'},candle,{...candle,close:12},{...candle,date:'2025-01-04',high:8}]);
 assert.deepEqual(rows.map(r=>r.date),['2025-01-02','2025-01-03']);assert.equal(rows[0].close,12);
 const minute={time:200,price:10,average:10,volume:100};
 assert.deepEqual(cleanIntraday([minute,{...minute,time:100},{...minute,price:11},{...minute,time:300,price:NaN}]).map(p=>[p.time,p.price]),[[100,10],[200,11]]);
});
