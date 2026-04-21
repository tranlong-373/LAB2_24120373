import { useCallback, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { AuthCard } from "@/components/AuthCard";
import { BackgroundVideo } from "@/components/BackgroundVideo";
import { ChatPanel } from "@/components/ChatPanel";
import { ChatSidebar } from "@/components/ChatSidebar";
import {
  consumeGoogleSession,
  createConversation,
  createGoogleLoginUrl,
  deleteConversation,
  getConversationMessages,
  getConversations,
  me,
  renameConversation,
  sendChat,
  toFriendlyError
} from "@/lib/api";
import {
  AuthFlowError,
  clearSession,
  getFirebaseErrorCode,
  getStoredSession,
  linkPasswordToCurrentUser,
  logout,
  refreshStoredSession,
  saveSession,
  signInWithEmail,
  signUpWithEmail
} from "@/lib/auth";
import type { AuthResponse, ChatRole, Conversation, Message } from "@/lib/types";

type AuthTab = "login" | "signup";
type AuthModalMode = "auth" | "setup-password";
type AuthLoadingAction = AuthTab | "google" | "setup-password";

function createLocalMessageId(role: ChatRole) {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${role}-${crypto.randomUUID()}`;
  }

  return `${role}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function sortConversations(conversations: Conversation[]) {
  return [...conversations].sort((first, second) => {
    const firstTime = Date.parse(first.updated_at ?? first.created_at ?? "");
    const secondTime = Date.parse(second.updated_at ?? second.created_at ?? "");
    return (Number.isNaN(secondTime) ? 0 : secondTime) - (Number.isNaN(firstTime) ? 0 : firstTime);
  });
}

function upsertConversation(conversations: Conversation[], conversation: Conversation) {
  return sortConversations([
    conversation,
    ...conversations.filter((item) => item.id !== conversation.id)
  ]);
}

type GoogleRedirectResult =
  | { error: string }
  | { sessionId: string }
  | null;

function getGoogleRedirectResult(): GoogleRedirectResult {
  if (typeof window === "undefined") {
    return null;
  }

  const url = new URL(window.location.href);
  const hashParams = new URLSearchParams(url.hash.startsWith("#") ? url.hash.slice(1) : "");
  const error = hashParams.get("auth_error") ?? url.searchParams.get("auth_error");
  const sessionId = hashParams.get("google_session") ?? url.searchParams.get("google_session");

  if (error) {
    return { error };
  }

  if (sessionId) {
    return { sessionId };
  }

  return null;
}

function clearAuthRedirectParams() {
  if (typeof window !== "undefined") {
    window.history.replaceState({}, document.title, window.location.pathname || "/");
  }
}

function getFriendlyAuthError(error: unknown) {
  const code = error instanceof AuthFlowError ? error.code : getFirebaseErrorCode(error);
  const knownErrors: Record<string, string> = {
    "auth/email-already-in-use": "Email này đã tồn tại. Vui lòng đăng nhập.",
    "auth/weak-password": "Mật khẩu quá yếu. Vui lòng dùng ít nhất 6 ký tự.",
    "auth/wrong-password": "Mật khẩu không đúng.",
    "auth/invalid-credential": "Thông tin đăng nhập không hợp lệ. Nếu email này dùng Google, hãy tiếp tục với Google hoặc liên kết mật khẩu sau khi đăng nhập.",
    "auth/user-not-found": "Không tìm thấy tài khoản với email này.",
    "auth/operation-not-allowed": "Firebase chưa bật phương thức đăng nhập này.",
    "auth/popup-closed-by-user": "Bạn đã đóng cửa sổ đăng nhập Google.",
    "auth/account-exists-with-different-credential": "Email này đã tồn tại bằng phương thức khác. Hãy đăng nhập bằng phương thức cũ để liên kết tài khoản.",
    "auth/provider-already-linked": "Phương thức đăng nhập này đã được liên kết.",
    "auth/credential-already-in-use": "Thông tin đăng nhập này đã thuộc về một tài khoản khác.",
    "auth/too-many-requests": "Bạn thao tác quá nhiều lần. Vui lòng thử lại sau.",
    "auth/requires-recent-login": "Vui lòng đăng nhập lại trước khi liên kết phương thức mới.",
    "auth/google-account-without-password": "Email này đang dùng Google. Hãy đăng nhập bằng Google, sau đó thêm mật khẩu trong bảng tài khoản."
  };

  if (knownErrors[code]) {
    return knownErrors[code];
  }

  if (error instanceof AuthFlowError) {
    return error.message;
  }

  if (error instanceof TypeError && error.message.toLowerCase().includes("fetch")) {
    return "Frontend chưa kết nối được backend tại http://127.0.0.1:8000. Hãy chạy backend rồi thử lại.";
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Không thể hoàn tất xác thực. Vui lòng thử lại.";
}

export default function App() {
  const [session, setSession] = useState<AuthResponse | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isBooting, setIsBooting] = useState(true);
  const [isLoadingConversations, setIsLoadingConversations] = useState(false);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [isCreatingConversation, setIsCreatingConversation] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [authLoadingAction, setAuthLoadingAction] = useState<AuthLoadingAction | null>(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authModalMode, setAuthModalMode] = useState<AuthModalMode>("auth");
  const [authDefaultTab, setAuthDefaultTab] = useState<AuthTab>("login");
  const [authError, setAuthError] = useState("");
  const [authInfo, setAuthInfo] = useState("");
  const [chatError, setChatError] = useState("");

  const activeConversation =
    conversations.find((conversation) => conversation.id === activeConversationId) ?? null;

  const loadConversationMessages = useCallback(async (token: string, conversationId: string) => {
    setIsLoadingMessages(true);
    setChatError("");

    try {
      const history = await getConversationMessages(token, conversationId);
      setMessages(history);
    } catch (error) {
      setChatError(toFriendlyError(error, "Không thể tải tin nhắn của cuộc trò chuyện."));
      throw error;
    } finally {
      setIsLoadingMessages(false);
    }
  }, []);

  const loadConversationsForToken = useCallback(
    async (token: string, preferredConversationId?: string) => {
      setIsLoadingConversations(true);
      setChatError("");

      try {
        const loadedConversations = sortConversations(await getConversations(token));
        setConversations(loadedConversations);

        const selectedConversation =
          loadedConversations.find((conversation) => conversation.id === preferredConversationId) ??
          loadedConversations[0] ??
          null;

        setActiveConversationId(selectedConversation?.id ?? null);

        if (selectedConversation) {
          await loadConversationMessages(token, selectedConversation.id);
        } else {
          setMessages([]);
        }

        return loadedConversations;
      } finally {
        setIsLoadingConversations(false);
      }
    },
    [loadConversationMessages]
  );

  const establishSession = useCallback(
    async (nextSession: AuthResponse, preferredConversationId?: string) => {
      const verifiedUser = await me(nextSession.token);
      const verifiedSession: AuthResponse = {
        ...nextSession,
        uid: verifiedUser.uid || nextSession.uid,
        email: verifiedUser.email || nextSession.email,
        displayName: verifiedUser.displayName || nextSession.displayName,
        photoURL: verifiedUser.photoURL || nextSession.photoURL,
        providers: verifiedUser.providers?.length ? verifiedUser.providers : nextSession.providers
      };

      saveSession(verifiedSession);
      setSession(verifiedSession);
      await loadConversationsForToken(verifiedSession.token, preferredConversationId);
      return verifiedSession;
    },
    [loadConversationsForToken]
  );

  useEffect(() => {
    let isActive = true;

    async function restoreSession() {
      const storedSession = getStoredSession();

      if (!storedSession) {
        clearSession();
        setSession(null);
        setConversations([]);
        setActiveConversationId(null);
        setMessages([]);
        setIsBooting(false);
        return;
      }

      try {
        const freshSession = await refreshStoredSession(storedSession);
        await establishSession(freshSession);
      } catch (error) {
        if (isActive) {
          clearSession();
          setSession(null);
          setConversations([]);
          setActiveConversationId(null);
          setMessages([]);
          setChatError(toFriendlyError(error, "Backend chưa xác thực được phiên đăng nhập."));
        }
      } finally {
        if (isActive) {
          setIsBooting(false);
        }
      }
    }

    void restoreSession();

    return () => {
      isActive = false;
    };
  }, [establishSession]);

  useEffect(() => {
    let isActive = true;
    const redirectResult = getGoogleRedirectResult();

    if (!redirectResult) {
      return () => {
        isActive = false;
      };
    }

    clearAuthRedirectParams();

    if ("error" in redirectResult) {
      setAuthError(`Đăng nhập Google thất bại: ${redirectResult.error.replace(/_/g, " ")}.`);
      setIsAuthModalOpen(true);
      return () => {
        isActive = false;
      };
    }

    setAuthLoadingAction("google");
    void consumeGoogleSession(redirectResult.sessionId)
      .then((googleSession) => establishSession(googleSession))
      .then(() => {
        if (isActive) {
          setIsAuthModalOpen(false);
          setAuthError("");
        }
      })
      .catch((error) => {
        if (isActive) {
          setAuthError(toFriendlyError(error, "Phiên đăng nhập Google đã hết hạn."));
          setIsAuthModalOpen(true);
        }
      })
      .finally(() => {
        if (isActive) {
          setAuthLoadingAction(null);
        }
      });

    return () => {
      isActive = false;
    };
  }, [establishSession]);

  function openAuthModal(tab: AuthTab = "login") {
    setAuthModalMode("auth");
    setAuthDefaultTab(tab);
    setAuthError("");
    setAuthInfo("");
    setIsAuthModalOpen(true);
  }

  function closeAuthModal() {
    setIsAuthModalOpen(false);
    setAuthError("");
    setAuthInfo("");
  }

  function requireLogin() {
    openAuthModal("login");
  }

  async function getFreshSession() {
    if (!session) {
      requireLogin();
      return null;
    }

    try {
      const freshSession = await refreshStoredSession(session);
      saveSession(freshSession);
      setSession(freshSession);
      return freshSession;
    } catch (error) {
      clearSession();
      setSession(null);
      requireLogin();
      setAuthError(getFriendlyAuthError(error));
      return null;
    }
  }

  async function handleLogin(email: string, password: string) {
    setAuthError("");
    setAuthInfo("");
    setAuthLoadingAction("login");

    try {
      const nextSession = await signInWithEmail(email, password);
      await establishSession(nextSession);
      setIsAuthModalOpen(false);
    } catch (error) {
      setAuthError(getFriendlyAuthError(error));
    } finally {
      setAuthLoadingAction(null);
    }
  }

  async function handleSignup(email: string, password: string) {
    setAuthError("");
    setAuthInfo("");
    setAuthLoadingAction("signup");

    try {
      const nextSession = await signUpWithEmail(email, password);
      await establishSession(nextSession);
      setIsAuthModalOpen(false);
    } catch (error) {
      setAuthError(getFriendlyAuthError(error));
    } finally {
      setAuthLoadingAction(null);
    }
  }

  async function handleGoogleLogin() {
    setAuthError("");
    setAuthInfo("");
    setAuthLoadingAction("google");
    window.location.href = createGoogleLoginUrl();
  }

  async function handleSetupPassword(password: string) {
    if (!session) {
      requireLogin();
      return;
    }

    setAuthError("");
    setAuthInfo("");
    setAuthLoadingAction("setup-password");

    try {
      const nextSession = await linkPasswordToCurrentUser(session.token, password);
      await establishSession(nextSession, activeConversationId ?? undefined);
      setAuthInfo("Mật khẩu đã được liên kết với tài khoản hiện tại.");
      setIsAuthModalOpen(false);
    } catch (error) {
      setAuthError(getFriendlyAuthError(error));
    } finally {
      setAuthLoadingAction(null);
    }
  }

  async function handleCreateConversation() {
    const freshSession = await getFreshSession();

    if (!freshSession) {
      return;
    }

    setIsCreatingConversation(true);
    setChatError("");

    try {
      const conversation = await createConversation(freshSession.token);
      setConversations((current) => upsertConversation(current, conversation));
      setActiveConversationId(conversation.id);
      setMessages([]);
    } catch (error) {
      setChatError(toFriendlyError(error, "Không thể tạo cuộc trò chuyện mới."));
    } finally {
      setIsCreatingConversation(false);
    }
  }

  async function handleSelectConversation(conversationId: string) {
    const freshSession = await getFreshSession();

    if (!freshSession) {
      return;
    }

    setActiveConversationId(conversationId);
    await loadConversationMessages(freshSession.token, conversationId).catch(() => undefined);
  }

  async function handleRenameConversation(conversationId: string, title: string) {
    const freshSession = await getFreshSession();

    if (!freshSession) {
      return;
    }

    const previousConversations = conversations;
    setConversations((current) =>
      current.map((conversation) =>
        conversation.id === conversationId ? { ...conversation, title } : conversation
      )
    );

    try {
      const conversation = await renameConversation(freshSession.token, conversationId, title);
      setConversations((current) => upsertConversation(current, conversation));
    } catch (error) {
      setConversations(previousConversations);
      setChatError(toFriendlyError(error, "Không thể đổi tên cuộc trò chuyện."));
    }
  }

  async function handleDeleteConversation(conversationId: string) {
    const freshSession = await getFreshSession();

    if (!freshSession) {
      return;
    }

    setChatError("");

    try {
      await deleteConversation(freshSession.token, conversationId);
      const remainingConversations = conversations.filter(
        (conversation) => conversation.id !== conversationId
      );

      setConversations(remainingConversations);

      if (activeConversationId === conversationId) {
        const nextConversation = remainingConversations[0] ?? null;
        setActiveConversationId(nextConversation?.id ?? null);

        if (nextConversation) {
          await loadConversationMessages(freshSession.token, nextConversation.id);
        } else {
          setMessages([]);
        }
      }
    } catch (error) {
      setChatError(toFriendlyError(error, "Không thể xóa cuộc trò chuyện."));
    }
  }

  async function handleSend(message: string) {
    const freshSession = await getFreshSession();

    if (!freshSession) {
      return;
    }

    setIsSending(true);
    setChatError("");

    try {
      let conversationId = activeConversationId;

      if (!conversationId) {
        const conversation = await createConversation(freshSession.token);
        conversationId = conversation.id;
        setConversations((current) => upsertConversation(current, conversation));
        setActiveConversationId(conversation.id);
        setMessages([]);
      }

      const optimisticMessage: Message = {
        id: createLocalMessageId("user"),
        role: "user",
        content: message,
        created_at: new Date().toISOString()
      };

      setMessages((current) => [...current, optimisticMessage]);

      const response = await sendChat(freshSession.token, conversationId, message);
      setMessages(response.messages);
      setConversations((current) => upsertConversation(current, response.conversation));
      setActiveConversationId(response.conversation.id);
    } catch (error) {
      setChatError(toFriendlyError(error, "Hiện tại chatbot chưa thể trả lời."));
    } finally {
      setIsSending(false);
    }
  }

  async function handleLogout() {
    await logout();
    setSession(null);
    setConversations([]);
    setActiveConversationId(null);
    setMessages([]);
    setAuthError("");
    setAuthInfo("");
    setChatError("");
    setIsAuthModalOpen(false);
  }

  function openPasswordSetup() {
    setAuthModalMode("setup-password");
    setAuthError("");
    setAuthInfo("");
    setIsAuthModalOpen(true);
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-background text-foreground">
      <BackgroundVideo />

      <div className="relative z-10 flex min-h-screen px-4 py-4 sm:px-6 lg:px-8">
        {isBooting ? (
          <section className="flex min-h-[calc(100vh-32px)] w-full items-center justify-center">
            <div className="liquid-glass animate-fade-rise rounded-lg px-6 py-5 text-sm text-white/76">
              <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
              Đang khôi phục phiên đăng nhập
            </div>
          </section>
        ) : (
          <section className="mx-auto grid min-h-[calc(100vh-32px)] w-full max-w-7xl gap-4 lg:grid-cols-[310px_minmax(0,1fr)]">
            <ChatSidebar
              user={session}
              conversations={conversations}
              activeConversationId={activeConversationId}
              isLoading={isLoadingConversations}
              isCreating={isCreatingConversation}
              onNewChat={() => void handleCreateConversation()}
              onSelectConversation={(conversationId) => void handleSelectConversation(conversationId)}
              onRenameConversation={(conversationId, title) =>
                void handleRenameConversation(conversationId, title)
              }
              onDeleteConversation={(conversationId) => void handleDeleteConversation(conversationId)}
              onLogout={() => void handleLogout()}
              onRequireLogin={requireLogin}
              onSetupPassword={openPasswordSetup}
            />

            <ChatPanel
              conversation={activeConversation}
              messages={messages}
              isAuthenticated={Boolean(session)}
              isSending={isSending}
              isLoadingMessages={isLoadingMessages}
              error={chatError}
              onSend={handleSend}
              onRequireLogin={requireLogin}
            />
          </section>
        )}
      </div>

      {isAuthModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 px-4 backdrop-blur-sm">
          <AuthCard
            className="animate-fade-rise"
            error={authError}
            info={authInfo}
            loadingAction={authLoadingAction}
            mode={authModalMode}
            defaultTab={authDefaultTab}
            currentEmail={session?.email ?? ""}
            onLogin={handleLogin}
            onSignup={async (email, password) => handleSignup(email, password)}
            onGoogleLogin={handleGoogleLogin}
            onSetupPassword={async (password) => handleSetupPassword(password)}
            onClose={closeAuthModal}
          />
        </div>
      ) : null}
    </main>
  );
}
