import { useEffect, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { ArrowRight, KeyRound, Loader2, LogIn, UserPlus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type AuthTab = "login" | "signup";
type AuthCardMode = "auth" | "setup-password";
type AuthLoadingAction = AuthTab | "google" | "setup-password";

type AuthCardProps = {
  error?: string;
  info?: string;
  loadingAction: AuthLoadingAction | null;
  mode?: AuthCardMode;
  defaultTab?: AuthTab;
  currentEmail?: string;
  pendingLinkEmail?: string;
  onLogin: (email: string, password: string) => Promise<void>;
  onSignup: (email: string, password: string, confirmPassword: string) => Promise<void>;
  onGoogleLogin: () => Promise<void> | void;
  onSetupPassword: (password: string, confirmPassword: string) => Promise<void>;
  onClose: () => void;
  className?: string;
};

const MIN_PASSWORD_LENGTH = 6;

export function AuthCard({
  error,
  info,
  loadingAction,
  mode = "auth",
  defaultTab = "login",
  currentEmail = "",
  pendingLinkEmail,
  onLogin,
  onSignup,
  onGoogleLogin,
  onSetupPassword,
  onClose,
  className
}: AuthCardProps) {
  const [tab, setTab] = useState<AuthTab>(defaultTab);
  const [email, setEmail] = useState(pendingLinkEmail ?? "");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [localError, setLocalError] = useState("");
  const isBusy = loadingAction !== null;
  const isSubmitLoading = loadingAction === tab;
  const isGoogleLoading = loadingAction === "google";
  const isSetupPasswordLoading = loadingAction === "setup-password";

  useEffect(() => {
    setTab(defaultTab);
  }, [defaultTab]);

  useEffect(() => {
    if (pendingLinkEmail) {
      setEmail(pendingLinkEmail);
    }
  }, [pendingLinkEmail]);

  function validatePasswordPair() {
    if (password.length < MIN_PASSWORD_LENGTH) {
      setLocalError("Mật khẩu phải có ít nhất 6 ký tự.");
      return false;
    }

    if (password !== confirmPassword) {
      setLocalError("Mật khẩu xác nhận không khớp.");
      return false;
    }

    setLocalError("");
    return true;
  }

  async function submitAuth(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLocalError("");

    const cleanEmail = email.trim();

    if (!cleanEmail) {
      setLocalError("Vui lòng nhập email.");
      return;
    }

    if (tab === "signup") {
      if (!validatePasswordPair()) {
        return;
      }

      await onSignup(cleanEmail, password, confirmPassword);
      return;
    }

    if (!password) {
      setLocalError("Vui lòng nhập mật khẩu.");
      return;
    }

    await onLogin(cleanEmail, password);
  }

  async function submitPasswordSetup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!validatePasswordPair()) {
      return;
    }

    await onSetupPassword(password, confirmPassword);
  }

  const visibleError = localError || error;

  if (mode === "setup-password") {
    return (
      <section
        className={cn(
          "liquid-glass w-full max-w-md rounded-lg p-5 text-left shadow-2xl shadow-black/35 sm:p-6",
          className
        )}
        aria-label="Thêm mật khẩu"
      >
        <Header eyebrow="Liên kết tài khoản" title="Thêm mật khẩu" onClose={onClose} />

        {visibleError ? <Message tone="error">{visibleError}</Message> : null}
        {info ? <Message>{info}</Message> : null}

        <form className="space-y-4" onSubmit={(event) => void submitPasswordSetup(event)}>
          <Field label="Email">
            <input
              value={currentEmail}
              disabled
              className="mt-2 h-11 w-full rounded-lg border border-white/10 bg-white/[0.03] px-4 text-sm text-white/70 outline-none"
            />
          </Field>
          <PasswordFields
            password={password}
            confirmPassword={confirmPassword}
            isLoading={isBusy}
            onPasswordChange={setPassword}
            onConfirmPasswordChange={setConfirmPassword}
          />
          <Button
            type="submit"
            variant="glass"
            className="h-11 w-full rounded-lg"
            disabled={isBusy}
          >
            {isSetupPasswordLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <KeyRound className="mr-2 h-4 w-4" />}
            Liên kết mật khẩu
          </Button>
        </form>
      </section>
    );
  }

  return (
    <section
      className={cn(
        "liquid-glass w-full max-w-md rounded-lg p-5 text-left shadow-2xl shadow-black/35 sm:p-6",
        className
      )}
      aria-label="Đăng nhập hoặc đăng ký"
    >
      <Header eyebrow="Firebase Authentication" title="Tài khoản" onClose={onClose} />

      <div className="mb-4 grid grid-cols-2 gap-2 rounded-lg bg-white/[0.04] p-1">
        <button
          type="button"
          className={cn(
            "rounded-lg px-3 py-2 text-sm text-white/64 transition",
            tab === "login" && "bg-white/[0.12] text-white"
          )}
          onClick={() => {
            setTab("login");
            setLocalError("");
          }}
          disabled={isBusy}
        >
          Đăng nhập
        </button>
        <button
          type="button"
          className={cn(
            "rounded-lg px-3 py-2 text-sm text-white/64 transition",
            tab === "signup" && "bg-white/[0.12] text-white"
          )}
          onClick={() => {
            setTab("signup");
            setLocalError("");
          }}
          disabled={isBusy}
        >
          Đăng ký
        </button>
      </div>

      {visibleError ? <Message tone="error">{visibleError}</Message> : null}
      {info ? <Message>{info}</Message> : null}

      <form className="space-y-4" onSubmit={(event) => void submitAuth(event)}>
        <Field label="Email">
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            disabled={isBusy || Boolean(pendingLinkEmail)}
            className="mt-2 h-11 w-full rounded-lg border border-white/10 bg-white/[0.04] px-4 text-sm text-white outline-none transition focus:border-white/30 focus:bg-white/[0.06] focus:ring-2 focus:ring-white/10 disabled:cursor-not-allowed disabled:opacity-60"
            placeholder="email@example.com"
            autoComplete="email"
          />
        </Field>

        <Field label="Mật khẩu">
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            disabled={isBusy}
            className="mt-2 h-11 w-full rounded-lg border border-white/10 bg-white/[0.04] px-4 text-sm text-white outline-none transition focus:border-white/30 focus:bg-white/[0.06] focus:ring-2 focus:ring-white/10 disabled:cursor-not-allowed disabled:opacity-60"
            placeholder="Nhập mật khẩu"
            autoComplete={tab === "login" ? "current-password" : "new-password"}
          />
        </Field>

        {tab === "signup" ? (
          <Field label="Xác nhận mật khẩu">
            <input
              type="password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              disabled={isBusy}
              className="mt-2 h-11 w-full rounded-lg border border-white/10 bg-white/[0.04] px-4 text-sm text-white outline-none transition focus:border-white/30 focus:bg-white/[0.06] focus:ring-2 focus:ring-white/10 disabled:cursor-not-allowed disabled:opacity-60"
              placeholder="Nhập lại mật khẩu"
              autoComplete="new-password"
            />
          </Field>
        ) : null}

        <Button
          type="submit"
          variant="glass"
          className="h-11 w-full rounded-lg"
          disabled={isBusy}
        >
          {isSubmitLoading ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : tab === "login" ? (
            <LogIn className="mr-2 h-4 w-4" />
          ) : (
            <UserPlus className="mr-2 h-4 w-4" />
          )}
          {tab === "login" ? "Đăng nhập" : "Tạo tài khoản"}
        </Button>
      </form>

      {tab === "login" ? (
        <>
          <div className="my-4 h-px bg-white/10" />
          <Button
            type="button"
            variant="outline"
            className="h-11 w-full rounded-lg"
            onClick={() => void onGoogleLogin()}
            disabled={isBusy}
          >
            {isGoogleLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ArrowRight className="mr-2 h-4 w-4" />}
            Tiếp tục với Google
          </Button>
        </>
      ) : null}
    </section>
  );
}

