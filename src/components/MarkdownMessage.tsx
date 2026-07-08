import ReactMarkdown from "react-markdown";
import rehypeHighlight from "rehype-highlight";

export function MarkdownMessage({ content }: { content: string }) {
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
      }}
    >
      {content}
    </ReactMarkdown>
  );
}
