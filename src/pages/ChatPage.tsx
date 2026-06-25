import { Sparkles } from "lucide-react";
import { AppShell } from "../components/AppShell";
import { Composer } from "../components/Composer";
import { MessageBubble } from "../components/MessageBubble";
import { Button } from "../components/ui/button";
import { useAppStore } from "../store/useAppStore";

const suggestions = [
  "整理一下我最近在做的项目",
  "帮我记住这个项目的技术栈",
  "根据我的偏好给出实现建议",
  "继续上次的讨论",
];

export function ChatPage() {
  const messages = useAppStore((state) => state.messages);
  const sendMessage = useAppStore((state) => state.sendMessage);

  return (
    <AppShell>
      <main className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden bg-[var(--bg)]">
        <div className="min-h-0 flex-1 overflow-y-auto px-5">
          <div className="mx-auto flex min-h-full w-full max-w-3xl flex-col">
            {messages.length === 0 ? (
              <div className="flex flex-1 flex-col items-center justify-center pb-24 text-center">
                <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--panel)] shadow-sm">
                  <Sparkles className="h-5 w-5 text-[var(--text)]" />
                </div>
                <h1 className="text-2xl font-semibold tracking-normal text-[var(--text)]">
                  今天想聊什么？
                </h1>
                <div className="mt-8 grid w-full max-w-2xl grid-cols-2 gap-2">
                  {suggestions.map((suggestion) => (
                    <Button
                      key={suggestion}
                      className="h-auto justify-start whitespace-normal rounded-xl px-4 py-3 text-left text-sm font-normal leading-5"
                      variant="outline"
                      onClick={() => void sendMessage(suggestion)}
                    >
                      {suggestion}
                    </Button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-6 pb-32 pt-4">
                {messages.map((message) => (
                  <MessageBubble key={message.id} message={message} />
                ))}
              </div>
            )}
          </div>
        </div>

        <Composer />
      </main>
    </AppShell>
  );
}
