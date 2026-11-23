import { create } from "zustand";
import { persist } from "zustand/middleware";

/* -----------------------------
   TYPES
----------------------------- */
type UserType = {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  role?: string;
};

type CompanyType = {
  id: string;
  name: string;
};

type AuthState = {
  user: UserType | null;
  company: CompanyType | null;
  token: string | null;

  // actions
  login: (data: {
    user: UserType;
    token: string;
    company?: CompanyType;
  }) => void;

  setUser: (user: UserType | null) => void;
  setToken: (token: string | null) => void;

  logout: () => void;
};

/* -----------------------------
   STORE
----------------------------- */
export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      company: null,
      token: null,

      /* ✅ LOGIN (fixes your error) */
      login: ({ user, token, company }) =>
        set({
          user,
          token,
          company: company || null,
        }),

      /* optional setters */
      setUser: (user) => set({ user }),
      setToken: (token) => set({ token }),

      /* logout */
      logout: () =>
        set({
          user: null,
          token: null,
          company: null,
        }),
    }),
    {
      name: "auth-storage", // localStorage key
    }
  )
);