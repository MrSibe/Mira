import { Bot } from "lucide-react";
import type { ChatMessage } from "../core/types";
import { cn } from "../utils/cn";
import { MarkdownMessage } from "./MarkdownMessage";

export function MessageBubble({ message }: { message: ChatMessage }) {
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
      {message.content.trim().length === 0 ? (
        <div className="flex min-h-7 items-center gap-2 text-sm text-[var(--muted)]">
          <span className="h-2 w-2 animate-pulse rounded-full bg-[var(--primary)]" />
          Mira is thinking
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