function Header({
  eyebrow,
  title,
  onClose
}: {
  eyebrow: string;
  title: string;
  onClose: () => void;
}) {
  return (
    <div className="mb-5 flex items-start justify-between gap-4">
      <div>
        <p className="text-xs font-semibold uppercase text-white/48">{eyebrow}</p>
        <h2 className="font-display mt-2 text-4xl font-normal leading-none text-white">
          {title}
        </h2>
      </div>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-9 w-9 rounded-lg"
        onClick={onClose}
        aria-label="Đóng"
      >
        <X className="h-4 w-4" />
      </Button>
    </div>
  );
}

function Message({ children, tone = "info" }: { children: string; tone?: "info" | "error" }) {
  return (
    <p
      className={cn(
        "mb-4 rounded-lg px-4 py-3 text-sm leading-relaxed text-white/82",
        tone === "error" ? "bg-red-950/35" : "bg-white/[0.06]"
      )}
    >
      {children}
    </p>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block text-sm text-white/72">
      {label}
      {children}
    </label>
  );
}

function PasswordFields({
  password,
  confirmPassword,
  isLoading,
  onPasswordChange,
  onConfirmPasswordChange
}: {
  password: string;
  confirmPassword: string;
  isLoading: boolean;
  onPasswordChange: (value: string) => void;
  onConfirmPasswordChange: (value: string) => void;
}) {
  return (
    <>
      <Field label="Mật khẩu mới">
        <input
          type="password"
          value={password}
          onChange={(event) => onPasswordChange(event.target.value)}
          disabled={isLoading}
          className="mt-2 h-11 w-full rounded-lg border border-white/10 bg-white/[0.04] px-4 text-sm text-white outline-none transition focus:border-white/30 focus:bg-white/[0.06] focus:ring-2 focus:ring-white/10 disabled:cursor-not-allowed disabled:opacity-60"
          placeholder="Ít nhất 6 ký tự"
          autoComplete="new-password"
        />
      </Field>
      <Field label="Xác nhận mật khẩu">
        <input
          type="password"
          value={confirmPassword}
          onChange={(event) => onConfirmPasswordChange(event.target.value)}
          disabled={isLoading}
          className="mt-2 h-11 w-full rounded-lg border border-white/10 bg-white/[0.04] px-4 text-sm text-white outline-none transition focus:border-white/30 focus:bg-white/[0.06] focus:ring-2 focus:ring-white/10 disabled:cursor-not-allowed disabled:opacity-60"
          placeholder="Nhập lại mật khẩu"
          autoComplete="new-password"
        />
      </Field>
    </>
  );
}
