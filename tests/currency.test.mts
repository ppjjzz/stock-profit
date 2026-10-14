import assert from 'node:assert/strict';
import test from 'node:test';
import { conversionRate, parseExchangeRates } from '../src/lib/currency.ts';
import { GET } from '../src/app/api/exchange-rates/route.ts';

const rows=[{date:'2026-10-14',base:'USD',quote:'HKD',rate:8},{date:'2026-10-13',base:'USD',quote:'CNY',rate:7}];
test('Frankfurter rates retain currency-specific dates and support inverse and cross conversions',()=>{
 const data=parseExchangeRates(rows);
 assert.equal(data.dates.CNY,'2026-10-13');
 assert.equal(conversionRate(data,'USD','HKD'),8);
 assert.equal(conversionRate(data,'HKD','USD'),1/8);
 assert.equal(conversionRate(data,'CNY','HKD'),8/7);
 assert.equal(conversionRate(null,'CNY','CNY'),1);
 assert.equal(conversionRate(null,'CNY','USD'),null);
 assert.equal(conversionRate(data,'SGD','USD'),null);
});
test('missing, invalid and nonpositive exchange rates fail validation',()=>{
 for (const value of [null,{},[],rows.slice(0,1),[rows[0],{...rows[1],rate:0}],[rows[0],{...rows[1],rate:NaN}],[rows[0],{...rows[1],rate:'7'}]]) assert.throws(()=>parseExchangeRates(value));
});
test('exchange route requests Frankfurter with caching and handles provider failures',async()=>{
 const previousFetch=globalThis.fetch;
 try {
  globalThis.fetch=async(input,init)=>{
   assert.equal(String(input),'https://api.frankfurter.dev/v2/rates?base=USD&quotes=HKD,CNY');
   assert.equal((init as RequestInit & {next:{revalidate:number}}).next.revalidate,3600);
   assert.ok(init?.signal);
   return Response.json(rows);
  };
  assert.deepEqual(await (await GET()).json(),parseExchangeRates(rows));
  globalThis.fetch=async()=>Response.json({error:'unavailable'},{status:503});
  assert.equal((await GET()).status,502);
  globalThis.fetch=async()=>Response.json([]);
  assert.equal((await GET()).status,502);
 } finally {globalThis.fetch=previousFetch;}
});
