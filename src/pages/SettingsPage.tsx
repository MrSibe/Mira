import {
  ArrowLeft,
  Archive,
  Bot,
  Check,
  KeyRound,
  Laptop,
  Moon,
  Palette,
  Pencil,
  Plus,
  RefreshCcw,
  Save,
  Search,
  Server,
  Sun,
  Trash2,
  Undo2,
  X,
} from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { AlertDialog } from "../components/ui/alert-dialog";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Textarea } from "../components/ui/textarea";
import type {
  Conversation,
  Memory,
  ModelConfig,
  ModelSettings,
  ThemeMode,
} from "../core/types";
import { useAppStore } from "../store/useAppStore";
import { cn } from "../utils/cn";

type SettingsSection =
  | "appearance"
  | "providers"
  | "models"
  | "memories"
  | "archive";
type DeleteTarget =
  | { kind: "memory"; id: number }
  | { kind: "conversation"; conversation: Conversation };

const themeOptions: Array<{
  value: ThemeMode;
  label: string;
  icon: typeof Sun;
}> = [
  { value: "light", label: "浅色", icon: Sun },
  { value: "dark", label: "深色", icon: Moon },
  { value: "system", label: "跟随系统", icon: Laptop },
];

export function SettingsPage() {
  const modelConfigs = useAppStore((state) => state.modelConfigs);
  const modelSettings = useAppStore((state) => state.modelSettings);
  const saveModelConfig = useAppStore((state) => state.saveModelConfig);
  const saveModelSettings = useAppStore((state) => state.saveModelSettings);
  const themeMode = useAppStore((state) => state.themeMode);
  const setThemeMode = useAppStore((state) => state.setThemeMode);
  const memories = useAppStore((state) => state.memories);
  const loadMemories = useAppStore((state) => state.loadMemories);
  const createSavedMemory = useAppStore((state) => state.createSavedMemory);
  const updateMemory = useAppStore((state) => state.updateMemory);
  const deleteMemory = useAppStore((state) => state.deleteMemory);
  const archivedConversations = useAppStore(
    (state) => state.archivedConversations,
  );
  const restoreConversation = useAppStore((state) => state.restoreConversation);
  const deleteConversation = useAppStore((state) => state.deleteConversation);
  const setPage = useAppStore((state) => state.setPage);
  const [section, setSection] = useState<SettingsSection>("providers");
  const visibleModelConfigs = useMemo(
    () =>
      modelConfigs.filter(
        (config) =>
          config.provider !== "mock" && config.base_url !== "mock://local",
      ),
    [modelConfigs],
  );
  const [draftId, setDraftId] = useState(visibleModelConfigs[0]?.id ?? "");
  const selected = visibleModelConfigs.find((config) => config.id === draftId);
  const [draft, setDraft] = useState<ModelConfig | null>(selected ?? null);
  const [newMemoryFact, setNewMemoryFact] = useState("");
  const [editingMemoryId, setEditingMemoryId] = useState<number | null>(null);
  const [editingFact, setEditingFact] = useState("");
  const [archiveQuery, setArchiveQuery] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);

  useEffect(() => {
    if (!draftId && visibleModelConfigs[0]) {
      setDraftId(visibleModelConfigs[0].id);
    }
  }, [draftId, visibleModelConfigs]);

  useEffect(() => {
    if (selected) {
      setDraft(selected);
    }
  }, [selected]);

  useEffect(() => {
    void loadMemories();
  }, [loadMemories]);

  const filteredArchivedConversations = useMemo(() => {
    const query = archiveQuery.trim().toLowerCase();
    if (!query) {
      return archivedConversations;
    }
    return archivedConversations.filter((conversation) =>
      conversation.title.toLowerCase().includes(query),
    );
  }, [archivedConversations, archiveQuery]);

  function updateDraft(patch: Partial<ModelConfig>) {
    setDraft((current) => (current ? { ...current, ...patch } : current));
  }

  function createCustomDraft() {
    const id = `custom-${Date.now()}`;
    const config: ModelConfig = {
      id,
      provider: "custom",
      name: "自定义 Provider",
      base_url: "https://api.example.com/v1",
      model: "custom-model",
      api_key: null,
      is_default: false,
    };
    setSection("providers");
    setDraftId(id);
    setDraft(config);
  }

  async function submitSavedMemory(event: FormEvent) {
    event.preventDefault();
    const trimmed = newMemoryFact.trim();
    if (!trimmed) {
      return;
    }
    setNewMemoryFact("");
    await createSavedMemory(trimmed);
  }

  async function saveEditedMemory(id: number) {
    const trimmed = editingFact.trim();
    if (!trimmed) {
      return;
    }
    await updateMemory(id, { fact: trimmed });
    setEditingMemoryId(null);
    setEditingFact("");
  }

  function confirmDeleteMemory(id: number) {
    setDeleteTarget({ kind: "memory", id });
  }

  function confirmDeleteConversation(conversation: Conversation) {
    setDeleteTarget({ kind: "conversation", conversation });
  }

  function runDeleteTarget() {
    if (!deleteTarget) {
      return;
    }
    if (deleteTarget.kind === "memory") {
      void deleteMemory(deleteTarget.id);
    } else {
      void deleteConversation(deleteTarget.conversation.id);
    }
  }

  return (
    <>
      <main className="grid h-full min-w-0 grid-cols-[260px_minmax(0,1fr)] overflow-hidden bg-[var(--bg)] text-[var(--text)]">
        <aside className="flex min-h-0 flex-col border-r border-[var(--border)] bg-[var(--panel-soft)] px-3 py-4">
          <div className="mb-5 flex items-center justify-between px-2">
            <h1 className="text-base font-semibold">设置</h1>
            <button
              aria-label="返回聊天"
              title="返回聊天"
              className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--muted)] transition hover:bg-[var(--hover)] hover:text-[var(--text)]"
              onClick={() => setPage("chat")}
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
          </div>

          <div className="space-y-1">
            <SettingsNavButton
              active={section === "appearance"}
              icon={Palette}
              label="外观"
              onClick={() => setSection("appearance")}
            />
            <SettingsNavButton
              active={section === "providers"}
              icon={Server}
              label="供应商"
              onClick={() => setSection("providers")}
            />
            <SettingsNavButton
              active={section === "models"}
              icon={Bot}
              label="模型"
              onClick={() => setSection("models")}
            />
            <SettingsNavButton
              active={section === "memories"}
              icon={KeyRound}
              label="记忆"
              onClick={() => setSection("memories")}
            />
            <SettingsNavButton
              active={section === "archive"}
              icon={Archive}
              label="归档"
              count={archivedConversations.length}
              onClick={() => setSection("archive")}
            />
          </div>
        </aside>

        <section className="min-h-0 overflow-y-auto">
          {section === "appearance"
            ? renderAppearance(themeMode, setThemeMode)
            : null}
          {section === "providers"
            ? renderProviders({
                configs: visibleModelConfigs,
                draft,
                draftId,
                setDraftId,
                updateDraft,
                saveModelConfig,
                createCustomDraft,
              })
            : null}
          {section === "models"
            ? renderModels({
                configs: visibleModelConfigs,
                settings: modelSettings,
                saveModelSettings,
              })
            : null}
          {section === "memories"
            ? renderMemories({
                memories,
                newMemoryFact,
                editingMemoryId,
                editingFact,
                setNewMemoryFact,
                setEditingMemoryId,
                setEditingFact,
                submitSavedMemory,
                saveEditedMemory,
                confirmDeleteMemory,
                loadMemories,
              })
            : null}
          {section === "archive"
            ? renderArchive({
                query: archiveQuery,
                setQuery: setArchiveQuery,
                conversations: filteredArchivedConversations,
                restoreConversation,
                confirmDeleteConversation,
              })
            : null}
        </section>
      </main>
      <AlertDialog
        open={deleteTarget !== null}
        title={
          deleteTarget?.kind === "conversation" ? "删除归档对话" : "删除记忆"
        }
        description={
          deleteTarget?.kind === "conversation"
            ? `将永久删除“${deleteTarget.conversation.title}”，此操作不可撤销。`
            : "将永久删除这条记忆，此操作不可撤销。"
        }
        confirmLabel="删除"
        onConfirm={runDeleteTarget}
        onOpenChange={(open) => {
          if (!open) {
            setDeleteTarget(null);
          }
        }}
      />
    </>
  );
}

