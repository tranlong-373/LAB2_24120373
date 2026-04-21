import * as React from "react";
import { cn } from "@/lib/utils";

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, ...props }, ref) => (
    <textarea
      className={cn(
        "flex min-h-[52px] w-full resize-none rounded-lg border border-white/10 bg-white/[0.04] px-4 py-3 text-sm leading-relaxed text-foreground outline-none transition duration-300 placeholder:text-white/36 focus:border-white/30 focus:bg-white/[0.06] focus:ring-2 focus:ring-white/10 disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      ref={ref}
      {...props}
    />
  )
);

Textarea.displayName = "Textarea";

export { Textarea };
