import type { NextConfig } from 'next';

const longbridgeRuntimeFiles = [
  './node_modules/longbridge/**/*',
  './node_modules/longbridge-linux-x64-gnu/**/*',
  './node_modules/.pnpm/longbridge@*/node_modules/longbridge/**/*',
  './node_modules/.pnpm/longbridge-linux-x64-gnu@*/node_modules/longbridge-linux-x64-gnu/**/*',
];

const nextConfig: NextConfig = {
  serverExternalPackages: ['longbridge'],
  allowedDevOrigins: ['127.0.0.1'],
  outputFileTracingIncludes: {
    '/api/backtest': longbridgeRuntimeFiles,
    '/api/benchmarks': longbridgeRuntimeFiles,
    '/api/stocks': longbridgeRuntimeFiles,
    '/api/stock-chart': longbridgeRuntimeFiles,
    '/api/holding-analysis': longbridgeRuntimeFiles,
  },
};
export default nextConfig;
