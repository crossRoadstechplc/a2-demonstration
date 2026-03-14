"use client";

import { create } from "zustand";

type ToastType = "success" | "error" | "info";

export interface ToastItem {
  id: string;
  type: ToastType;
  message: string;
  title?: string;
}

interface NotificationState {
  toasts: ToastItem[];
  enqueue: (toast: Omit<ToastItem, "id">) => string;
  dismiss: (id: string) => void;
  clearAll: () => void;
  success: (message: string, title?: string) => string;
  error: (message: string, title?: string) => string;
  info: (message: string, title?: string) => string;
}

export const useNotificationStore = create<NotificationState>((set, get) => ({
  toasts: [],
  enqueue: (toast) => {
    const id = `${Date.now()}_${Math.random().toString(16).slice(2)}`;
    set((state) => ({ toasts: [...state.toasts, { id, ...toast }] }));
    return id;
  },
  dismiss: (id) =>
    set((state) => ({ toasts: state.toasts.filter((toast) => toast.id !== id) })),
  clearAll: () => set({ toasts: [] }),
  success: (message, title) =>
    get().enqueue({ type: "success", message, title: title ?? "Success" }),
  error: (message, title) =>
    get().enqueue({ type: "error", message, title: title ?? "Error" }),
  info: (message, title) =>
    get().enqueue({ type: "info", message, title: title ?? "Info" }),
}));
