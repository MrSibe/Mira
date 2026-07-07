import { Bot, ExternalLink, Globe } from "lucide-react";
import { openUrl } from "@tauri-apps/plugin-opener";
import type { ChatMessage, SearchResult } from "../core/types";
import { useT } from "../i18n/useT";
import { useAppStore } from "../store/useAppStore";
import { cn } from "../utils/cn";
import { MarkdownMessage } from "./MarkdownMessage";

function SearchResultBadges({ results }: { results: SearchResult[] }) {
  return (
    <div className="flex items-center gap-1.5 overflow-x-auto px-1 py-2">
      {results.map((r, i) => (
        <button
          key={i}
          className="inline-flex shrink-0 items-center gap-1 rounded-full border border-[var(--border)] bg-[var(--panel-soft)] px-2.5 py-1 text-xs transition hover:bg-[var(--hover)]"
          title={r.title}
          onClick={() => void openUrl(r.url)}
        >
          <Globe className="h-3.5 w-3.5 text-[var(--primary)]" />
          <span className="font-medium text-[var(--primary)]">{i + 1}</span>
          <span className="max-w-[100px] truncate text-[var(--subtle)]">
            {new URL(r.url).hostname.replace("www.", "")}
          </span>
          <ExternalLink className="h-3 w-3 text-[var(--subtle)]" />
        </button>
      ))}
    </div>
  );
}

function CitationBadges({
  results,
  content,
}: {
  results: SearchResult[];
  content: string;
}) {
  // Find unique citation numbers referenced in the response
  const cited = new Set<number>();
  const regex = /\[(\d+)\]/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(content)) !== null) {
    const idx = parseInt(match[1]) - 1;
    if (idx >= 0 && idx < results.length) {
      cited.add(idx);
    }
  }

  if (cited.size === 0) return null;

  return (
    <div className="mt-3 border-t border-[var(--border)] pt-2">
      <div className="flex flex-wrap gap-2">
        {Array.from(cited).map((idx) => (
          <button
            key={idx}
            className="inline-flex items-center gap-1.5 rounded-md bg-[var(--panel-soft)] px-2.5 py-1 text-xs transition hover:bg-[var(--hover)]"
            onClick={() => void openUrl(results[idx].url)}
            title={results[idx].title}
          >
            <span className="font-semibold text-[var(--primary)]">
              {idx + 1}
            </span>
            <span className="max-w-[160px] truncate text-[var(--text)]">
              {results[idx].title}
            </span>
            <ExternalLink className="h-3 w-3 shrink-0 text-[var(--subtle)]" />
          </button>
        ))}
      </div>
    </div>
  );
}

export function MessageBubble({ message }: { message: ChatMessage }) {
  const t = useT();
  const isUser = message.role === "user";
  const results = message.search_results ?? [];
  const activeResults = useAppStore((s) => s.activeSearchResults);
  const isSearchMessage = results.length > 0;

  if (isUser) {
    return (
      <div className="flex justify-end">
        <article className="max-w-[78%] rounded-2xl bg-[var(--message-user)] px-4 py-2.5 text-sm leading-6 text-[var(--text)]">
          <MarkdownMessage content={message.content} />
        </article>
      </div>
    );
  }

  return (
    <div className="flex gap-3">
      <div className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--panel)]">
        <Bot className="h-4 w-4 text-[var(--text)]" />
      </div>
      <div className="min-w-0 flex-1">
        {isSearchMessage ? (
          <SearchResultBadges results={results} />
        ) : message.content.trim().length === 0 ? (
          <div className="flex min-h-7 items-center gap-2 text-sm text-[var(--muted)]">
            <span className="h-2 w-2 animate-pulse rounded-full bg-[var(--primary)]" />
            {t("chat.thinking")}
          </div>
        ) : (
          <>
            <article
              className={cn(
                "text-[15px] leading-7 text-[var(--text)]",
                "[&_p]:mb-3 [&_p:last-child]:mb-0",
                "[&_pre]:my-3 [&_pre]:bg-[var(--code-block)] [&_pre]:p-4 [&_pre]:text-sm",
                "[&_code]:rounded [&_code]:bg-[var(--code-inline)] [&_code]:px-1 [&_code]:py-0.5",
                "[&_pre_code]:bg-transparent [&_pre_code]:p-0",
              )}
            >
              <MarkdownMessage content={message.content} />
            </article>
            {activeResults.length > 0 ? (
              <CitationBadges
                results={activeResults}
                content={message.content}
              />
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}
