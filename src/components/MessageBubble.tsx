import { Bot, ChevronDown, ExternalLink, Search } from "lucide-react";
import { useState } from "react";
import { openUrl } from "@tauri-apps/plugin-opener";
import type { ChatMessage } from "../core/types";
import { useT } from "../i18n/useT";
import { cn } from "../utils/cn";
import { MarkdownMessage } from "./MarkdownMessage";

function SearchResultsCard({ message }: { message: ChatMessage }) {
  const t = useT();
  const [expanded, setExpanded] = useState(false);
  const results = message.search_results ?? [];
  const count = t("chat.searchResults", { n: results.length });

  return (
    <div className="w-full rounded-lg border border-[var(--border)] bg-[var(--panel-soft)]">
      <button
        className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm transition hover:bg-[var(--hover)]"
        onClick={() => setExpanded((v) => !v)}
      >
        <Search className="h-4 w-4 text-[var(--primary)]" />
        <span className="flex-1 font-medium text-[var(--text)]">{count}</span>
        <ChevronDown
          className={cn(
            "h-4 w-4 text-[var(--subtle)] transition-transform",
            expanded && "rotate-180",
          )}
        />
      </button>
      {expanded ? (
        <div className="space-y-1 border-t border-[var(--border)] px-3 py-2">
          {results.map((r, i) => (
            <div key={i} className="group flex items-start gap-2 py-1">
              <span className="mt-0.5 shrink-0 text-xs font-medium text-[var(--subtle)]">
                {i + 1}
              </span>
              <div className="min-w-0 flex-1">
                <button
                  className="truncate text-sm font-medium text-[var(--text)] underline-offset-2 hover:underline"
                  onClick={() => void openUrl(r.url)}
                >
                  {r.title}
                </button>
                <p className="mt-0.5 line-clamp-2 text-xs leading-5 text-[var(--subtle)]">
                  {r.content}
                </p>
              </div>
              <button
                aria-label="Open link"
                className="mt-0.5 shrink-0 rounded p-1 text-[var(--subtle)] opacity-0 transition hover:bg-[var(--hover)] hover:text-[var(--text)] group-hover:opacity-100"
                onClick={() => void openUrl(r.url)}
              >
                <ExternalLink className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function MessageBubble({ message }: { message: ChatMessage }) {
  const t = useT();
  const isUser = message.role === "user";

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
      {message.search_results && message.search_results.length > 0 ? (
        <div className="min-w-0 flex-1">
          <SearchResultsCard message={message} />
        </div>
      ) : message.content.trim().length === 0 ? (
        <div className="flex min-h-7 items-center gap-2 text-sm text-[var(--muted)]">
          <span className="h-2 w-2 animate-pulse rounded-full bg-[var(--primary)]" />
          {t("chat.thinking")}
        </div>
      ) : (
        <article
          className={cn(
            "min-w-0 flex-1 text-[15px] leading-7 text-[var(--text)]",
            "[&_p]:mb-3 [&_p:last-child]:mb-0",
            "[&_pre]:my-3 [&_pre]:bg-[var(--code-block)] [&_pre]:p-4 [&_pre]:text-sm",
            "[&_code]:rounded [&_code]:bg-[var(--code-inline)] [&_code]:px-1 [&_code]:py-0.5",
            "[&_pre_code]:bg-transparent [&_pre_code]:p-0",
          )}
        >
          <MarkdownMessage content={message.content} />
        </article>
      )}
    </div>
  );
}
