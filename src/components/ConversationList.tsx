import {
  Archive,
  Check,
  Folder,
  FolderPlus,
  MessageCirclePlus,
  MessageSquareText,
  MoreHorizontal,
  Settings,
  Trash2,
  X,
} from "lucide-react";
import { FormEvent, MouseEvent, useEffect, useMemo, useState } from "react";
import type { Conversation } from "../core/types";
import { useAppStore } from "../store/useAppStore";
import { cn } from "../utils/cn";
import { AlertDialog } from "./ui/alert-dialog";
import { Button } from "./ui/button";
import { Input } from "./ui/input";

type DeleteTarget =
  | { kind: "conversation"; id: string; title: string }
  | { kind: "project"; id: string; title: string }
  | { kind: "archive"; id: string; title: string };

export function ConversationList() {
  const conversations = useAppStore((state) => state.conversations);
  const projects = useAppStore((state) => state.projects);
  const activeProjectId = useAppStore((state) => state.activeProjectId);
  const activeConversationId = useAppStore(
    (state) => state.activeConversationId,
  );
  const currentPage = useAppStore((state) => state.currentPage);
  const setPage = useAppStore((state) => state.setPage);
  const setActiveProject = useAppStore((state) => state.setActiveProject);
  const selectConversation = useAppStore((state) => state.selectConversation);
  const createConversation = useAppStore((state) => state.createConversation);
  const createProject = useAppStore((state) => state.createProject);
  const deleteProject = useAppStore((state) => state.deleteProject);
  const archiveConversation = useAppStore((state) => state.archiveConversation);
  const deleteConversation = useAppStore((state) => state.deleteConversation);
  const moveConversationToProject = useAppStore(
    (state) => state.moveConversationToProject,
  );
  const [isProjectDialogOpen, setIsProjectDialogOpen] = useState(false);
  const [projectName, setProjectName] = useState("");
  const [openProjectMenuId, setOpenProjectMenuId] = useState<string | null>(
    null,
  );
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);

  const conversationsByProject = useMemo(() => {
    return projects.map((project) => ({
      project,
      conversations: conversations.filter(
        (conversation) => conversation.project_id === project.id,
      ),
    }));
  }, [conversations, projects]);

  const unprojectedConversations = useMemo(
    () => conversations.filter((conversation) => !conversation.project_id),
    [conversations],
  );

  async function startConversation(projectId?: string | null) {
    setPage("chat");
    await createConversation(projectId);
  }

  async function openConversation(conversationId: string) {
    setPage("chat");
    await selectConversation(conversationId);
  }

  async function submitProject(event: FormEvent) {
    event.preventDefault();
    const trimmed = projectName.trim();
    if (!trimmed) {
      return;
    }
    setProjectName("");
    setIsProjectDialogOpen(false);
    await createProject(trimmed);
  }

  function stop(event: MouseEvent) {
    event.stopPropagation();
  }

  function confirmDeleteConversation(conversation: Conversation) {
    setDeleteTarget({
      kind: "conversation",
      id: conversation.id,
      title: conversation.title,
    });
  }

  function confirmArchiveConversation(conversation: Conversation) {
    setDeleteTarget({
      kind: "archive",
      id: conversation.id,
      title: conversation.title,
    });
  }

  function confirmDeleteProject(project: { id: string; name: string }) {
    setDeleteTarget({ kind: "project", id: project.id, title: project.name });
  }

  function runDeleteTarget() {
    if (!deleteTarget) {
      return;
    }
    if (deleteTarget.kind === "conversation") {
      void deleteConversation(deleteTarget.id);
    } else if (deleteTarget.kind === "archive") {
      void archiveConversation(deleteTarget.id);
    } else {
      void deleteProject(deleteTarget.id);
    }
  }

  return (
    <>
      <aside className="flex h-full min-h-0 flex-col border-r border-[var(--border)] bg-[var(--sidebar)] px-3 py-3">
        <div className="mb-2 flex items-center justify-between px-2">
          <span className="text-[13px] font-medium leading-5 text-[var(--subtle)]">
            项目
          </span>
          <button
            aria-label="新建项目"
            title="新建项目"
            className="rounded p-1 text-[var(--subtle)] transition hover:bg-[var(--hover)] hover:text-[var(--text)]"
            onClick={() => setIsProjectDialogOpen(true)}
          >
            <FolderPlus className="h-4 w-4" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto pr-1">
          <div className="space-y-2">
            {conversationsByProject.map(({ project, conversations }) => {
              const isProjectActive =
                activeProjectId === project.id &&
                !conversations.some((c) => c.id === activeConversationId);
              return (
                <section key={project.id}>
                  <div
                    className={cn(
                      "group relative flex h-8 items-center gap-2 rounded-md px-3 transition",
                      isProjectActive
                        ? "bg-[var(--active)] text-[var(--text)]"
                        : "text-[var(--text)] hover:bg-[var(--hover)]",
                    )}
                  >
                    <button
                      className="flex min-w-0 flex-1 items-center gap-2 text-left text-[13px] leading-5"
                      onClick={() => setActiveProject(project.id)}
                    >
                      <Folder className="h-4 w-4 shrink-0 text-[var(--subtle)]" />
                      <span className="truncate">{project.name}</span>
                    </button>
                    <button
                      aria-label="项目菜单"
                      title="项目菜单"
                      className={cn(
                        "rounded p-1 text-[var(--subtle)] transition hover:text-[var(--text)]",
                        isProjectActive
                          ? "opacity-100"
                          : "opacity-0 hover:bg-[var(--hover)] group-hover:opacity-100",
                      )}
                      onClick={(event) => {
                        event.stopPropagation();
                        setOpenProjectMenuId((current) =>
                          current === project.id ? null : project.id,
                        );
                      }}
                    >
                      <MoreHorizontal className="h-3.5 w-3.5" />
                    </button>
                    {openProjectMenuId === project.id ? (
                      <div className="absolute right-2 top-8 z-10 w-36 rounded-lg border border-[var(--border)] bg-[var(--panel)] p-1 shadow-[var(--shadow-soft)]">
                        <button
                          className="flex h-8 w-full items-center gap-2 rounded-md px-2 text-left text-[13px] leading-5 text-[var(--text)] hover:bg-[var(--hover)]"
                          onClick={() => {
                            setOpenProjectMenuId(null);
                            void startConversation(project.id);
                          }}
                        >
                          <MessageCirclePlus className="h-3.5 w-3.5" />
                          新对话
                        </button>
                        <button
                          className="flex h-8 w-full items-center gap-2 rounded-md px-2 text-left text-[13px] leading-5 text-[var(--danger)] hover:bg-[var(--hover)]"
                          onClick={() => {
                            setOpenProjectMenuId(null);
                            confirmDeleteProject(project);
                          }}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          删除项目
                        </button>
                      </div>
                    ) : null}
                  </div>

                  <div className="mt-1 space-y-1 pl-7">
                    {conversations.length > 0 ? (
                      conversations.map((conversation) => (
                        <ConversationRow
                          key={conversation.id}
                          conversation={conversation}
                          projects={projects}
                          isActive={
                            currentPage === "chat" &&
                            activeConversationId === conversation.id
                          }
                          onOpen={() => void openConversation(conversation.id)}
                          onArchive={(event) => {
                            stop(event);
                            void archiveConversation(conversation.id);
                          }}
                          onDelete={(event) => {
                            stop(event);
                            confirmDeleteConversation(conversation);
                          }}
                          onMove={(projectId) =>
                            void moveConversationToProject(
                              conversation.id,
                              projectId,
                            )
                          }
                        />
                      ))
                    ) : (
                      <div className="px-3 py-1.5 text-[13px] leading-5 text-[var(--subtle)]">
                        暂无对话
                      </div>
                    )}
                  </div>
                </section>
              );
            })}
          </div>

          <section className="mt-4">
            <div className="mb-2 flex items-center justify-between px-2">
              <span className="text-[13px] font-medium leading-5 text-[var(--subtle)]">
                对话
              </span>
              <button
                aria-label="新建对话"
                title="新建对话"
                className="rounded p-1 text-[var(--subtle)] transition hover:bg-[var(--hover)] hover:text-[var(--text)]"
                onClick={() => void startConversation(null)}
              >
                <MessageCirclePlus className="h-4 w-4" />
              </button>
            </div>
            {unprojectedConversations.length > 0 ? (
              <div className="space-y-1">
                {unprojectedConversations.map((conversation) => (
                  <ConversationRow
                    key={conversation.id}
                    conversation={conversation}
                    projects={projects}
                    isActive={
                      currentPage === "chat" &&
                      activeConversationId === conversation.id
                    }
                    onOpen={() => void openConversation(conversation.id)}
                    onArchive={(event) => {
                      stop(event);
                      confirmArchiveConversation(conversation);
                    }}
                    onDelete={(event) => {
                      stop(event);
                      confirmDeleteConversation(conversation);
                    }}
                    onMove={(projectId) =>
                      void moveConversationToProject(conversation.id, projectId)
                    }
                  />
                ))}
              </div>
            ) : null}
          </section>
        </div>

        <div className="mt-3">
          <button
            className={cn(
              "flex h-8 w-full items-center gap-2 rounded-md px-3 text-[13px] leading-5 transition",
              currentPage === "settings"
                ? "bg-[var(--active)] text-[var(--text)]"
                : "text-[var(--text)] hover:bg-[var(--hover)]",
            )}
            onClick={() => setPage("settings")}
          >
            <Settings className="h-3.5 w-3.5" />
            设置
          </button>
        </div>

        {isProjectDialogOpen ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4">
            <form
              className="w-full max-w-sm rounded-xl border border-[var(--border)] bg-[var(--panel)] p-4 shadow-[var(--shadow-soft)]"
              onSubmit={(event) => void submitProject(event)}
            >
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-sm font-semibold text-[var(--text)]">
                    新建项目
                  </h2>
                  <p className="mt-1 text-xs text-[var(--subtle)]">
                    项目会共享内部对话上下文
                  </p>
                </div>
                <button
                  aria-label="关闭"
                  title="关闭"
                  type="button"
                  className="rounded p-1 text-[var(--subtle)] hover:bg-[var(--hover)]"
                  onClick={() => {
                    setProjectName("");
                    setIsProjectDialogOpen(false);
                  }}
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <Input
                autoFocus
                placeholder="项目标题"
                value={projectName}
                onChange={(event) => setProjectName(event.currentTarget.value)}
              />
              <div className="mt-4 flex justify-end gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    setProjectName("");
                    setIsProjectDialogOpen(false);
                  }}
                >
                  取消
                </Button>
                <Button type="submit">
                  <FolderPlus className="h-4 w-4" />
                  创建
                </Button>
              </div>
            </form>
          </div>
        ) : null}
      </aside>
      <AlertDialog
        open={deleteTarget !== null}
        title={
          deleteTarget?.kind === "project"
            ? "删除项目"
            : deleteTarget?.kind === "archive"
              ? "归档对话"
              : "删除对话"
        }
        description={
          deleteTarget?.kind === "project"
            ? `将删除项目“${deleteTarget.title}”，项目内对话会移出项目。`
            : deleteTarget?.kind === "archive"
              ? `将归档对话“${deleteTarget.title}”，归档后可在设置中恢复。`
              : `将永久删除对话“${deleteTarget?.title ?? ""}”，此操作不可撤销。`
        }
        confirmLabel={deleteTarget?.kind === "archive" ? "归档" : "删除"}
        confirmVariant={deleteTarget?.kind === "archive" ? "default" : "danger"}
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

