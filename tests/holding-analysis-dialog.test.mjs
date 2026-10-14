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
const {HoldingAnalysisDialog}=await import('../src/components/holding-analysis-dialog.tsx');
const {BacktestWorkbench}=await import('../src/components/backtest-workbench.tsx');
const {AnalysisMarkdown}=await import('../src/components/analysis-markdown.tsx');
const settings={symbols:['AAPL.US'],positions:[{symbol:'AAPL.US',inputMode:'amount',value:5000}],plans:[{id:'p1',symbol:'AAPL.US',amount:300,frequency:'week',weekday:2}],start:'2025-01-01',end:'2026-01-01'};
const encoder=new TextEncoder();
const chunk=event=>encoder.encode(`data: ${JSON.stringify(event)}\n\n`);
const response=body=>new Response(body,{headers:{'Content-Type':'text/event-stream'}});
const success=answer=>({type:'result',status:'succeeded',answer,questions:[],references:[]});

test('AI button opens dialog and immediately analyzes without requesting an agent list',async()=>{
 const urls=[];let posted;
 globalThis.fetch=async(url,options)=>{
  urls.push(String(url));
  if(String(url)==='/api/holding-analysis'){posted=JSON.parse(options.body);return response(new ReadableStream({start(c){c.enqueue(chunk(success('配置分析')));c.close();}}));}
  if(String(url).includes('exchange-rates'))return Response.json({rates:{USD:1,HKD:8,CNY:7},dates:{HKD:'2026-10-14',CNY:'2026-10-14'}});
  return Response.json({series:[]});
 };
 const view=render(React.createElement(BacktestWorkbench,{initialRange:{start:settings.start,end:settings.end}}));
 try {
  fireEvent.click(view.getByRole('button',{name:'AI 持仓分析'}));
  await waitFor(()=>assert.ok(view.getByText('配置分析')));
  assert.equal(view.queryByLabelText('选择长桥 Agent'),null);
  assert.equal(urls.some(url=>url.includes('/api/agents')),false);
  assert.deepEqual(posted.settings.symbols,['AAPL.US','MSFT.US']);
  assert.equal(posted.settings.start,settings.start);assert.equal(posted.settings.end,settings.end);
  assert.equal(posted.agentId,undefined);
 } finally {cleanup();}
});
test('Strict Mode starts one request; thinking is collapsible and streaming Markdown becomes a final formatted answer',async()=>{
 let streamController,posted,count=0;
 globalThis.fetch=async(url,options)=>{count++;posted=JSON.parse(options.body);return response(new ReadableStream({start(c){streamController=c;},cancel(){}}));};
 const view=render(React.createElement(React.StrictMode,null,React.createElement(HoldingAnalysisDialog,{settings,onClose:()=>{}})));
 try {
  await waitFor(()=>assert.ok(streamController)); assert.equal(count,1);assert.deepEqual(posted,{settings});
  await React.act(async()=>{streamController.enqueue(chunk({type:'status',text:'正在查询行情'}));streamController.enqueue(chunk({type:'delta',key:'t',section:'think',text:'正在检查 **集中度**'}));});
  assert.match(view.getByRole('status').textContent,/正在查询行情/);
  const thought=view.getByText('思考过程').closest('details');assert.equal(thought.open,false);
  fireEvent.click(view.getByText('思考过程'));assert.equal(thought.open,true);
  await React.act(async()=>streamController.enqueue(chunk({type:'delta',key:'t',section:'think',text:'，并核对定投。'})));
  assert.equal(thought.open,true);assert.match(thought.textContent,/并核对定投/);
  fireEvent.click(view.getByText('思考过程'));assert.equal(thought.open,false);
  await React.act(async()=>streamController.enqueue(chunk({type:'delta',key:'a',section:'answer',text:'## 组合分析\n\n**风险**较集中'})));
  await waitFor(()=>assert.ok(view.getByRole('heading',{name:'组合分析'})));
  assert.equal(view.getByText('风险',{exact:true}).tagName,'STRONG');
  assert.equal(view.queryByText('正在检查 集中度',{exact:true}),null);
  const markdown='## 最终结论\n\n- **分散风险**\n- 关注定投\n\n| 标的 | 比例 |\n| --- | --- |\n| AAPL | 50% |\n\n[资料来源](https://example.com)\n\n```js\nconst weight = 0.5;\n```';
  await React.act(async()=>{streamController.enqueue(chunk(success(markdown)));streamController.close();});
  await waitFor(()=>assert.match(view.getByRole('status').textContent,/分析完成/));
  assert.ok(view.getByRole('heading',{name:'最终结论'}));assert.equal(view.queryByRole('heading',{name:'组合分析'}),null);
  assert.ok(view.getByRole('table'));assert.equal(view.getByText('分散风险').tagName,'STRONG');
  assert.match(view.getByRole('table').textContent,/AAPL50%/);
  assert.equal(view.getByRole('link',{name:'资料来源'}).getAttribute('href'),'https://example.com');
  assert.ok(view.container.ownerDocument.querySelector('pre code'));
  assert.equal(thought.open,false);
 } finally {cleanup();}
});
test('Markdown does not execute HTML or render unsafe link schemes',()=>{
 const view=render(React.createElement(AnalysisMarkdown,{text:'<script>alert(1)</script>\n\n[危险链接](javascript:alert%281%29)\n\n[正常链接](https://example.com)'}));
 try {
  assert.equal(view.container.querySelector('script'),null);
  assert.equal(view.queryByRole('link',{name:'危险链接'}),null);
  assert.equal(view.getByRole('link',{name:'正常链接'}).getAttribute('rel'),'noopener noreferrer');
 } finally {cleanup();}
});
test('abrupt end retains partial content and retries; stopping aborts the request',async()=>{
 let signal;
 globalThis.fetch=async(url,options)=>(signal=options.signal,response(new ReadableStream({start(c){c.enqueue(chunk({type:'delta',key:'a',section:'answer',text:'已收到的内容'}));c.close();}})));
 const view=render(React.createElement(HoldingAnalysisDialog,{settings,onClose:()=>{}}));
 try {
  await waitFor(()=>assert.match(view.getByRole('alert').textContent,/意外中断/));
  assert.ok(view.getByText('已收到的内容'));
  globalThis.fetch=async(url,options)=>{signal=options.signal;return response(new ReadableStream({start(c){options.signal.addEventListener('abort',()=>c.error(new DOMException('Aborted','AbortError')));}}));};
  fireEvent.click(view.getByRole('button',{name:'重新分析'}));
  await waitFor(()=>assert.ok(view.getByRole('button',{name:'停止接收'})));
  fireEvent.click(view.getByRole('button',{name:'停止接收'}));
  assert.equal(signal.aborted,true);assert.match(view.getByRole('status').textContent,/已停止接收分析/);
 } finally {cleanup();}
});
test('closing aborts an active stream and triggers onClose',async()=>{
 let signal,closed=false;
 globalThis.fetch=async(url,options)=>(signal=options.signal,response(new ReadableStream({start(c){options.signal.addEventListener('abort',()=>c.error(new DOMException('Aborted','AbortError')));}})));
 const view=render(React.createElement(HoldingAnalysisDialog,{settings,onClose:()=>{closed=true;}}));
 try {
  await waitFor(()=>assert.ok(signal));
  fireEvent.click(view.getAllByRole('button',{name:'关闭'})[0]);
  assert.equal(signal.aborted,true);assert.equal(closed,true);
 } finally {cleanup();}
});
test('upstream error and interrupted result display their terminal states',async()=>{
 for(const event of [{type:'error',text:'网络故障'},{type:'result',status:'interrupted',answer:'',questions:['请补充风险偏好'],references:[]}]) {
  globalThis.fetch=async()=>response(new ReadableStream({start(c){c.enqueue(chunk(event));c.close();}}));
  const view=render(React.createElement(HoldingAnalysisDialog,{settings,onClose:()=>{}}));
  try {
   await waitFor(()=>assert.match(view.getByRole('status').textContent,event.type==='error'?/分析失败/:/需要补充信息/));
   assert.ok(view.getByText(event.type==='error'?'网络故障':'请补充风险偏好'));
  } finally {cleanup();}
 }
});
test('stopping immediately cancels scheduled automatic analysis before a request is sent',async()=>{
 let requests=0;
 globalThis.fetch=async()=>{requests++;return response(new ReadableStream({start(c){c.enqueue(chunk(success('完成')));c.close();}}));};
 const view=render(React.createElement(HoldingAnalysisDialog,{settings,onClose:()=>{}}));
 try {
  fireEvent.click(view.getByRole('button',{name:'停止接收'}));
  await React.act(async()=>{await new Promise(resolve=>setTimeout(resolve,10));});
  assert.equal(requests,0);assert.match(view.getByRole('status').textContent,/已停止接收/);
 } finally {cleanup();}
});
