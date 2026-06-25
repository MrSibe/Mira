import { Suspense, lazy, useEffect, type ReactNode } from "react";
import { WindowTitleBar } from "./components/WindowTitleBar";
import { useAppStore } from "./store/useAppStore";
import { applyThemeMode } from "./utils/theme";

const ChatPage = lazy(() =>
  import("./pages/ChatPage").then((module) => ({ default: module.ChatPage })),
);
const SettingsPage = lazy(() =>
  import("./pages/SettingsPage").then((module) => ({
    default: module.SettingsPage,
  })),
);

export default function App() {
  const currentPage = useAppStore((state) => state.currentPage);
  const bootstrap = useAppStore((state) => state.bootstrap);
  const themeMode = useAppStore((state) => state.themeMode);

  useEffect(() => {
    void bootstrap();
  }, [bootstrap]);

  useEffect(() => {
    applyThemeMode(themeMode);
    if (themeMode !== "system") {
      return;
    }

    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => applyThemeMode("system");
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, [themeMode]);

  if (currentPage === "settings") {
    return (
      <AppFrame>
        <Suspense fallback={<PageFallback />}>
          <SettingsPage />
        </Suspense>
      </AppFrame>
    );
  }

  return (
    <AppFrame>
      <Suspense fallback={<PageFallback />}>
        <ChatPage />
      </Suspense>
    </AppFrame>
  );
}

function AppFrame({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-dvh max-h-dvh flex-col overflow-hidden bg-[var(--bg)] text-[var(--text)]">
      <WindowTitleBar />
      <div className="min-h-0 flex-1 overflow-hidden">{children}</div>
    </div>
  );
}

function PageFallback() {
  return <main className="h-full overflow-hidden bg-[var(--bg)]" />;
}