function ConversationRow({
  conversation,
  projects,
  isActive,
  onOpen,
  onArchive,
  onDelete,
  onMove,
}: {
  conversation: Conversation;
  projects: Array<{ id: string; name: string }>;
  isActive: boolean;
  onOpen: () => void;
  onArchive: (event: MouseEvent) => void;
  onDelete: (event: MouseEvent) => void;
  onMove: (projectId: string | null) => void;
}) {
  const [projectMenu, setProjectMenu] = useState<{
    x: number;
    y: number;
  } | null>(null);

  useEffect(() => {
    if (!projectMenu) {
      return;
    }
    const close = () => setProjectMenu(null);
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setProjectMenu(null);
      }
    };
    window.addEventListener("click", close);
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      window.removeEventListener("click", close);
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [projectMenu]);

  return (
    <article
      className={cn(
        "group mb-0.5 rounded-md px-2 py-1 transition",
        isActive
          ? "bg-[var(--active)] text-[var(--text)]"
          : "text-[var(--text)] hover:bg-[var(--hover)]",
      )}
      onContextMenu={(event) => {
        event.preventDefault();
        const menuHeight = Math.min(320, 56 + (projects.length + 1) * 34);
        setProjectMenu({
          x: Math.max(8, Math.min(event.clientX, window.innerWidth - 248)),
          y: Math.max(
            8,
            Math.min(event.clientY, window.innerHeight - menuHeight - 8),
          ),
        });
      }}
    >
      <div className="flex h-6 min-w-0 items-center gap-2">
        <button
          className="flex min-w-0 flex-1 items-center gap-2 text-left"
          onClick={onOpen}
        >
          <MessageSquareText className="h-3.5 w-3.5 shrink-0 text-[var(--subtle)]" />
          <span className="min-w-0 truncate text-[13px] leading-5">
            {conversation.title}
          </span>
        </button>

        <div className="relative h-6 w-[84px] shrink-0">
          <div className="absolute inset-0 flex items-center justify-end text-[13px] leading-5 text-[var(--subtle)] transition group-hover:pointer-events-none group-hover:opacity-0">
            {formatRecentTime(conversation.updated_at)}
          </div>
          <div className="absolute inset-0 flex items-center justify-end gap-1 opacity-0 transition group-hover:opacity-100">
            <Button
              aria-label="归档对话"
              title="归档对话"
              size="icon"
              variant="ghost"
              className="h-6 w-6 text-[var(--subtle)] hover:text-[var(--text)]"
              onClick={onArchive}
            >
              <Archive className="h-3.5 w-3.5" />
            </Button>
            <Button
              aria-label="删除对话"
              title="删除对话"
              size="icon"
              variant="ghost"
              className="h-6 w-6 text-[var(--subtle)] hover:text-[var(--danger)]"
              onClick={onDelete}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </div>

      {projectMenu ? (
        <div
          className="fixed z-50 max-h-[min(320px,calc(100vh-16px))] w-60 overflow-y-auto rounded-xl border border-[var(--border)] bg-[var(--panel)] p-1.5 shadow-[var(--shadow-soft)]"
          role="menu"
          style={{ left: projectMenu.x, top: projectMenu.y }}
          onClick={(event) => event.stopPropagation()}
        >
          <div className="px-2 py-1.5 text-[13px] font-medium leading-5 text-[var(--subtle)]">
            移动到项目
          </div>
          <ProjectMenuItem
            active={!conversation.project_id}
            label="无项目"
            onSelect={() => {
              onMove(null);
              setProjectMenu(null);
            }}
          />
          {projects.length > 0 ? (
            <div className="my-1 h-px bg-[var(--border)]" />
          ) : null}
          {projects.map((project) => (
            <ProjectMenuItem
              key={project.id}
              active={conversation.project_id === project.id}
              label={project.name}
              onSelect={() => {
                onMove(project.id);
                setProjectMenu(null);
              }}
            />
          ))}
        </div>
      ) : null}
    </article>
  );
}

