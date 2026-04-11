import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { CollectionsQueuePreset } from "@/lib/collections/queue";
import {
  DEFAULT_CLIENT_OPS_VIEW,
  type ClientOpsViewId,
  type ClientHealthFilter,
  type ClientTouchFilter,
} from "@/lib/operations/client-views";

export interface Toast {
  id: string;
  type: "success" | "error" | "warning" | "info";
  title: string;
  description?: string;
  duration?: number;
}

export interface SavedClientWorkspaceView {
  id: string;
  orgId: string;
  label: string;
  health: ClientHealthFilter;
  queuePreset: CollectionsQueuePreset;
  touchFilter: ClientTouchFilter;
  createdAt: string;
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

  // Operations workspace
  collectionsPreset: CollectionsQueuePreset;
  setCollectionsPreset: (preset: CollectionsQueuePreset) => void;
  clientOpsView: ClientOpsViewId;
  setClientOpsView: (view: ClientOpsViewId) => void;
  savedClientWorkspaceViews: SavedClientWorkspaceView[];
  saveClientWorkspaceView: (
    view: Omit<SavedClientWorkspaceView, "id" | "createdAt">
  ) => SavedClientWorkspaceView;
  updateClientWorkspaceViewLabel: (id: string, label: string) => void;
  removeClientWorkspaceView: (id: string) => void;

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

      // Operations workspace
      collectionsPreset: "needs-touch",
      setCollectionsPreset: (preset) => set({ collectionsPreset: preset }),
      clientOpsView: DEFAULT_CLIENT_OPS_VIEW,
      setClientOpsView: (view) => set({ clientOpsView: view }),
      savedClientWorkspaceViews: [],
      saveClientWorkspaceView: (view) => {
        const nextView: SavedClientWorkspaceView = {
          ...view,
          id: crypto.randomUUID(),
          createdAt: new Date().toISOString(),
        };
        set((state) => {
          const existing = state.savedClientWorkspaceViews.filter(
            (entry) => entry.orgId === view.orgId
          );
          const retained = state.savedClientWorkspaceViews.filter(
            (entry) => entry.orgId !== view.orgId
          );

          return {
            savedClientWorkspaceViews: [
              ...retained,
              ...existing.slice(-5),
              nextView,
            ],
          };
        });
        return nextView;
      },
      updateClientWorkspaceViewLabel: (id, label) =>
        set((state) => ({
          savedClientWorkspaceViews: state.savedClientWorkspaceViews.map((view) =>
            view.id === id ? { ...view, label } : view
          ),
        })),
      removeClientWorkspaceView: (id) =>
        set((state) => ({
          savedClientWorkspaceViews: state.savedClientWorkspaceViews.filter(
            (view) => view.id !== id
          ),
        })),

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
        collectionsPreset: state.collectionsPreset,
        clientOpsView: state.clientOpsView,
        savedClientWorkspaceViews: state.savedClientWorkspaceViews,
      }),
    }
  )
);
