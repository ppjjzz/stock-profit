import assert from 'node:assert/strict';
import test from 'node:test';
import type { ConversationResponse, ConversationStreamEvent } from 'longbridge';
import { analysisProgress, analysisQuery, analysisResult, readAnalysisStream, type AnalysisEvent } from '../src/lib/agent-analysis.ts';
import { validateSettings } from '../src/lib/backtest.ts';

const settings = { symbols: ['AAPL.US'], positions: [{symbol:'AAPL.US',inputMode:'shares' as const,value:10}], plans:[{id:'p1',symbol:'AAPL.US',amount:500,frequency:'month' as const,monthDay:15}],start:'2025-01-01',end:'2026-01-01' };
test('analysis prompt includes complete validated strategy and excludes arbitrary client fields', () => {
 const query = analysisQuery(validateSettings({...settings,secret:'do-not-forward'}));
 const sent=JSON.parse(query.split('回测配置（JSON）：\n')[1]);
 assert.deepEqual(sent.positions,settings.positions);
 assert.deepEqual(sent.plans,[{symbol:'AAPL.US',amount:500,frequency:'month',monthDay:15}]);
 assert.equal(sent.start,settings.start); assert.equal(sent.end,settings.end);
 assert.equal(query.includes('do-not-forward'),false);
 assert.match(query,/不要编造收益/); assert.match(query,/不要读取用户真实账户持仓或执行交易/);
});
test('SDK events preserve message keys and separate process from answer', () => {
 const message = (messageType:string) => ({kind:'message',message:{text:'片段',key:'k1',messageType}} as ConversationStreamEvent);
 assert.deepEqual(analysisProgress(message('answer')),{type:'delta',key:'k1',section:'answer',text:'片段'});
 assert.deepEqual(analysisProgress(message('process')),{type:'delta',key:'k1',section:'process',text:'片段'});
 assert.deepEqual(analysisProgress(message('think')),{type:'delta',key:'k1',section:'think',text:'片段'});
 assert.equal(analysisProgress({kind:'ping'}),null);
 assert.equal(analysisProgress({kind:'node_tool_use_started',nodeToolUseStarted:{tips:'查询行情'}} as ConversationStreamEvent)?.type,'status');
});
test('terminal states and references are normalized from the SDK without unsafe URLs', () => {
 const base={answer:'最终回答',references:[{title:'来源',url:'https://example.com'},{title:'unsafe',url:'javascript:alert(1)'}],interrupt:{questions:[{question:'补充日期？'}]},error:{message:'失败'}};
 for (const [status,name] of ['succeeded','interrupted','failed','stopped'].entries()) {
  const event=analysisResult({...base,status} as ConversationResponse);
  assert.equal(event.type,'result');
  if(event.type!=='result')throw new Error();
  assert.equal(event.status,name); assert.equal(event.answer,'最终回答');
  assert.deepEqual(event.questions,['补充日期？']); assert.equal(event.references.length,1);
 }
});
test('SSE parser handles byte-by-byte UTF-8, CRLF, comments, multiline data and final unclosed frame', async () => {
 const source=': heartbeat\r\n\r\ndata: {"type":"status",\r\ndata: "text":"正在分析中文"}\r\n\r\ndata: {"type":"delta","key":"k","section":"answer","text":"结果"}\n\ndata: {"type":"error","text":"中断"}';
 const bytes=new TextEncoder().encode(source); const received:AnalysisEvent[]=[];
 await readAnalysisStream(new ReadableStream({start(c){for(const b of bytes)c.enqueue(Uint8Array.of(b));c.close();}}),e=>received.push(e));
 assert.deepEqual(received,[{type:'status',text:'正在分析中文'},{type:'delta',key:'k',section:'answer',text:'结果'},{type:'error',text:'中断'}]);
});
test('invalid SSE fails and cancels the reader', async () => {
 let cancelled=false;
 await assert.rejects(readAnalysisStream(new ReadableStream({start(c){c.enqueue(new TextEncoder().encode('data: invalid\n\n'));},cancel(){cancelled=true;}}),()=>{}));
 assert.equal(cancelled,true);
});
