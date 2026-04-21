export type User = {
  uid: string;
  email: string;
  displayName?: string;
  photoURL?: string;
  providers?: string[];
};

export type AuthResponse = User & {
  token: string;
  refreshToken?: string | null;
};

export type UserSession = AuthResponse;
export type AuthUser = User;
export type LoginResponse = AuthResponse;

export type ChatRole = "user" | "assistant";

export type Message = {
  id: string;
  role: ChatRole;
  content: string;
  created_at?: string | null;
};

export type ChatMessage = Message;

export type Conversation = {
  id: string;
  title: string;
  created_at?: string | null;
  updated_at?: string | null;
};

export type ChatResponse = {
  reply: string;
  conversation: Conversation;
  messages: Message[];
};
