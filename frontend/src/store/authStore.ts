import { create } from "zustand";

interface UserInfo {
  id: string;
  email: string;
  role: string;
}

interface AuthState {
  accessToken: string | null;
  tenantId: string | null;
  user: UserInfo | null;
  setAuth: (data: Partial<AuthState>) => void;
  clearAuth: () => void;
}

const STORAGE_KEY = "sma-auth";

function hasStorage() {
  return (
    typeof window !== "undefined" &&
    typeof window.localStorage !== "undefined" &&
    typeof window.localStorage.getItem === "function"
  );
}

function loadInitialAuthState(): Pick<AuthState, "accessToken" | "tenantId" | "user"> {
  if (!hasStorage()) {
    return { accessToken: null, tenantId: null, user: null };
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { accessToken: null, tenantId: null, user: null };
    const parsed = JSON.parse(raw) as Partial<AuthState>;
    if (!parsed.accessToken || typeof parsed.accessToken !== "string") {
      return { accessToken: null, tenantId: null, user: null };
    }
    return {
      accessToken: parsed.accessToken,
      tenantId: parsed.tenantId ?? null,
      user: parsed.user ?? null,
    };
  } catch {
    return { accessToken: null, tenantId: null, user: null };
  }
}

function persistAuthState(state: AuthState) {
  if (!hasStorage()) return;
  const { accessToken, tenantId, user } = state;
  if (!accessToken) {
    if (typeof window.localStorage.removeItem === "function") {
      window.localStorage.removeItem(STORAGE_KEY);
    }
    return;
  }
  if (typeof window.localStorage.setItem === "function") {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ accessToken, tenantId, user }),
    );
  }
}

export const useAuthStore = create<AuthState>((set) => ({
  ...loadInitialAuthState(),
  setAuth: (data) =>
    set((state) => {
      const next = { ...state, ...data };
      persistAuthState(next);
      return next;
    }),
  clearAuth: () => {
    if (hasStorage() && typeof window.localStorage.removeItem === "function") {
      window.localStorage.removeItem(STORAGE_KEY);
    }
    set({ accessToken: null, tenantId: null, user: null });
  },
}));

