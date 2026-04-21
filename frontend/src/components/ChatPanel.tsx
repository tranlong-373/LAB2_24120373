import { FormEvent, KeyboardEvent, useEffect, useRef, useState } from "react";
import { Loader2, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { MessageBubble } from "@/components/MessageBubble";
import type { Conversation, Message } from "@/lib/types";
import { cn } from "@/lib/utils";

type ChatPanelProps = {
  conversation: Conversation | null;
  messages: Message[];
  isAuthenticated: boolean;
  isSending: boolean;
  isLoadingMessages: boolean;
  error: string;
  onSend: (message: string) => Promise<void>;
  onRequireLogin: () => void;
};

function getConversationTitle(conversation: Conversation | null) {
  if (!conversation) {
    return "Cuộc trò chuyện mới";
  }

  return conversation.title.trim() || "Cuộc trò chuyện mới";
}

export function ChatPanel({
  conversation,
  messages,
  isAuthenticated,
  isSending,
  isLoadingMessages,
  error,
  onSend,
  onRequireLogin
}: ChatPanelProps) {
  const [draft, setDraft] = useState("");
  const endRef = useRef<HTMLDivElement | null>(null);
  const isLocked = !isAuthenticated;
  const isInputDisabled = isLocked || isSending;

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, isSending]);

  async function submitMessage(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();

    if (isLocked) {
      onRequireLogin();
      return;
    }

    const message = draft.trim();

    if (!message || isSending) {
      return;
    }

    setDraft("");
    await onSend(message);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void submitMessage();
    }
  }

  return (
    <section className="liquid-glass animate-fade-rise-delay flex min-h-[calc(100vh-32px)] flex-col rounded-lg p-4 sm:p-5">
      <div className="flex flex-col gap-2 border-b border-white/10 pb-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase text-white/42">
            Chatbot
          </p>
          <h1 className="font-display mt-2 truncate text-4xl font-normal leading-none text-white sm:text-5xl">
            {getConversationTitle(conversation)}
          </h1>
        </div>
        <p className="text-sm text-white/48">
          {isAuthenticated ? "Đã kết nối FastAPI" : "Cần đăng nhập để gửi tin nhắn"}
        </p>
      </div>

      <div className="thin-scrollbar min-h-0 flex-1 overflow-y-auto py-5 pr-1 sm:pr-3">
        {isLoadingMessages ? (
          <div className="flex h-full min-h-[360px] items-center justify-center text-sm text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Đang tải tin nhắn
          </div>
        ) : messages.length === 0 ? (
          <div className="flex h-full min-h-[360px] items-center justify-center px-4 text-center">
            <p className="font-display max-w-xl text-4xl leading-tight text-white/78 sm:text-5xl">
              {isAuthenticated
                ? "Nhập tin nhắn đầu tiên để bắt đầu."
                : "Đăng nhập để bắt đầu trò chuyện."}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {messages.map((message) => (
              <MessageBubble key={message.id} message={message} />
            ))}
            {isSending ? (
              <div className="flex justify-start">
                <div className="liquid-glass rounded-lg px-5 py-3 text-sm text-white/72">
                  <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
                  Đang suy nghĩ
                </div>
              </div>
            ) : null}
            <div ref={endRef} />
          </div>
        )}
      </div>

      {error ? (
        <p className="mb-4 rounded-lg bg-white/[0.06] px-4 py-3 text-sm leading-relaxed text-white/82">
          {error}
        </p>
      ) : null}

      <form
        className="liquid-glass relative rounded-lg p-3"
        onSubmit={(event) => void submitMessage(event)}
      >
        {isLocked ? (
          <button
            type="button"
            className="absolute inset-0 z-10 flex items-center justify-center rounded-lg bg-black/20 text-sm font-medium text-white/82 backdrop-blur-[1px] transition hover:bg-black/25"
            onClick={onRequireLogin}
          >
            Đăng nhập để gửi tin nhắn
          </button>
        ) : null}

        <div className={cn("flex flex-col gap-3 sm:flex-row", isLocked && "opacity-55")}>
          <Textarea
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isInputDisabled}
            placeholder={isLocked ? "Vui lòng đăng nhập" : "Nhập tin nhắn..."}
            className="max-h-36 flex-1"
          />
          <Button
            type="submit"
            variant="glass"
            className={cn("h-[52px] rounded-lg px-7", !draft.trim() && "opacity-70")}
            disabled={isInputDisabled || !draft.trim()}
          >
            {isSending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Send className="mr-2 h-4 w-4" />
            )}
            Gửi
          </Button>
        </div>
      </form>
    </section>
  );
}
