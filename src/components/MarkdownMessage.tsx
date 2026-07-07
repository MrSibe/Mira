import type { ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import rehypeHighlight from "rehype-highlight";
import type { SearchResult } from "../core/types";
import { openUrl } from "@tauri-apps/plugin-opener";

export function MarkdownMessage({
  content,
  searchResults,
}: {
  content: string;
  searchResults?: SearchResult[];
}) {
  function renderText(text: string): ReactNode {
    if (!searchResults || searchResults.length === 0) {
      return text;
    }
    const parts = text.split(/(\[\d+\])/g);
    if (parts.length === 1) {
      return text;
    }
    return parts.map((part, i) => {
      const m = part.match(/^\[(\d+)\]$/);
      if (m) {
        const idx = parseInt(m[1]) - 1;
        if (idx >= 0 && idx < searchResults.length) {
          return (
            <button
              key={i}
              className="inline-flex items-center justify-center rounded-sm bg-[var(--panel-soft)] px-1 text-xs font-semibold text-[var(--primary)] align-super leading-none hover:bg-[var(--hover)]"
              style={{ fontSize: "0.7em", lineHeight: "1.2" }}
              onClick={() => void openUrl(searchResults[idx].url)}
              title={searchResults[idx].title}
            >
              {m[1]}
            </button>
          );
        }
      }
      return part;
    });
  }

  return (
    <ReactMarkdown
      rehypePlugins={[rehypeHighlight]}
      components={{
        p: ({ children }) => (
          <p className="mb-3 leading-7 last:mb-0">{children}</p>
        ),
        ul: ({ children }) => (
          <ul className="mb-3 list-disc space-y-1 pl-5">{children}</ul>
        ),
        ol: ({ children }) => (
          <ol className="mb-3 list-decimal space-y-1 pl-5">{children}</ol>
        ),
        code: ({ children, className }) => (
          <code
            className={
              className ?? "rounded bg-[var(--code-inline)] px-1.5 py-0.5"
            }
          >
            {children}
          </code>
        ),
        pre: ({ children }) => (
          <pre className="my-3 bg-[var(--code-block)] p-4 text-sm text-white">
            {children}
          </pre>
        ),
        text: ({ children }) => <>{renderText(String(children))}</>,
      }}
    >
      {content}
    </ReactMarkdown>
  );
}
