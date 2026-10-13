import type { Stock } from './backtest';
export const catalog: Stock[] = [
  {symbol:'AAPL.US',name:'苹果',currency:'USD'}, {symbol:'MSFT.US',name:'微软',currency:'USD'},
  {symbol:'NVDA.US',name:'英伟达',currency:'USD'}, {symbol:'TSLA.US',name:'特斯拉',currency:'USD'},
  {symbol:'GOOGL.US',name:'谷歌',currency:'USD'}, {symbol:'AMZN.US',name:'亚马逊',currency:'USD'},
  {symbol:'META.US',name:'Meta',currency:'USD'}, {symbol:'BABA.US',name:'阿里巴巴',currency:'USD'},
  {symbol:'SPY.US',name:'标普 500 ETF',currency:'USD'}, {symbol:'QQQ.US',name:'纳斯达克 100 ETF',currency:'USD'},
  {symbol:'700.HK',name:'腾讯控股',currency:'HKD'}, {symbol:'9988.HK',name:'阿里巴巴',currency:'HKD'},
  {symbol:'1810.HK',name:'小米集团',currency:'HKD'}, {symbol:'3690.HK',name:'美团',currency:'HKD'},
  {symbol:'9618.HK',name:'京东集团',currency:'HKD'}, {symbol:'600519.SH',name:'贵州茅台',currency:'CNY'},
  {symbol:'300750.SZ',name:'宁德时代',currency:'CNY'}, {symbol:'000001.SZ',name:'平安银行',currency:'CNY'},
];
