import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface Toast {
  id: string;
  type: "success" | "error" | "warning" | "info";
  title: string;
  description?: string;
  duration?: number;
}

interface UIState {
  // Sidebar
  sidebarOpen: boolean;
  sidebarCollapsed: boolean;
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
  toggleSidebarCollapse: () => void;

  // Theme
  theme: "light" | "dark" | "system";
  setTheme: (theme: "light" | "dark" | "system") => void;

  // Toasts
  toasts: Toast[];
  addToast: (toast: Omit<Toast, "id">) => void;
  removeToast: (id: string) => void;
  clearToasts: () => void;

  // Modal
  activeModal: string | null;
  modalData: Record<string, unknown> | null;
  openModal: (id: string, data?: Record<string, unknown>) => void;
  closeModal: () => void;
}

export const useUIStore = create<UIState>()(
  persist(
    (set, get) => ({
      // Sidebar
      sidebarOpen: false,
      sidebarCollapsed: false,
      toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
      setSidebarOpen: (open) => set({ sidebarOpen: open }),
      toggleSidebarCollapse: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),

      // Theme
      theme: "system",
      setTheme: (theme) => set({ theme }),

      // Toasts
      toasts: [],
      addToast: (toast) => {
        const id = crypto.randomUUID();
        const duration = toast.duration ?? 5000;
        set((s) => ({ toasts: [...s.toasts, { ...toast, id }] }));
        if (duration > 0) {
          setTimeout(() => get().removeToast(id), duration);
        }
      },
      removeToast: (id) =>
        set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
      clearToasts: () => set({ toasts: [] }),

      // Modal
      activeModal: null,
      modalData: null,
      openModal: (id, data) => set({ activeModal: id, modalData: data ?? null }),
      closeModal: () => set({ activeModal: null, modalData: null }),
    }),
    {
      name: "vaultflow-ui",
      partialize: (state) => ({
        theme: state.theme,
        sidebarCollapsed: state.sidebarCollapsed,
      }),
    }
  )
);
