import { ArrowUp, Globe } from "lucide-react";
import { FormEvent, useState } from "react";
import { useT } from "../i18n/useT";
import { useAppStore } from "../store/useAppStore";
import { Button } from "./ui/button";
import { Textarea } from "./ui/textarea";
import { cn } from "../utils/cn";

export function Composer() {
  const t = useT();
  const [content, setContent] = useState("");
  const [searchActive, setSearchActive] = useState(false);
  const isSending = useAppStore((state) => state.isSending);
  const sendMessage = useAppStore((state) => state.sendMessage);
  const tavilyConfigured =
    useAppStore((state) => state.tavilyConfig)?.credential_status ===
      "stored" && useAppStore((state) => state.tavilyConfig)?.enabled;

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    const trimmed = content.trim();
    if (!trimmed || isSending) {
      return;
    }
    setContent("");
    setSearchActive(false);
    await sendMessage(trimmed, searchActive);
  }

  return (
    <form
      className="shrink-0 bg-[var(--bg)] px-5 pb-5"
      onSubmit={(event) => void onSubmit(event)}
    >
      <div className="mx-auto max-w-3xl">
        <div className="flex min-h-14 items-end gap-2 rounded-2xl border border-[var(--border-strong)] bg-[var(--panel)] p-2 shadow-[var(--shadow-soft)]">
          <Textarea
            className="max-h-44 min-h-10 flex-1 border-0 bg-transparent px-2 py-2 shadow-none focus:border-0 focus:ring-0"
            placeholder={t("composer.placeholder")}
            value={content}
            onChange={(event) => setContent(event.currentTarget.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                void onSubmit(event);
              }
            }}
          />
          {tavilyConfigured ? (
            <button
              type="button"
              aria-label="Web search"
              title={searchActive ? "Web search on" : "Web search off"}
              className={cn(
                "mb-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-sm transition",
                searchActive
                  ? "bg-[var(--primary)] text-[var(--primary-text)]"
                  : "text-[var(--subtle)] hover:bg-[var(--hover)] hover:text-[var(--text)]",
              )}
              onClick={() => setSearchActive((v) => !v)}
            >
              <Globe className="h-4 w-4" />
            </button>
          ) : null}
          <Button
            aria-label={t("composer.send")}
            title={t("composer.send")}
            size="icon"
            className="mb-0.5 h-9 w-9 shrink-0 rounded-xl"
            disabled={!content.trim() || isSending}
          >
            <ArrowUp className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </form>
  );
}
