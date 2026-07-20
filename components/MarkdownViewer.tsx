'use client';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import { useMemo } from 'react';

interface MarkdownViewerProps {
  content: string;
  theme?: 'dark' | 'light';
  onNavigate?: (fileName: string) => void;
}

/**
 * Pre-process markdown to convert [[wikilinks]] into clickable links.
 * [[Page Name]] → [Page Name](#wiki:Page Name)
 * [[Page Name|Display Text]] → [Display Text](#wiki:Page Name)
 */
function processWikilinks(md: string): string {
  return md.replace(/\[\[([^\]]+)\]\]/g, (_, inner: string) => {
    const parts = inner.split('|');
    const target = parts[0].trim();
    const display = parts.length > 1 ? parts[1].trim() : target;
    return `[${display}](#wiki:${encodeURIComponent(target)})`;
  });
}

export default function MarkdownViewer({
  content,
  theme = 'dark',
  onNavigate,
}: MarkdownViewerProps) {
  const processed = useMemo(() => processWikilinks(content), [content]);
  const isDark = theme === 'dark';

  return (
    <div className={`max-w-none px-8 py-6 ${isDark ? 'md-dark' : 'md-light'}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeHighlight]}
        components={{
          a: ({ href, children, ...props }) => {
            // Handle wikilinks
            if (href && href.startsWith('#wiki:')) {
              const target = decodeURIComponent(href.replace('#wiki:', ''));
              return (
                <a
                  {...props}
                  href="#"
                  onClick={(e) => {
                    e.preventDefault();
                    if (onNavigate) onNavigate(target);
                  }}
                  className="wikilink"
                  title={`Navigate to: ${target}`}
                >
                  {children}
                </a>
              );
            }
            // Regular links open in new tab
            return (
              <a {...props} href={href} target="_blank" rel="noopener noreferrer">
                {children}
              </a>
            );
          },
        }}
      >
        {processed}
      </ReactMarkdown>
    </div>
  );
}
