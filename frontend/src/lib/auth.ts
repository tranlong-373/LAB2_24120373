import {
  linkPasswordToSession,
  refreshAuthSession,
  signInWithEmail as backendSignInWithEmail,
  signUpWithEmail as backendSignUpWithEmail
} from "@/lib/api";
import type { AuthResponse } from "@/lib/types";

const TOKEN_KEY = "lab2_chatbot.auth.token";
const REFRESH_TOKEN_KEY = "lab2_chatbot.auth.refresh_token";
const EMAIL_KEY = "lab2_chatbot.auth.email";
const UID_KEY = "lab2_chatbot.auth.uid";
const DISPLAY_NAME_KEY = "lab2_chatbot.auth.display_name";
const PHOTO_URL_KEY = "lab2_chatbot.auth.photo_url";
const PROVIDERS_KEY = "lab2_chatbot.auth.providers";

export class AuthFlowError extends Error {
  code: string;
  email?: string;

  constructor(
    code: string,
    message: string,
    options: { email?: string } = {}
  ) {
    super(message);
    this.name = "AuthFlowError";
    this.code = code;
    this.email = options.email;
  }
}

function getStorage() {
  return typeof window === "undefined" ? null : window.localStorage;
}

function parseProviders(value: string | null) {
  if (!value) {
    return [];
  }

  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed)
      ? parsed.filter((provider) => typeof provider === "string")
      : [];
  } catch {
    return [];
  }
}

export function getStoredToken() {
  return getStorage()?.getItem(TOKEN_KEY) ?? null;
}

export function getStoredEmail() {
  return getStorage()?.getItem(EMAIL_KEY) ?? null;
}

export function getStoredSession(): AuthResponse | null {
  const storage = getStorage();

  if (!storage) {
    return null;
  }

  const token = storage.getItem(TOKEN_KEY);
  const uid = storage.getItem(UID_KEY);
  const email = storage.getItem(EMAIL_KEY);

  if (!token || !uid || !email) {
    return null;
  }

  return {
    uid,
    email,
    displayName: storage.getItem(DISPLAY_NAME_KEY) ?? "",
    photoURL: storage.getItem(PHOTO_URL_KEY) ?? "",
    providers: parseProviders(storage.getItem(PROVIDERS_KEY)),
    token,
    refreshToken: storage.getItem(REFRESH_TOKEN_KEY)
  };
}

export function saveSession(session: AuthResponse) {
  const storage = getStorage();

  if (!storage) {
    return;
  }

  storage.setItem(TOKEN_KEY, session.token);
  storage.setItem(EMAIL_KEY, session.email);
  storage.setItem(UID_KEY, session.uid);
  storage.setItem(DISPLAY_NAME_KEY, session.displayName ?? "");
  storage.setItem(PHOTO_URL_KEY, session.photoURL ?? "");
  storage.setItem(PROVIDERS_KEY, JSON.stringify(session.providers ?? []));

  if (session.refreshToken) {
    storage.setItem(REFRESH_TOKEN_KEY, session.refreshToken);
  } else {
    storage.removeItem(REFRESH_TOKEN_KEY);
  }
}

export function clearSession() {
  const storage = getStorage();

  if (storage) {
    storage.removeItem(TOKEN_KEY);
    storage.removeItem(REFRESH_TOKEN_KEY);
    storage.removeItem(EMAIL_KEY);
    storage.removeItem(UID_KEY);
    storage.removeItem(DISPLAY_NAME_KEY);
    storage.removeItem(PHOTO_URL_KEY);
    storage.removeItem(PROVIDERS_KEY);
  }
}

export async function signUpWithEmail(email: string, password: string) {
  return backendSignUpWithEmail(email, password);
}

export async function signInWithEmail(email: string, password: string) {
  return backendSignInWithEmail(email, password);
}

export async function linkPasswordToCurrentUser(token: string, password: string) {
  return linkPasswordToSession(token, password);
}

export async function refreshStoredSession(session: AuthResponse) {
  if (!session.refreshToken) {
    return session;
  }

  return refreshAuthSession(session.refreshToken);
}

export async function logout() {
  clearSession();
}

export function getFirebaseErrorCode(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error
    ? String((error as { code?: unknown }).code)
    : "";
}
