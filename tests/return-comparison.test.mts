import assert from 'node:assert/strict';
import test from 'node:test';
import { compareReturns } from '../src/lib/benchmarks.ts';
import type { Point } from '../src/lib/backtest.ts';
const point=(date:string,total:number,invested:number):Point=>({date,total,invested,values:{TEST:total},contributions:{TEST:invested},shares:{TEST:10}});
test('returns deduct contributions, carry holiday prices and report excess in percentage points',()=>{
 const points=[point('2025-10-13',1000,1000),point('2025-10-14',1200,1000),point('2025-10-15',1700,1500)];
 const data=compareReturns(points,'total',[{date:'2025-10-15',close:110},{date:'2025-10-13',close:100},{date:'2025-10-16',close:1000}]);
 assert.equal(data[0].mine,0);assert.equal(data[0].benchmark,0);
 assert.equal(data[1].mine,20);assert.equal(data[1].benchmark,0);assert.equal(data[1].outperformance,20);
 assert.ok(Math.abs(data[2].mine!-200/1500*100)<1e-9);
 assert.ok(Math.abs(data[2].benchmark!-10)<1e-9);
 assert.ok(Math.abs(data[2].outperformance!-(200/1500*100-10))<1e-9);
});
test('late-funded stock starts its benchmark at funding and future or absent prices stay unavailable',()=>{
 const points=[point('2025-10-13',0,0),point('2025-10-14',1000,1000),point('2025-10-15',900,1000)];
 const data=compareReturns(points,'TEST',[{date:'2025-10-13',close:80},{date:'2025-10-14',close:100},{date:'2025-10-15',close:110}]);
 assert.equal(data[0].mine,null);assert.equal(data[0].benchmark,null);
 assert.equal(data[1].benchmark,0);
 assert.ok(Math.abs(data[2].outperformance!+20)<1e-9);
 const delayed=compareReturns(points,'TEST',[{date:'2025-10-15',close:100}]);
 assert.equal(delayed[1].benchmark,null);assert.equal(delayed[1].outperformance,null);assert.equal(delayed[2].benchmark,0);
 const missing=compareReturns(points,'total',[]);
 assert.equal(missing[2].mine,-10);assert.equal(missing[2].benchmark,null);assert.equal(missing[2].outperformance,null);
});
