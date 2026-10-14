import assert from 'node:assert/strict';
import test from 'node:test';
import { JSDOM } from 'jsdom';
const dom=new JSDOM('<!doctype html><html><body></body></html>',{url:'http://localhost:3000',pretendToBeVisual:true});
const {window}=dom;
globalThis.self=window;
globalThis.NodeFilter=window.NodeFilter;
globalThis.requestAnimationFrame=window.requestAnimationFrame.bind(window);
globalThis.cancelAnimationFrame=window.cancelAnimationFrame.bind(window);
for(const name of Object.getOwnPropertyNames(window).filter(name=>/^(HTML|SVG).*Element$/.test(name))) globalThis[name]=window[name];
Object.assign(globalThis,{window,document:window.document,HTMLElement:window.HTMLElement,Element:window.Element,Node:window.Node,DocumentFragment:window.DocumentFragment,MutationObserver:window.MutationObserver,CustomEvent:window.CustomEvent,Event:window.Event,getComputedStyle:window.getComputedStyle,IS_REACT_ACT_ENVIRONMENT:true});
Object.defineProperty(globalThis,'navigator',{value:window.navigator,configurable:true});
class ResizeObserverMock {observe(){}unobserve(){}disconnect(){}}
globalThis.ResizeObserver=ResizeObserverMock;
window.ResizeObserver=ResizeObserverMock;
window.HTMLElement.prototype.scrollIntoView=function(){};
const React=await import('react');
const {render,fireEvent,waitFor,cleanup}=await import('@testing-library/react');
const {BacktestWorkbench}=await import('../src/components/backtest-workbench.tsx');
const {StockChartDialog}=await import('../src/components/stock-chart-dialog.tsx');
const candidates=[{symbol:'600519.SH',name:'贵州茅台',currency:'CNY'},{symbol:'700.HK',name:'腾讯控股',currency:'HKD'}];
globalThis.fetch=async url=>{
 const params=new URL(String(url),'http://localhost').searchParams;
 if(String(url).includes('/api/benchmarks'))return Response.json({start:params.get('start'),end:params.get('end'),series:[]});
 if(String(url).includes('/api/stock-chart'))return Response.json({symbol:params.get('symbol'),period:params.get('period'),timezone:'Asia/Shanghai',candles:[],intraday:[]});
 return Response.json({stocks:candidates.filter(s=>`${s.name} ${s.symbol}`.includes(params.get('q')||''))});
};
for(const stock of candidates)test(`${stock.currency}: selecting stock opens dialog; cancel preserves and saving switches portfolio`,async()=>{
 const view=render(React.createElement(BacktestWorkbench,{initialRange:{start:'2025-10-13',end:'2026-10-13'}}));
 try {
  const search=view.getByLabelText('选择股票');fireEvent.focus(search);fireEvent.change(search,{target:{value:stock.name}});
  await waitFor(()=>assert.ok(view.getByRole('button',{name:new RegExp(stock.name)})));
  fireEvent.click(view.getByRole('button',{name:new RegExp(stock.name)}));
  assert.ok(view.getByRole('dialog'));assert.ok(view.getByText('设置初始持仓'));assert.match(view.getByRole('note').textContent,new RegExp(stock.currency));
  fireEvent.click(view.getByRole('button',{name:'取消'}));
  await waitFor(()=>assert.equal(view.queryByRole('dialog'),null));
  assert.ok(view.getByRole('button',{name:'编辑苹果配置'}));
  fireEvent.focus(search);
  await waitFor(()=>assert.ok(view.getByRole('button',{name:new RegExp(stock.name)})));
  fireEvent.click(view.getByRole('button',{name:new RegExp(stock.name)}));
  fireEvent.change(view.getByLabelText(`初始投入金额（${stock.currency}）`),{target:{value:'8000'}});
  fireEvent.click(view.getByRole('button',{name:stock.currency==='CNY'?'切换为人民币组合并添加':'切换为港元组合并添加'}));
  await waitFor(()=>assert.equal(view.queryByRole('dialog'),null));
  assert.ok(view.getByRole('button',{name:`编辑${stock.name}配置`}));
  assert.ok(view.getByRole('button',{name:`查看${stock.name}K线`}));
  assert.equal(view.queryByRole('button',{name:'编辑苹果配置'}),null);
 } finally {cleanup();}
});
test('stock chart dialog offers intraday/day/month/quarter/year switches',async()=>{
 const view=render(React.createElement(StockChartDialog,{stock:candidates[0],start:'2025-10-13',end:'2026-10-13',onClose:()=>{}}));
 try {
  for(const label of ['分时','日','月','季','年'])assert.ok(view.getByRole('tab',{name:label}));
  fireEvent.mouseDown(view.getByRole('tab',{name:'分时'}),{button:0,ctrlKey:false});
  await waitFor(()=>assert.equal(view.getByRole('tab',{name:'分时'}).getAttribute('aria-selected'),'true'));
  await waitFor(()=>assert.ok(view.getByText('该股票暂无最新交易日分时数据')));
 } finally {cleanup();}
});

