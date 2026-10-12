import { create } from "zustand";

export const useProgressStore = create((set) => ({
  progress: 15, // Seed stage
  sidebarOpen: true,
  currentProfile: null,
  generatedProjects: [],

  increaseProgress: (value) =>
    set((state) => ({
      progress: Math.min(100, state.progress + value),
    })),

  setProgress: (value) =>
    set(() => ({
      progress: value,
    })),

  setProfile: (profile) => set({ currentProfile: profile }),
  setProjects: (projects) => set({ generatedProjects: projects }),

  activeProjects: [],
  setActiveProjects: (projects) => set({ activeProjects: projects }),
  addActiveProject: (project) => set((state) => ({ activeProjects: [...state.activeProjects, project] })),

  toggleSidebar: () =>
    set((state) => ({
      sidebarOpen: !state.sidebarOpen,
    })),
}));
