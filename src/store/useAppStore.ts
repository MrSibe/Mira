import { create } from "zustand";
import { listen } from "@tauri-apps/api/event";
import type {
  ChatMessage,
  Conversation,
  Memory,
  MemoryPatch,
  MessageStreamDelta,
  ModelConfig,
  ModelSettings,
  Page,
  Project,
  SendMessageResult,
  ThemeMode,
} from "../core/types";
import { tauriClient } from "../core/tauriClient";
import { fallbackMessage } from "./fallbackMessage";
import {
  applyThemeMode,
  readStoredThemeMode,
  storeThemeMode,
} from "../utils/theme";

let memoriesChangedUnlisten: Awaited<ReturnType<typeof listen>> | null = null;

export interface AppState {
  currentPage: Page;
  conversations: Conversation[];
  archivedConversations: Conversation[];
  projects: Project[];
  activeProjectId: string | null;
  activeConversationId: string | null;
  messages: ChatMessage[];
  modelConfigs: ModelConfig[];
  modelSettings: ModelSettings | null;
  activeModelConfigId: string | null;
  memories: Memory[];
  isSending: boolean;
  error: string | null;
  themeMode: ThemeMode;
  isSidebarCollapsed: boolean;
  setPage: (page: Page) => void;
  setThemeMode: (themeMode: ThemeMode) => void;
  toggleSidebar: () => void;
  setActiveProject: (projectId: string | null) => void;
  bootstrap: () => Promise<void>;
  createConversation: () => Promise<void>;
  createProject: (name: string) => Promise<void>;
  deleteProject: (projectId: string) => Promise<void>;
  selectConversation: (conversationId: string) => Promise<void>;
  archiveConversation: (conversationId: string) => Promise<void>;
  restoreConversation: (conversationId: string) => Promise<void>;
  deleteConversation: (conversationId: string) => Promise<void>;
  moveConversationToProject: (
    conversationId: string,
    projectId: string | null,
  ) => Promise<void>;
  sendMessage: (content: string) => Promise<void>;
  setActiveModel: (modelConfigId: string) => void;
  saveModelSettings: (settings: ModelSettings) => Promise<void>;
  loadMemories: (query?: string) => Promise<void>;
  createSavedMemory: (fact: string) => Promise<void>;
  updateMemory: (id: number, patch: MemoryPatch) => Promise<void>;
  deleteMemory: (id: number) => Promise<void>;
  runMemoryCleanup: () => Promise<void>;
  saveModelConfig: (config: ModelConfig) => Promise<void>;
}

