import { api } from "./api";
import type { User } from "@/types/user";

interface AuthResponse {
  token: string;
  user: User;
}

export const authService = {
  login: async (payload: { email: string; password: string }) => {
    const { data } = await api.post<AuthResponse>("/auth/login", payload);
    return data;
  },
  register: async (payload: {
    name: string;
    email: string;
    password: string;
    role: User["role"];
    organizationId?: string | null;
  }) => {
    const { data } = await api.post<AuthResponse>("/auth/register", payload);
    return data;
  },
  me: async () => {
    const { data } = await api.get<{ user: User }>("/auth/me");
    return data.user;
  },
};
