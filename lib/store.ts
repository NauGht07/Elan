import { create } from 'zustand'

interface AppState {
  selectedTreeId: string | null
  activeNodeId: string | null
  isDrawerOpen: boolean
  isDrawerExpanded: boolean
  isLeftCollapsed: boolean
  setSelectedTreeId: (id: string | null) => void
  setActiveNodeId: (id: string | null) => void
  setDrawerOpen: (open: boolean) => void
  setDrawerExpanded: (expanded: boolean) => void
  setLeftCollapsed: (collapsed: boolean) => void
}

export const useStore = create<AppState>()((set) => ({
  selectedTreeId: null,
  activeNodeId: null,
  isDrawerOpen: false,
  isDrawerExpanded: false,
  isLeftCollapsed: false,
  setSelectedTreeId: (id) => set({ selectedTreeId: id }),
  setActiveNodeId: (id) => set({ activeNodeId: id }),
  setDrawerOpen: (open) => set({ isDrawerOpen: open }),
  setDrawerExpanded: (expanded) => set({ isDrawerExpanded: expanded }),
  setLeftCollapsed: (collapsed) => set({ isLeftCollapsed: collapsed }),
}))