function ProjectMenuItem({
  active,
  label,
  onSelect,
}: {
  active: boolean;
  label: string;
  onSelect: () => void;
}) {
  return (
    <button
      className="flex h-8 w-full items-center gap-2 rounded-lg px-2 text-left text-[13px] leading-5 text-[var(--text)] outline-none transition hover:bg-[var(--hover)] focus-visible:bg-[var(--hover)]"
      role="menuitem"
      onClick={onSelect}
    >
      <span className="flex h-4 w-4 shrink-0 items-center justify-center text-[var(--subtle)]">
        {active ? <Check className="h-3.5 w-3.5" /> : null}
      </span>
      <span className="min-w-0 truncate">{label}</span>
    </button>
  );
}

function formatRecentTime(value: string): string {
  const timestamp = new Date(value).getTime();
  if (Number.isNaN(timestamp)) {
    return "";
  }
  const diffSeconds = Math.max(0, Math.floor((Date.now() - timestamp) / 1000));
  if (diffSeconds < 60) {
    return "刚刚";
  }
  const diffMinutes = Math.floor(diffSeconds / 60);
  if (diffMinutes < 60) {
    return `${diffMinutes} 分钟前`;
  }
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) {
    return `${diffHours} 小时前`;
  }
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) {
    return `${diffDays} 天前`;
  }
  return new Date(value).toLocaleDateString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
  });
}
