import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = { title: '时盈 · 股票收益回测', description: '使用长桥历史行情，回放投资组合的每一天。' };
export default function RootLayout({ children }: Readonly<{children: React.ReactNode}>) { return <html lang="zh-CN" className="dark"><body>{children}</body></html>; }
