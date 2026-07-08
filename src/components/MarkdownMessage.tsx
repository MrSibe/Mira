import { useCallback, useRef, useState } from "react";
import { Copy, Check } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";

export function MarkdownMessage({ content }: { content: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
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
        pre: ({ children }) => <CodeBlock>{children}</CodeBlock>,
        table: ({ children }) => (
          <div className="mb-3 overflow-x-auto">
            <table className="w-full border-collapse border border-[var(--border)] text-sm">
              {children}
            </table>
          </div>
        ),
        thead: ({ children }) => (
          <thead className="bg-[var(--panel-soft)]">{children}</thead>
        ),
        th: ({ children }) => (
          <th className="border border-[var(--border)] px-3 py-2 text-left font-medium text-[var(--text)]">
            {children}
          </th>
        ),
        td: ({ children }) => (
          <td className="border border-[var(--border)] px-3 py-2 text-[var(--text)]">
            {children}
          </td>
        ),
        tr: ({ children }) => (
          <tr className="even:bg-[var(--panel-soft)]">{children}</tr>
        ),
      }}
    >
      {content}
    </ReactMarkdown>
  );
}

function CodeBlock({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLPreElement>(null);
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(() => {
    const text = ref.current?.textContent ?? "";
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, []);

  return (
    <div className="group relative my-3">
      <button
        className="absolute right-2 top-2 z-10 rounded-md bg-[var(--panel-soft)] p-1.5 text-[var(--subtle)] opacity-0 transition hover:bg-[var(--hover)] hover:text-[var(--text)] group-hover:opacity-100"
        onClick={handleCopy}
        aria-label="Copy code"
      >
        {copied ? (
          <Check className="h-3.5 w-3.5" />
        ) : (
          <Copy className="h-3.5 w-3.5" />
        )}
      </button>
      <pre ref={ref} className="bg-[var(--code-block)] p-4 text-sm text-white">
        {children}
      </pre>
    </div>
  );
}