test('recurring plan form selects an existing stock, switches schedule fields, and supports edit/delete',async()=>{
 const view=render(React.createElement(BacktestWorkbench,{initialRange:{start:'2025-10-13',end:'2026-10-13'}}));
 try {
  assert.equal(view.queryByRole('tab',{name:'一次性投入'}),null);
  assert.equal(view.queryByText('初始投入合计'),null);
  fireEvent.click(view.getByRole('button',{name:'添加定投计划'}));
  assert.ok(view.getByRole('dialog'));
  fireEvent.click(view.getByRole('button',{name:/苹果 AAPL.US/}));
  const frequency=view.getByLabelText('定投频率');
  assert.equal(view.getByLabelText('每月几号').value,'1');
  fireEvent.change(frequency,{target:{value:'day'}});
  assert.equal(view.queryByLabelText('每月几号'),null);assert.equal(view.queryByLabelText('周几执行'),null);
  fireEvent.change(frequency,{target:{value:'week'}});
  assert.ok(view.getByLabelText('周几执行'));
  fireEvent.change(frequency,{target:{value:'biweek'}});
  fireEvent.change(view.getByLabelText('周几执行'),{target:{value:'5'}});
  fireEvent.change(view.getByLabelText('定投金额（USD）'),{target:{value:'800'}});
  fireEvent.click(view.getByRole('button',{name:'添加计划'}));
  await waitFor(()=>assert.equal(view.queryByRole('dialog'),null));
  assert.ok(view.getByText('AAPL.US · 每两周 · 周五'));assert.ok(view.getByText('800.00'));
  fireEvent.click(view.getByRole('button',{name:/编辑苹果定投计划/}));
  assert.equal(view.getByLabelText('定投金额（USD）').value,'800');
  fireEvent.change(view.getByLabelText('定投频率'),{target:{value:'month'}});
  fireEvent.change(view.getByLabelText('每月几号'),{target:{value:'31'}});
  fireEvent.click(view.getByRole('button',{name:'保存计划'}));
  await waitFor(()=>assert.equal(view.queryByRole('dialog'),null));
  assert.ok(view.getByText('AAPL.US · 每月 31 号'));
  fireEvent.click(view.getByRole('button',{name:/删除苹果定投计划/}));
  assert.ok(view.getByText('尚未添加定投计划'));
  fireEvent.click(view.getByRole('button',{name:'编辑苹果配置'}));
  assert.equal(view.queryByLabelText(/每期追加定投金额/),null);
 } finally {cleanup();}
});

test('searched plan-only stock joins the backtest payload without creating an initial deposit',async()=>{
 const previousFetch=globalThis.fetch;
 const tesla={symbol:'TSLA.US',name:'特斯拉',currency:'USD'};
 let payload;
 globalThis.fetch=async(url,options)=>{
  if(String(url)==='/api/backtest') {payload=JSON.parse(options.body);return Response.json({error:'测试请求已捕获'},{status:400});}
  if(String(url).includes('/api/stocks'))return Response.json({stocks:[tesla,candidates[0]]});
  return previousFetch(url,options);
 };
 const view=render(React.createElement(BacktestWorkbench,{initialRange:{start:'2025-10-13',end:'2026-10-13'}}));
 try {
  fireEvent.click(view.getByRole('button',{name:'添加定投计划'}));
  fireEvent.change(view.getByLabelText('定投股票'),{target:{value:'TSLA'}});
  await waitFor(()=>assert.ok(view.getByRole('button',{name:/特斯拉 TSLA.US/})));
  assert.equal(view.getByRole('button',{name:/贵州茅台 600519.SH/}).disabled,true);
  fireEvent.click(view.getByRole('button',{name:/特斯拉 TSLA.US/}));
  fireEvent.change(view.getByLabelText('定投频率'),{target:{value:'day'}});
  fireEvent.click(view.getByRole('button',{name:'添加计划'}));
  await waitFor(()=>assert.equal(view.queryByRole('dialog'),null));
  fireEvent.click(view.getByRole('button',{name:'开始回测'}));
  await waitFor(()=>assert.ok(payload));
  assert.deepEqual(payload.symbols,['AAPL.US','MSFT.US','TSLA.US']);
  assert.equal(payload.positions.some(p=>p.symbol==='TSLA.US'),false);
  assert.equal(payload.plans[0].symbol,'TSLA.US');assert.equal(payload.plans[0].frequency,'day');assert.equal(payload.plans[0].amount,500);
  assert.equal('mode' in payload,false);
 } finally {cleanup();globalThis.fetch=previousFetch;}
});