function SettingsNavButton({
  active,
  icon: Icon,
  label,
  count,
  onClick,
}: {
  active: boolean;
  icon: typeof Sun;
  label: string;
  count?: number;
  onClick: () => void;
}) {
  return (
    <button
      className={cn(
        "flex h-10 w-full items-center gap-3 rounded-lg px-3 text-sm transition",
        active
          ? "bg-[var(--active)] text-[var(--text)]"
          : "text-[var(--text)] hover:bg-[var(--hover)]",
      )}
      onClick={onClick}
    >
      <Icon className="h-4 w-4 text-[var(--subtle)]" />
      <span className="min-w-0 flex-1 text-left">{label}</span>
      {typeof count === "number" ? (
        <span className="rounded-full bg-[var(--panel)] px-2 py-0.5 text-xs text-[var(--subtle)]">
          {count}
        </span>
      ) : null}
    </button>
  );
}

function renderAppearance(
  themeMode: ThemeMode,
  setThemeMode: (themeMode: ThemeMode) => void,
) {
  return (
    <div className="mx-auto flex min-h-full w-full max-w-5xl flex-col px-8 py-8">
      <header className="mb-8">
        <h2 className="text-2xl font-semibold">外观</h2>
        <p className="mt-2 text-sm text-[var(--subtle)]">
          调整 Mira 的深浅色显示方式。
        </p>
      </header>
      <div className="inline-flex w-fit rounded-lg border border-[var(--border-strong)] bg-[var(--panel-soft)] p-1">
        {themeOptions.map((option) => {
          const Icon = option.icon;
          return (
            <button
              key={option.value}
              type="button"
              className={cn(
                "inline-flex h-10 items-center gap-2 rounded-md px-4 text-sm text-[var(--muted)] transition",
                themeMode === option.value &&
                  "bg-[var(--panel)] text-[var(--text)] shadow-sm",
              )}
              onClick={() => setThemeMode(option.value)}
            >
              <Icon className="h-4 w-4" />
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function renderProviders({
  configs,
  draft,
  draftId,
  setDraftId,
  updateDraft,
  saveModelConfig,
  createCustomDraft,
}: {
  configs: ModelConfig[];
  draft: ModelConfig | null;
  draftId: string;
  setDraftId: (id: string) => void;
  updateDraft: (patch: Partial<ModelConfig>) => void;
  saveModelConfig: (config: ModelConfig) => Promise<void>;
  createCustomDraft: () => void;
}) {
  const providerItems =
    draft && !configs.some((config) => config.id === draft.id)
      ? [draft, ...configs]
      : configs;

  return (
    <div className="grid h-full min-h-0 grid-cols-[250px_minmax(0,1fr)]">
      <aside className="min-h-0 border-r border-[var(--border)] bg-[var(--panel)] px-3 py-4">
        <div className="mb-3 flex items-center justify-between px-2">
          <span className="text-xs font-medium text-[var(--subtle)]">
            供应商
          </span>
          <button
            aria-label="新增供应商"
            title="新增供应商"
            className="rounded p-1 text-[var(--subtle)] hover:bg-[var(--hover)] hover:text-[var(--text)]"
            onClick={createCustomDraft}
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>
        <div className="space-y-1">
          {providerItems.length === 0 ? (
            <div className="px-2 py-3 text-xs leading-5 text-[var(--subtle)]">
              暂无供应商
            </div>
          ) : (
            providerItems.map((config) => (
              <button
                key={config.id}
                className={cn(
                  "w-full rounded-lg px-3 py-2 text-left text-sm transition hover:bg-[var(--hover)]",
                  draftId === config.id
                    ? "bg-[var(--active)] text-[var(--text)]"
                    : "text-[var(--text)]",
                )}
                onClick={() => setDraftId(config.id)}
              >
                <span className="block truncate font-medium">
                  {config.name}
                </span>
                <span className="block truncate text-xs text-[var(--subtle)]">
                  {config.provider}
                </span>
              </button>
            ))
          )}
        </div>
      </aside>

      <div className="min-h-0 overflow-y-auto px-8 py-8">
        <header className="mb-8">
          <h2 className="text-2xl font-semibold">供应商</h2>
          <p className="mt-2 text-sm text-[var(--subtle)]">
            API Key 存入系统凭据库，界面只显示脱敏状态。
          </p>
        </header>

        {draft ? (
          <form
            className="grid max-w-3xl gap-5"
            onSubmit={(event) => {
              event.preventDefault();
              void saveModelConfig(draft);
            }}
          >
            <label className="block text-sm font-medium">
              名称
              <Input
                className="mt-2"
                value={draft.name}
                onChange={(event) =>
                  updateDraft({ name: event.currentTarget.value })
                }
              />
            </label>
            <label className="block text-sm font-medium">
              Provider
              <Input
                className="mt-2"
                value={draft.provider}
                onChange={(event) =>
                  updateDraft({ provider: event.currentTarget.value })
                }
              />
            </label>
            <label className="block text-sm font-medium">
              Base URL
              <Input
                className="mt-2"
                value={draft.base_url}
                onChange={(event) =>
                  updateDraft({ base_url: event.currentTarget.value })
                }
              />
            </label>
            <label className="block text-sm font-medium">
              Model
              <Input
                className="mt-2"
                value={draft.model}
                onChange={(event) =>
                  updateDraft({ model: event.currentTarget.value })
                }
              />
            </label>
            <label className="block text-sm font-medium">
              API Key
              <Input
                className="mt-2"
                type="password"
                placeholder={
                  draft.api_key === "******" ? "已保存，留空不覆盖" : "sk-..."
                }
                value={draft.api_key === "******" ? "" : (draft.api_key ?? "")}
                onChange={(event) =>
                  updateDraft({ api_key: event.currentTarget.value || null })
                }
              />
              <span className="mt-2 block text-xs text-[var(--subtle)]">
                {credentialStatusText(draft)}
              </span>
            </label>
            <div className="flex flex-wrap gap-2">
              <Button>
                <Save className="h-4 w-4" />
                保存配置
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => void saveModelConfig({ ...draft, api_key: "" })}
              >
                <Trash2 className="h-4 w-4" />
                移除 Key
              </Button>
            </div>
          </form>
        ) : (
          <div className="rounded-lg border border-dashed border-[var(--border-strong)] px-4 py-10 text-sm text-[var(--subtle)]">
            暂无供应商配置
          </div>
        )}
      </div>
    </div>
  );
}

function renderModels({
  configs,
  settings,
  saveModelSettings,
}: {
  configs: ModelConfig[];
  settings: ModelSettings | null;
  saveModelSettings: (settings: ModelSettings) => Promise<void>;
}) {
  const fallbackChatModelId =
    settings?.chat_model_config_id ?? configs[0]?.id ?? null;
  const followsChat = settings?.background_model_follows_chat ?? true;
  const backgroundModelId =
    settings?.background_model_config_id ??
    fallbackChatModelId ??
    configs[0]?.id ??
    null;

  function updateSettings(patch: Partial<ModelSettings>) {
    const next: ModelSettings = {
      chat_model_config_id: fallbackChatModelId,
      background_model_config_id: settings?.background_model_config_id ?? null,
      background_model_follows_chat: followsChat,
      ...patch,
    };
    void saveModelSettings(next);
  }

  return (
    <div className="mx-auto flex min-h-full w-full max-w-5xl flex-col px-8 py-8">
      <header className="mb-8">
        <h2 className="text-2xl font-semibold">模型</h2>
        <p className="mt-2 text-sm text-[var(--subtle)]">
          对话模型负责聊天体验，后台模型用于记忆提炼、标题和摘要。
        </p>
      </header>

      <div className="grid max-w-3xl gap-5">
        <label className="block text-sm font-medium">
          对话模型
          <select
            className="mt-2 h-10 w-full rounded-md border border-[var(--border-strong)] bg-[var(--panel)] px-3 text-sm text-[var(--text)] outline-none transition focus-visible:ring-2 focus-visible:ring-[var(--border-strong)]"
            disabled={configs.length === 0}
            value={fallbackChatModelId ?? ""}
            onChange={(event) =>
              updateSettings({
                chat_model_config_id: event.currentTarget.value || null,
                background_model_config_id: followsChat
                  ? null
                  : (settings?.background_model_config_id ?? null),
              })
            }
          >
            {configs.length === 0 ? <option value="">暂无模型</option> : null}
            {configs.map((config) => (
              <option key={config.id} value={config.id}>
                {config.name} · {config.model}
              </option>
            ))}
          </select>
        </label>

        <div className="rounded-lg border border-[var(--border)] bg-[var(--panel-soft)] p-4">
          <label className="flex items-start gap-3 text-sm">
            <input
              type="checkbox"
              className="mt-0.5 h-4 w-4 accent-[var(--primary)]"
              checked={followsChat}
              onChange={(event) =>
                updateSettings({
                  background_model_follows_chat: event.currentTarget.checked,
                  background_model_config_id: event.currentTarget.checked
                    ? null
                    : backgroundModelId,
                })
              }
            />
            <span>
              <span className="block font-medium text-[var(--text)]">
                后台模型跟随对话模型
              </span>
              <span className="mt-1 block leading-5 text-[var(--subtle)]">
                推荐保持开启。关闭后可以为记忆 planner
                单独选择更便宜、稳定的模型。
              </span>
            </span>
          </label>
        </div>

        {!followsChat ? (
          <label className="block text-sm font-medium">
            后台模型
            <select
              className="mt-2 h-10 w-full rounded-md border border-[var(--border-strong)] bg-[var(--panel)] px-3 text-sm text-[var(--text)] outline-none transition focus-visible:ring-2 focus-visible:ring-[var(--border-strong)]"
              disabled={configs.length === 0}
              value={backgroundModelId ?? ""}
              onChange={(event) =>
                updateSettings({
                  background_model_follows_chat: false,
                  background_model_config_id: event.currentTarget.value || null,
                })
              }
            >
              {configs.length === 0 ? <option value="">暂无模型</option> : null}
              {configs.map((config) => (
                <option key={config.id} value={config.id}>
                  {config.name} · {config.model}
                </option>
              ))}
            </select>
          </label>
        ) : null}
      </div>
    </div>
  );
}

function credentialStatusText(config: ModelConfig): string {
  if (config.credential_status === "stored") {
    return "API Key 已保存到系统凭据库。";
  }
  if (config.credential_status === "error") {
    return `系统凭据读取失败：${config.credential_error ?? "未知错误"}`;
  }
  return "尚未保存 API Key。";
}

function renderMemories({
  memories,
  newMemoryFact,
  editingMemoryId,
  editingFact,
  setNewMemoryFact,
  setEditingMemoryId,
  setEditingFact,
  submitSavedMemory,
  saveEditedMemory,
  confirmDeleteMemory,
  loadMemories,
}: {
  memories: Memory[];
  newMemoryFact: string;
  editingMemoryId: number | null;
  editingFact: string;
  setNewMemoryFact: (value: string) => void;
  setEditingMemoryId: (value: number | null) => void;
  setEditingFact: (value: string) => void;
  submitSavedMemory: (event: FormEvent) => Promise<void>;
  saveEditedMemory: (id: number) => Promise<void>;
  confirmDeleteMemory: (id: number) => void;
  loadMemories: (query?: string) => Promise<void>;
}) {
  return (
    <div className="mx-auto flex min-h-full w-full max-w-5xl flex-col px-8 py-8">
      <header className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold">记忆</h2>
          <p className="mt-2 text-sm text-[var(--subtle)]">
            saved 可手动编辑，自动记忆只支持删除。
          </p>
        </div>
        <Button variant="outline" onClick={() => void loadMemories()}>
          <RefreshCcw className="h-4 w-4" />
          刷新
        </Button>
      </header>

      <form
        className="mb-5 flex max-w-3xl gap-2"
        onSubmit={(event) => void submitSavedMemory(event)}
      >
        <Input
          placeholder="新增 saved 记忆"
          value={newMemoryFact}
          onChange={(event) => setNewMemoryFact(event.currentTarget.value)}
        />
        <Button className="shrink-0" type="submit">
          <Plus className="h-4 w-4" />
          新增
        </Button>
      </form>

      {memories.length === 0 ? (
        <div className="rounded-lg border border-dashed border-[var(--border-strong)] px-4 py-10 text-center text-sm text-[var(--subtle)]">
          暂无记忆
        </div>
      ) : (
        <div className="space-y-2">
          {memories.map((memory) => (
            <article
              key={memory.id}
              className="rounded-lg border border-[var(--border)] bg-[var(--panel-soft)] p-3"
            >
              <div className="mb-2 flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2">
                  <Badge>{memory.memory_type ?? "chat_history"}</Badge>
                  <span className="truncate text-xs text-[var(--subtle)]">
                    使用 {memory.use_count} 次
                  </span>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  {memory.memory_type === "saved" ? (
                    editingMemoryId === memory.id ? (
                      <>
                        <Button
                          aria-label="保存记忆"
                          title="保存记忆"
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8"
                          onClick={() => void saveEditedMemory(memory.id)}
                        >
                          <Check className="h-4 w-4" />
                        </Button>
                        <Button
                          aria-label="取消编辑"
                          title="取消编辑"
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8"
                          onClick={() => {
                            setEditingMemoryId(null);
                            setEditingFact("");
                          }}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </>
                    ) : (
                      <Button
                        aria-label="编辑 saved 记忆"
                        title="编辑 saved 记忆"
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8"
                        onClick={() => {
                          setEditingMemoryId(memory.id);
                          setEditingFact(memory.fact);
                        }}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                    )
                  ) : null}
                  <Button
                    aria-label="删除记忆"
                    title="删除记忆"
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8"
                    onClick={() => confirmDeleteMemory(memory.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              {editingMemoryId === memory.id ? (
                <Textarea
                  value={editingFact}
                  onChange={(event) =>
                    setEditingFact(event.currentTarget.value)
                  }
                />
              ) : (
                <p className="text-sm leading-6 text-[var(--text)]">
                  {memory.fact}
                </p>
              )}
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

function renderArchive({
  query,
  setQuery,
  conversations,
  restoreConversation,
  confirmDeleteConversation,
}: {
  query: string;
  setQuery: (value: string) => void;
  conversations: Conversation[];
  restoreConversation: (conversationId: string) => Promise<void>;
  confirmDeleteConversation: (conversation: Conversation) => void;
}) {
  return (
    <div className="mx-auto flex min-h-full w-full max-w-5xl flex-col px-8 py-8">
      <header className="mb-6">
        <h2 className="text-2xl font-semibold">归档</h2>
        <p className="mt-2 text-sm text-[var(--subtle)]">
          搜索、恢复或删除已归档的对话。
        </p>
      </header>

      <label className="relative mb-5 block max-w-2xl">
        <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-[var(--subtle)]" />
        <Input
          className="h-9 pl-9"
          placeholder="搜索归档对话"
          value={query}
          onChange={(event) => setQuery(event.currentTarget.value)}
        />
      </label>

      {conversations.length === 0 ? (
        <div className="rounded-lg border border-dashed border-[var(--border-strong)] px-4 py-10 text-center text-sm text-[var(--subtle)]">
          暂无归档对话
        </div>
      ) : (
        <div className="space-y-2">
          {conversations.map((conversation) => (
            <article
              key={conversation.id}
              className="group rounded-lg border border-[var(--border)] bg-[var(--panel-soft)] p-3"
            >
              <div className="flex items-center gap-3">
                <Archive className="h-4 w-4 shrink-0 text-[var(--subtle)]" />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">
                    {conversation.title}
                  </div>
                  <div className="mt-0.5 text-xs text-[var(--subtle)]">
                    {new Date(conversation.updated_at).toLocaleString()}
                  </div>
                </div>
                <Button
                  aria-label="恢复对话"
                  title="恢复对话"
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8"
                  onClick={() => void restoreConversation(conversation.id)}
                >
                  <Undo2 className="h-4 w-4" />
                </Button>
                <Button
                  aria-label="删除对话"
                  title="删除对话"
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8"
                  onClick={() => confirmDeleteConversation(conversation)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