export const useAppStore = create<AppState>((set, get) => ({
  currentPage: "chat",
  conversations: [],
  archivedConversations: [],
  projects: [],
  activeProjectId: null,
  activeConversationId: null,
  messages: [],
  modelConfigs: [],
  modelSettings: null,
  activeModelConfigId: null,
  memories: [],
  isSending: false,
  error: null,
  themeMode: readStoredThemeMode(),
  isSidebarCollapsed: false,
  setPage: (page) => set({ currentPage: page }),
  setThemeMode: (themeMode) => {
    storeThemeMode(themeMode);
    applyThemeMode(themeMode);
    set({ themeMode });
  },
  toggleSidebar: () =>
    set((state) => ({ isSidebarCollapsed: !state.isSidebarCollapsed })),
  setActiveProject: (projectId) => set({ activeProjectId: projectId }),
  bootstrap: async () => {
    try {
      const [
        conversations,
        archivedConversations,
        projects,
        modelConfigs,
        modelSettings,
        memories,
      ] = await Promise.all([
        tauriClient.listConversations(),
        tauriClient.listArchivedConversations(),
        tauriClient.listProjects(),
        tauriClient.listModelConfigs(),
        tauriClient.getModelSettings(),
        tauriClient.listMemories(),
      ]);
      const activeConversationId = conversations[0]?.id ?? null;
      const messages = activeConversationId
        ? await tauriClient.getConversationMessages(activeConversationId)
        : [];
      const activeModelConfigId =
        modelSettings.chat_model_config_id ??
        modelConfigs.find((config) => config.is_default)?.id ??
        modelConfigs[0]?.id ??
        null;
      if (!memoriesChangedUnlisten) {
        memoriesChangedUnlisten = await listen("memories_changed", () => {
          void get().loadMemories();
        });
      }
      set({
        conversations,
        archivedConversations,
        projects,
        modelConfigs,
        modelSettings: {
          ...modelSettings,
          chat_model_config_id: activeModelConfigId,
        },
        memories,
        activeConversationId,
        activeModelConfigId,
        messages,
        error: null,
      });
    } catch (error) {
      set({
        error: String(error),
        messages: [
          fallbackMessage(
            "后端还没有准备好。请确认 Tauri dev server 正在运行，SQLite 初始化完成。",
          ),
        ],
      });
    }
  },
  createConversation: async () => {
    const conversation = await tauriClient.createConversation(
      undefined,
      get().activeProjectId,
    );
    set((state) => ({
      conversations: [conversation, ...state.conversations],
      activeConversationId: conversation.id,
      messages: [],
    }));
  },
  createProject: async (name) => {
    const project = await tauriClient.createProject(name);
    set((state) => ({
      projects: [project, ...state.projects],
      activeProjectId: project.id,
      currentPage: "chat",
    }));
  },
  deleteProject: async (projectId) => {
    await tauriClient.deleteProject(projectId);
    set((state) => ({
      projects: state.projects.filter((project) => project.id !== projectId),
      conversations: state.conversations.map((conversation) =>
        conversation.project_id === projectId
          ? { ...conversation, project_id: null }
          : conversation,
      ),
      activeProjectId:
        state.activeProjectId === projectId ? null : state.activeProjectId,
    }));
  },
  selectConversation: async (conversationId) => {
    const messages = await tauriClient.getConversationMessages(conversationId);
    const conversation = get().conversations.find(
      (item) => item.id === conversationId,
    );
    set({
      activeConversationId: conversationId,
      activeProjectId: conversation?.project_id ?? null,
      messages,
    });
  },
  archiveConversation: async (conversationId) => {
    await tauriClient.archiveConversation(conversationId);
    set((state) => {
      const conversation = state.conversations.find(
        (item) => item.id === conversationId,
      );
      const conversations = state.conversations.filter(
        (item) => item.id !== conversationId,
      );
      return {
        conversations,
        archivedConversations: conversation
          ? [
              { ...conversation, is_archived: true },
              ...state.archivedConversations,
            ]
          : state.archivedConversations,
        activeConversationId:
          state.activeConversationId === conversationId
            ? null
            : state.activeConversationId,
        messages:
          state.activeConversationId === conversationId ? [] : state.messages,
      };
    });
  },
  restoreConversation: async (conversationId) => {
    const restored = await tauriClient.restoreConversation(conversationId);
    set((state) => ({
      archivedConversations: state.archivedConversations.filter(
        (item) => item.id !== conversationId,
      ),
      conversations: [restored, ...state.conversations],
    }));
  },
  deleteConversation: async (conversationId) => {
    await tauriClient.deleteConversation(conversationId);
    set((state) => {
      const conversations = state.conversations.filter(
        (item) => item.id !== conversationId,
      );
      return {
        conversations,
        archivedConversations: state.archivedConversations.filter(
          (item) => item.id !== conversationId,
        ),
        activeConversationId:
          state.activeConversationId === conversationId
            ? null
            : state.activeConversationId,
        messages:
          state.activeConversationId === conversationId ? [] : state.messages,
      };
    });
  },
  moveConversationToProject: async (conversationId, projectId) => {
    const updated = await tauriClient.moveConversationToProject(
      conversationId,
      projectId,
    );
    set((state) => ({
      conversations: state.conversations.map((conversation) =>
        conversation.id === conversationId ? updated : conversation,
      ),
      activeProjectId:
        state.activeConversationId === conversationId
          ? updated.project_id
          : state.activeProjectId,
    }));
  },
  sendMessage: async (content) => {
    const trimmed = content.trim();
    if (!trimmed) {
      return;
    }

    let state = get();
    let conversationId = state.activeConversationId;
    let conversationProjectId = state.activeProjectId;

    try {
      if (!conversationId) {
        const conversation = await tauriClient.createConversation(
          titleFromContent(trimmed),
          state.activeProjectId,
        );
        conversationId = conversation.id;
        conversationProjectId = conversation.project_id;
        set((current) => ({
          conversations: [conversation, ...current.conversations],
          activeConversationId: conversation.id,
          activeProjectId: conversation.project_id,
          messages: [],
        }));
      }

      const requestId = crypto.randomUUID();
      const optimisticUserMessage: ChatMessage = {
        id: `optimistic-${crypto.randomUUID()}`,
        conversation_id: conversationId,
        role: "user",
        content: trimmed,
        created_at: new Date().toISOString(),
      };
      const optimisticAssistantMessage: ChatMessage = {
        id: `streaming-${requestId}`,
        conversation_id: conversationId,
        role: "assistant",
        content: "",
        created_at: new Date().toISOString(),
      };

      set((current) => ({
        isSending: true,
        error: null,
        messages:
          current.activeConversationId === conversationId
            ? [
                ...current.messages,
                optimisticUserMessage,
                optimisticAssistantMessage,
              ]
            : current.messages,
      }));

      state = get();
      const unlisten = await listen<MessageStreamDelta>(
        "message_stream_delta",
        (event) => {
          const delta = event.payload;
          set((current) => {
            if (
              delta.request_id !== requestId ||
              current.activeConversationId !== delta.conversation_id
            ) {
              return current;
            }
            return {
              messages: current.messages.map((message) =>
                message.id === optimisticAssistantMessage.id
                  ? { ...message, content: message.content + delta.content }
                  : message,
              ),
            };
          });
        },
      );

      let result: SendMessageResult;
      try {
        result = await tauriClient.sendMessage(
          conversationId,
          trimmed,
          state.activeModelConfigId,
          conversationProjectId,
          requestId,
        );
      } finally {
        unlisten();
      }

      set((current) => ({
        activeConversationId: result.conversation.id,
        activeProjectId:
          current.activeConversationId === result.conversation.id
            ? result.conversation.project_id
            : current.activeProjectId,
        conversations: [
          result.conversation,
          ...current.conversations.filter(
            (item) => item.id !== result.conversation.id,
          ),
        ],
        messages:
          current.activeConversationId === result.conversation.id
            ? [
                ...current.messages.map((message) =>
                  message.id === optimisticUserMessage.id
                    ? result.user_message
                    : message.id === optimisticAssistantMessage.id
                      ? result.assistant_message
                      : message,
                ),
              ]
            : current.messages,
        isSending: false,
      }));
      await get().loadMemories();
    } catch (error) {
      set({
        isSending: false,
        error: String(error),
        messages: [
          ...get().messages.filter(
            (message) => !message.id.startsWith("streaming-"),
          ),
          fallbackMessage(`发送失败：${String(error)}`),
        ],
      });
    }
  },
  setActiveModel: (modelConfigId) => {
    set((state) => ({
      activeModelConfigId: modelConfigId,
      modelSettings: {
        chat_model_config_id: modelConfigId,
        background_model_config_id:
          state.modelSettings?.background_model_config_id ?? null,
        background_model_follows_chat:
          state.modelSettings?.background_model_follows_chat ?? true,
      },
    }));
    const settings = get().modelSettings;
    if (settings) {
      void get().saveModelSettings(settings);
    }
  },
  saveModelSettings: async (settings) => {
    const saved = await tauriClient.saveModelSettings(settings);
    set({
      modelSettings: saved,
      activeModelConfigId:
        saved.chat_model_config_id ?? get().activeModelConfigId,
    });
  },
  loadMemories: async (query) => {
    const memories = await tauriClient.listMemories(query, undefined, false);
    set({ memories });
  },
  createSavedMemory: async (fact) => {
    const memory = await tauriClient.createSavedMemory(fact);
    set((state) => ({
      memories: [memory, ...state.memories],
    }));
  },
  updateMemory: async (id, patch) => {
    const updated = await tauriClient.updateMemory(id, patch);
    set((state) => ({
      memories: state.memories.map((memory) =>
        memory.id === id ? updated : memory,
      ),
    }));
  },
  deleteMemory: async (id) => {
    await tauriClient.deleteMemory(id);
    set((state) => ({
      memories: state.memories.filter((memory) => memory.id !== id),
    }));
  },
  runMemoryCleanup: async () => {
    await tauriClient.runMemoryCleanup();
    await get().loadMemories();
  },
  saveModelConfig: async (config) => {
    const saved = await tauriClient.saveModelConfig(config);
    set((state) => ({
      modelConfigs: state.modelConfigs.some((item) => item.id === saved.id)
        ? state.modelConfigs.map((item) =>
            item.id === saved.id ? saved : item,
          )
        : [saved, ...state.modelConfigs],
      activeModelConfigId: state.activeModelConfigId ?? saved.id,
      modelSettings: state.modelSettings ?? {
        chat_model_config_id: saved.id,
        background_model_config_id: null,
        background_model_follows_chat: true,
      },
    }));
  },
}));

function titleFromContent(content: string): string {
  const title = Array.from(content.trim()).slice(0, 24).join("");
  return title || "新对话";
}
