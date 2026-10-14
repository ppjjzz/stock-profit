import { memo } from 'react';
import Markdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';

const plugins = [remarkGfm];
const components: Components = {
  a: ({ href, children }) => href ? <a href={href} target="_blank" rel="noopener noreferrer">{children}</a> : <span>{children}</span>,
  table: ({ children }) => <div className="analysis-markdown-table"><table>{children}</table></div>,
  img: ({ alt }) => <span>{alt}</span>,
};

export const AnalysisMarkdown = memo(function AnalysisMarkdown({ text }: { text: string }) {
  return <div className="analysis-markdown"><Markdown remarkPlugins={plugins} components={components} skipHtml>{text}</Markdown></div>;
});
