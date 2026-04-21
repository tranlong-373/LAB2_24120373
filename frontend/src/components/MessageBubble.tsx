import type { Message } from "@/lib/types";
import { cn } from "@/lib/utils";

type MessageBubbleProps = {
  message: Message;
};

export function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === "user";

  return (
    <div className={cn("flex w-full", isUser ? "justify-end" : "justify-start")}>
      <article
        className={cn(
          "max-w-[min(86%,44rem)] rounded-lg px-5 py-3 text-sm leading-relaxed shadow-xl shadow-black/18 sm:text-base",
          isUser
            ? "bg-white/18 text-white"
            : "liquid-glass bg-black/10 text-white/86"
        )}
      >
        <p className="whitespace-pre-wrap break-words">{message.content}</p>
      </article>
    </div>
  );
}
