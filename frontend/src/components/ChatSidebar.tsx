import { FormEvent, useState } from "react";
import { Check, KeyRound, Loader2, LogOut, MessageSquarePlus, Pencil, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Conversation, User } from "@/lib/types";
import { cn } from "@/lib/utils";

type ChatSidebarProps = {
  user: User | null;
  conversations: Conversation[];
  activeConversationId: string | null;
  isLoading: boolean;
  isCreating: boolean;
  onNewChat: () => void;
  onSelectConversation: (conversationId: string) => void;
  onRenameConversation: (conversationId: string, title: string) => void;
  onDeleteConversation: (conversationId: string) => void;
  onLogout: () => void;
  onRequireLogin: () => void;
  onSetupPassword: () => void;
};

function getConversationTitle(conversation: Conversation) {
  return conversation.title.trim() || "Cuộc trò chuyện mới";
}

export function ChatSidebar({
  user,
  conversations,
  activeConversationId,
  isLoading,
  isCreating,
  onNewChat,
  onSelectConversation,
  onRenameConversation,
  onDeleteConversation,
  onLogout,
  onRequireLogin,
  onSetupPassword
}: ChatSidebarProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftTitle, setDraftTitle] = useState("");
  const isAuthenticated = Boolean(user);
  const hasPasswordProvider = user?.providers?.includes("password") ?? false;

  function startRename(conversation: Conversation) {
    setEditingId(conversation.id);
    setDraftTitle(getConversationTitle(conversation));
  }

  function submitRename(event: FormEvent<HTMLFormElement>, conversationId: string) {
    event.preventDefault();
    const title = draftTitle.trim();

    if (!title) {
      return;
    }

    onRenameConversation(conversationId, title);
    setEditingId(null);
    setDraftTitle("");
  }

  function confirmDelete(conversation: Conversation) {
    const shouldDelete = window.confirm(`Xóa "${getConversationTitle(conversation)}"?`);

    if (shouldDelete) {
      onDeleteConversation(conversation.id);
    }
  }

  return (
    <aside className="liquid-glass animate-fade-rise flex min-h-[280px] flex-col rounded-lg p-4 lg:min-h-0">
      <div className="border-b border-white/10 pb-4">
        <p className="font-display text-3xl leading-none text-white sm:text-4xl">
          Trần Thiện Long - 24120373
        </p>
        <p className="mt-2 truncate text-sm text-white/58">
          {user?.email ?? "Chưa đăng nhập"}
        </p>
      </div>

      <Button
        type="button"
        variant="glass"
        className="mt-4 h-11 rounded-lg"
        onClick={isAuthenticated ? onNewChat : onRequireLogin}
        disabled={isCreating}
      >
        {isCreating ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <MessageSquarePlus className="mr-2 h-4 w-4" />
        )}
        New Chat
      </Button>

      <div className="mt-4 flex min-h-0 flex-1 flex-col">
        <div className="mb-3 flex items-center justify-between text-xs font-semibold uppercase text-white/42">
          <span>Conversations</span>
          {isLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
        </div>

        <div className="thin-scrollbar min-h-[180px] flex-1 space-y-2 overflow-y-auto pr-1">
          {!isAuthenticated ? (
            <p className="rounded-lg bg-white/[0.04] px-4 py-3 text-sm leading-relaxed text-white/58">
              Đăng nhập để xem lịch sử chat.
            </p>
          ) : conversations.length === 0 ? (
            <p className="rounded-lg bg-white/[0.04] px-4 py-3 text-sm leading-relaxed text-white/58">
              Chưa có cuộc trò chuyện.
            </p>
          ) : (
            conversations.map((conversation) => {
              const isActive = conversation.id === activeConversationId;
              const isEditing = conversation.id === editingId;

              if (isEditing) {
                return (
                  <form
                    key={conversation.id}
                    className="rounded-lg bg-white/[0.07] p-2"
                    onSubmit={(event) => submitRename(event, conversation.id)}
                  >
                    <input
                      value={draftTitle}
                      onChange={(event) => setDraftTitle(event.target.value)}
                      className="h-9 w-full rounded-lg border border-white/10 bg-black/20 px-3 text-sm text-white outline-none focus:border-white/30"
                      autoFocus
                    />
                    <div className="mt-2 grid grid-cols-2 gap-2">
                      <Button type="submit" variant="glass" size="sm" className="rounded-lg">
                        <Check className="mr-1.5 h-3.5 w-3.5" />
                        Lưu
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="rounded-lg"
                        onClick={() => setEditingId(null)}
                      >
                        <X className="mr-1.5 h-3.5 w-3.5" />
                        Hủy
                      </Button>
                    </div>
                  </form>
                );
              }

              return (
                <div
                  key={conversation.id}
                  className={cn(
                    "group flex items-center gap-1 rounded-lg p-1 transition",
                    isActive ? "bg-white/[0.11]" : "hover:bg-white/[0.06]"
                  )}
                >
                  <button
                    type="button"
                    className="min-w-0 flex-1 rounded-lg px-3 py-2 text-left text-sm text-white/80 outline-none transition hover:text-white focus-visible:ring-2 focus-visible:ring-white/20"
                    onClick={() => onSelectConversation(conversation.id)}
                  >
                    <span className="block truncate">{getConversationTitle(conversation)}</span>
                  </button>
                  <button
                    type="button"
                    className="rounded-lg p-2 text-white/42 opacity-100 transition hover:bg-white/[0.08] hover:text-white sm:opacity-0 sm:group-hover:opacity-100"
                    onClick={() => startRename(conversation)}
                    aria-label="Đổi tên cuộc trò chuyện"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    className="rounded-lg p-2 text-white/42 opacity-100 transition hover:bg-white/[0.08] hover:text-white sm:opacity-0 sm:group-hover:opacity-100"
                    onClick={() => confirmDelete(conversation)}
                    aria-label="Xóa cuộc trò chuyện"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              );
            })
          )}
        </div>
      </div>

      <div className="mt-4 border-t border-white/10 pt-4">
        {isAuthenticated ? (
          <div className="space-y-3">
            {!hasPasswordProvider ? (
              <Button
                type="button"
                variant="glass"
                className="h-11 w-full rounded-lg"
                onClick={onSetupPassword}
              >
                <KeyRound className="mr-2 h-4 w-4" />
                Thêm mật khẩu
              </Button>
            ) : null}

            <Button
              type="button"
              variant="outline"
              className="h-11 w-full rounded-lg"
              onClick={onLogout}
            >
              <LogOut className="mr-2 h-4 w-4" />
              Đăng xuất
            </Button>
          </div>
        ) : (
          <Button
            type="button"
            variant="outline"
            className="h-11 w-full rounded-lg"
            onClick={onRequireLogin}
          >
            Đăng nhập
          </Button>
        )}
      </div>
    </aside>
  );
}
