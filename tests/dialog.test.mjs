import assert from 'node:assert/strict';
import test from 'node:test';
import { JSDOM } from 'jsdom';
const dom=new JSDOM('<!doctype html><html><body></body></html>',{url:'http://localhost:3000',pretendToBeVisual:true});
const {window}=dom;
test.after(()=>window.close());
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
const {HoldingsPanel}=await import('../src/components/holdings-panel.tsx');
async function selectDisplayCurrency(view,currency) {
 fireEvent.keyDown(view.getByRole('combobox',{name:'展示货币'}),{key:'ArrowDown'});
 fireEvent.click(await view.findByRole('option',{name:currency,exact:true}));
 await waitFor(()=>assert.equal(view.getByRole('combobox',{name:'展示货币'}).textContent,currency));
}
const candidates=[{symbol:'600519.SH',name:'贵州茅台',currency:'CNY'},{symbol:'700.HK',name:'腾讯控股',currency:'HKD'}];
test('holdings switch between table and pie proportions as the replay point changes',()=>{
 const stocks=[{symbol:'AAPL.US',name:'苹果',currency:'USD'},{symbol:'MSFT.US',name:'微软',currency:'USD'}];
 const point=(first,second)=>({date:'2026-10-13',total:first+second,invested:100,values:{'AAPL.US':first,'MSFT.US':second},contributions:{'AAPL.US':50,'MSFT.US':50},shares:{'AAPL.US':1,'MSFT.US':1}});
 const props={stocks,point:point(75,25),currency:'USD',displayMoney:value=>value.toFixed(2)};
 const view=render(React.createElement(HoldingsPanel,props));
 try {
  assert.ok(view.getByRole('table'));
  fireEvent.click(view.getByRole('button',{name:'图表'}));
  assert.equal(view.queryByRole('table'),null);
  assert.match(view.getByRole('list',{name:'个股市值占比'}).textContent,/75\.0%.*25\.0%/);
  view.rerender(React.createElement(HoldingsPanel,{...props,point:point(20,80)}));
  assert.match(view.getByRole('list',{name:'个股市值占比'}).textContent,/20\.0%.*80\.0%/);
  fireEvent.click(view.getByRole('button',{name:'表格'}));
  assert.ok(view.getByRole('table'));
 } finally {cleanup();}
});
globalThis.fetch=async url=>{
 const params=new URL(String(url),'http://localhost').searchParams;
 if(String(url)==='/api/exchange-rates')return Response.json({rates:{USD:1,HKD:8,CNY:7},dates:{HKD:'2026-10-14',CNY:'2026-10-14'}});
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

test('growth chart switches metrics, colors gains red and losses green, and keeps stock selection and cost visibility',async()=>{
 const previousFetch=globalThis.fetch;
 const previousObserver=globalThis.ResizeObserver;
 class ChartResizeObserver {
  constructor(callback){this.callback=callback;}
  observe(){this.callback([{contentRect:{width:800,height:320}}]);}
  unobserve(){}
  disconnect(){}
 }
 globalThis.ResizeObserver=window.ResizeObserver=ChartResizeObserver;
 const stocks=[{symbol:'AAPL.US',name:'苹果',currency:'USD'},{symbol:'MSFT.US',name:'微软',currency:'USD'}];
 const points=[
  {date:'2025-10-13',total:1000,invested:1000,values:{'AAPL.US':500,'MSFT.US':500}},
  {date:'2025-10-14',total:900,invested:1000,values:{'AAPL.US':450,'MSFT.US':450}},
  {date:'2025-10-15',total:1200,invested:1000,values:{'AAPL.US':450,'MSFT.US':750}},
 ].map(p=>({...p,contributions:{'AAPL.US':500,'MSFT.US':500},shares:{'AAPL.US':5,'MSFT.US':5}}));
 globalThis.fetch=async(url,options)=>String(url)==='/api/backtest'?Response.json({stocks,points,currency:'USD',settings:{plans:[],positions:[]},warnings:[]}):previousFetch(url,options);
 const view=render(React.createElement(BacktestWorkbench,{initialRange:{start:'2025-10-13',end:'2025-10-15'}}));
 try {
  fireEvent.click(view.getByRole('button',{name:'开始回测'}));
  await waitFor(()=>assert.ok(view.getByText('3 / 3 个交易日')));
  const chart=view.container.querySelector('.chart-panel');
  assert.ok(chart.querySelector('.recharts-line'));
  fireEvent.click(view.getByRole('checkbox',{name:'累计投入'}));
  assert.equal(chart.querySelector('.recharts-line'),null);
  fireEvent.mouseDown(view.getByRole('tab',{name:'累计收益'}),{button:0,ctrlKey:false});
  await waitFor(()=>assert.equal(view.getByRole('tab',{name:'累计收益'}).getAttribute('aria-selected'),'true'));
  assert.equal(view.queryByRole('checkbox',{name:'累计投入'}),null);
  assert.ok(view.getByText('累计收益 / USD'));
  assert.ok(view.getByText('零收益'));
  const stops=chart.querySelectorAll('linearGradient[id$="profit-stroke"] stop');
  assert.equal(stops[0].getAttribute('stop-color'),'#ff9391');
  assert.equal(stops[1].getAttribute('stop-color'),'var(--green)');
  assert.ok(Math.abs(Number(stops[0].getAttribute('offset'))-2/3)<0.001);
  const profitCard=view.container.querySelectorAll('.metric')[2];
  assert.equal(profitCard.querySelector('strong').textContent,'+200.00');
  assert.equal(profitCard.querySelector('strong').style.color,'rgb(255, 147, 145)');
  fireEvent.click(chart.querySelector('.series-tabs button:nth-child(2)'));
  assert.equal(profitCard.querySelector('strong').textContent,'-50.00');
  assert.equal(profitCard.querySelector('strong').style.color,'var(--green)');
  assert.equal(chart.querySelector('linearGradient[id$="profit-stroke"] stop').getAttribute('offset'),'0');
  fireEvent.click(view.getByRole('button',{name:'从头回放'}));
  assert.equal(profitCard.querySelector('strong').textContent,'+0.00');
  assert.equal(profitCard.querySelector('strong').style.color,'var(--foreground)');
  assert.equal(chart.querySelector('.recharts-area-dot').getAttribute('fill'),'var(--chart-axis)');
  fireEvent.mouseDown(view.getByRole('tab',{name:'总市值'}),{button:0,ctrlKey:false});
  await waitFor(()=>assert.equal(view.getByRole('tab',{name:'总市值'}).getAttribute('aria-selected'),'true'));
  assert.equal(view.getByRole('checkbox',{name:'累计投入'}).checked,false);
  assert.equal(chart.querySelector('.recharts-reference-line'),null);
  assert.equal(view.getByRole('button',{name:'苹果',exact:true}).getAttribute('aria-pressed'),'true');
  assert.equal(view.getByRole('combobox',{name:'展示货币'}).textContent,'USD');
  const beforeValue=Number(view.container.querySelector('.metric strong').textContent.replaceAll(',',''));
  const beforeDate=view.container.querySelector('.play-controls>span').textContent;
  await selectDisplayCurrency(view,'HKD');
  assert.equal(profitCard.querySelector('small').textContent,'HKD');
  assert.equal(Number(view.container.querySelector('.metric strong').textContent.replaceAll(',','')),beforeValue*8);
  assert.equal(view.container.querySelector('.play-controls>span').textContent,beforeDate);
  assert.ok(view.getByText('市值 / HKD'));
  const holdingCells=view.container.querySelectorAll('.holdings tbody tr:first-child td');
  assert.equal(holdingCells[1].textContent,'5.00');
  assert.equal(holdingCells[2].textContent,'4,000.00');
  await selectDisplayCurrency(view,'CNY');
  assert.equal(Number(view.container.querySelector('.metric strong').textContent.replaceAll(',','')),beforeValue*7);
  assert.equal(view.getByRole('button',{name:'编辑苹果配置'}).closest('.stock-chip').querySelector('.allocation-badge').textContent,'5,000 USD');
 } finally {cleanup();globalThis.fetch=previousFetch;globalThis.ResizeObserver=window.ResizeObserver=previousObserver;}
});

test('failed currency lookup hides unconverted amounts and supports retry',async()=>{
 const previousFetch=globalThis.fetch;
 let fail=true;
 globalThis.fetch=async(url,options)=>{
  if(String(url)==='/api/exchange-rates'&&fail)return Response.json({error:'无法获取 Frankfurter 汇率，请重试'},{status:502});
  if(String(url)==='/api/backtest')return Response.json({stocks:[{symbol:'AAPL.US',name:'苹果',currency:'USD'}],points:[{date:'2025-10-13',total:1100,invested:1000,values:{'AAPL.US':1100},contributions:{'AAPL.US':1000},shares:{'AAPL.US':5}}],currency:'USD',settings:{plans:[]},warnings:[]});
  return previousFetch(url,options);
 };
 const view=render(React.createElement(BacktestWorkbench,{initialRange:{start:'2025-10-13',end:'2025-10-15'}}));
 try {
  await waitFor(()=>assert.ok(view.getByRole('alert')));
  fireEvent.click(view.getByRole('button',{name:'开始回测'}));
  await waitFor(()=>assert.equal(view.container.querySelector('.metric strong').textContent,'1,100.00'));
  await selectDisplayCurrency(view,'CNY');
  assert.match(view.getByRole('alert').textContent,/金额暂不可用/);
  assert.equal(view.container.querySelector('.metric strong').textContent,'—');
  assert.equal(view.getByRole('button',{name:'导出数据'}).disabled,true);
  fail=false;
  fireEvent.click(view.getByRole('button',{name:'重试汇率'}));
  await waitFor(()=>assert.equal(view.queryByRole('alert'),null));
  assert.ok(view.getByText(/Frankfurter 最新日汇率/));
  assert.equal(view.getByRole('combobox',{name:'展示货币'}).textContent,'CNY');
  assert.equal(view.container.querySelector('.metric strong').textContent,'7,700.00');
  assert.equal(view.getByRole('button',{name:'导出数据'}).disabled,false);
 } finally {cleanup();globalThis.fetch=previousFetch;}
});

test('return tab compares selected indices, follows playback and shares a single benchmark request',async()=>{
 const previousFetch=globalThis.fetch,previousObserver=globalThis.ResizeObserver;
 class ChartResizeObserver {
  constructor(callback){this.callback=callback;}
  observe(){this.callback([{contentRect:{width:800,height:320}}]);}
  unobserve(){}disconnect(){}
 }
 globalThis.ResizeObserver=window.ResizeObserver=ChartResizeObserver;
 let benchmarkRequests=0;
 const range={start:'2025-10-13',end:'2025-10-15'};
 globalThis.fetch=async(url,options)=>{
  if(String(url).includes('/api/benchmarks')) {
   benchmarkRequests++;
   return Response.json({...range,series:[
    {symbol:'000300.SH',name:'沪深 300',color:'#c6a0fa',candles:[{date:range.start,close:100},{date:range.end,close:90}]},
    {symbol:'000016.SH',name:'上证 50',color:'#eecc60',candles:[{date:range.start,close:100},{date:range.end,close:130}]},
    {symbol:'000688.SH',name:'科创 50',color:'#8dd1f0',candles:[],error:'所选区间没有指数行情'},
   ]});
  }
  if(String(url)==='/api/backtest')return Response.json({stocks:[{symbol:'AAPL.US',name:'苹果',currency:'USD'}],points:[
   {date:range.start,total:1000,invested:1000,values:{'AAPL.US':1000},contributions:{'AAPL.US':1000},shares:{'AAPL.US':5}},
   {date:range.end,total:1200,invested:1000,values:{'AAPL.US':1200},contributions:{'AAPL.US':1000},shares:{'AAPL.US':5}},
  ],currency:'USD',settings:{...range,plans:[]},warnings:[]});
  return previousFetch(url,options);
 };
 const view=render(React.createElement(BacktestWorkbench,{initialRange:range}));
 try {
  const metricTabs=view.container.querySelector('.chart-metric-toolbar [role=tablist]');
  assert.deepEqual([...metricTabs.querySelectorAll('[role=tab]')].map(t=>t.textContent),['累计收益','收益率','总市值','收益日历']);
  fireEvent.click(view.getByRole('button',{name:'开始回测'}));
  fireEvent.mouseDown(view.getByRole('tab',{name:'收益率',exact:true}),{button:0,ctrlKey:false});
  await waitFor(()=>assert.equal(view.getByRole('tab',{name:'收益率',exact:true}).getAttribute('aria-selected'),'true'));
  await waitFor(()=>assert.equal(view.container.querySelectorAll('.return-summary strong')[1].textContent,'-10.00%'));
  const summary=()=>[...view.container.querySelectorAll('.return-summary strong')].map(s=>s.textContent);
  assert.deepEqual(summary(),['+20.00%','-10.00%','+30.00个百分点']);
  const chart=view.container.querySelector('.return-comparison');
  await waitFor(()=>{
   assert.equal(chart.querySelector('.recharts-area-curve')?.getAttribute('stroke'),'#287df5');
   assert.equal(chart.querySelector('.recharts-line-curve')?.getAttribute('stroke'),'#ff9e22');
  });
  assert.equal(benchmarkRequests,1);
  fireEvent.keyDown(view.getByRole('combobox',{name:'对比指数'}),{key:'ArrowDown'});
  fireEvent.click(await view.findByRole('option',{name:'上证 50',exact:true}));
  await waitFor(()=>assert.deepEqual(summary(),['+20.00%','+30.00%','-10.00个百分点']));
  assert.equal(view.container.querySelectorAll('.return-summary strong')[2].style.color,'var(--green)');
  fireEvent.click(view.getByRole('button',{name:'从头回放'}));
  assert.deepEqual(summary(),['0.00%','0.00%','0.00个百分点']);
  fireEvent.keyDown(view.getByRole('combobox',{name:'对比指数'}),{key:'ArrowDown'});
  fireEvent.click(await view.findByRole('option',{name:'科创 50',exact:true}));
  await waitFor(()=>assert.equal(summary()[1],'—'));
  assert.equal(summary()[2],'—');assert.ok(view.getByRole('button',{name:'重试指数'}));
  assert.equal(benchmarkRequests,1);
 } finally {cleanup();globalThis.fetch=previousFetch;globalThis.ResizeObserver=window.ResizeObserver=previousObserver;}
});

test('income calendar uses complete results independently of replay and opens daily holding details',async()=>{
 const previousFetch=globalThis.fetch;
 const range={start:'2026-08-31',end:'2026-09-06'};
 globalThis.fetch=async(url,options)=>{
  if(String(url)==='/api/backtest')return Response.json({stocks:[{symbol:'AAPL.US',name:'苹果',currency:'USD'},{symbol:'MSFT.US',name:'微软',currency:'USD'}],points:[
   {date:'2026-08-31',total:2000,invested:2000,values:{'AAPL.US':1000,'MSFT.US':1000},contributions:{'AAPL.US':1000,'MSFT.US':1000},shares:{'AAPL.US':10,'MSFT.US':10}},
   {date:'2026-09-01',total:2550,invested:2500,values:{'AAPL.US':1650,'MSFT.US':900},contributions:{'AAPL.US':1500,'MSFT.US':1000},shares:{'AAPL.US':15,'MSFT.US':10}},
   {date:'2026-09-02',total:2650,invested:2500,values:{'AAPL.US':1500,'MSFT.US':1150},contributions:{'AAPL.US':1500,'MSFT.US':1000},shares:{'AAPL.US':15,'MSFT.US':10}},
  ],currency:'USD',settings:{...range,plans:[]},warnings:[]});
  return previousFetch(url,options);
 };
 const view=render(React.createElement(BacktestWorkbench,{initialRange:range}));
 try {
  fireEvent.click(view.getByRole('button',{name:'开始回测'}));
  fireEvent.mouseDown(view.getByRole('tab',{name:'收益日历',exact:true}),{button:0,ctrlKey:false});
  await waitFor(()=>assert.ok(view.getByRole('button',{name:'2026-09-02 当日收益 +100.00'})));
  assert.equal(view.queryByRole('slider',{name:'回测播放进度'}),null);
  assert.equal(view.queryByRole('button',{name:'播放'}),null);
  fireEvent.click(view.getByRole('button',{name:'2026-09-01 当日收益 +50.00'}));
  const detail=()=>view.container.querySelector('.calendar-detail-heading h3').textContent;
  assert.match(detail(),/2026-09-01/);
  await waitFor(()=>assert.equal(view.container.querySelector('.timeline-dates'),null));
  let rows=view.container.querySelectorAll('.calendar-holdings tbody tr');
  assert.match(rows[0].textContent,/苹果.*\+150.00.*\+10.00%/);
  assert.match(rows[1].textContent,/微软.*-100.00.*-10.00%/);
  assert.ok(view.getByRole('button',{name:'2026-09-06 当日收益 0.00'}));
  fireEvent.keyDown(view.getByRole('combobox',{name:'当日收益排序'}),{key:'ArrowDown'});
  fireEvent.click(await view.findByRole('option',{name:'收益从低到高',exact:true}));
  assert.match(view.container.querySelector('.calendar-holdings tbody tr').textContent,/微软/);
  await selectDisplayCurrency(view,'HKD');
  assert.match(view.container.querySelector('.calendar-holdings tbody tr').textContent,/-800.00/);
  fireEvent.mouseDown(view.getByRole('tab',{name:'总市值',exact:true}),{button:0,ctrlKey:false});
  fireEvent.click(view.getByRole('button',{name:'从头回放'}));
  fireEvent.mouseDown(view.getByRole('tab',{name:'收益日历',exact:true}),{button:0,ctrlKey:false});
  assert.match(detail(),/2026-09-01/);
  fireEvent.click(view.getByRole('button',{name:'上个月'}));
  assert.ok(view.getByRole('button',{name:'2026-08-31 当日收益 0.00'}));
  assert.equal(view.getByRole('button',{name:'上个月'}).disabled,true);
  fireEvent.click(view.getByRole('button',{name:'下个月'}));
  fireEvent.click(view.getByRole('button',{name:'2026-09-06 当日收益 0.00'}));
  assert.match(detail(),/2026-09-06/);
  rows=view.container.querySelectorAll('.calendar-holdings tbody tr');
  assert.match(rows[0].textContent,/0.00.*0.00%/);
  fireEvent.mouseDown(view.getByRole('tab',{name:'收益率 · %',exact:true}),{button:0,ctrlKey:false});
  assert.ok(view.getByRole('button',{name:'2026-09-01 当日收益 +2.50%'}));
  fireEvent.mouseDown(view.getByRole('tab',{name:'月',exact:true}),{button:0,ctrlKey:false});
  assert.equal(view.container.querySelectorAll('.calendar-period-grid .calendar-day').length,12);
  assert.ok(view.getByRole('button',{name:'2026-09 当月收益 +6.52%'}));
  assert.equal(view.getByRole('button',{name:'2026-01 不在回测区间'}).disabled,true);
  fireEvent.mouseDown(view.getByRole('tab',{name:'金额 · HKD',exact:true}),{button:0,ctrlKey:false});
  fireEvent.click(view.getByRole('button',{name:'2026-09 当月收益 +1,200.00'}));
  assert.match(detail(),/当月收益明细.*2026-09/);
  const monthlyRows=view.container.querySelectorAll('.calendar-holdings tbody tr');
  assert.match(monthlyRows[0].textContent,/苹果.*0.00.*0.00%/);
  assert.match(monthlyRows[1].textContent,/微软.*\+1,200.00.*\+15.00%/);
  fireEvent.click(view.getByRole('button',{name:'2026-08 当月收益 0.00'}));
  assert.match(detail(),/当月收益明细.*2026-08/);
  fireEvent.mouseDown(view.getByRole('tab',{name:'年',exact:true}),{button:0,ctrlKey:false});
  fireEvent.click(view.getByRole('button',{name:'2026 当年收益 +1,200.00'}));
  assert.match(detail(),/当年收益明细.*2026/);
  assert.ok(view.getByRole('combobox',{name:'当年收益排序'}));
  fireEvent.mouseDown(view.getByRole('tab',{name:'日',exact:true}),{button:0,ctrlKey:false});
  assert.ok(view.getByRole('button',{name:'2026-08-31 当日收益 0.00'}));

 } finally {cleanup();globalThis.fetch=previousFetch;}
});
