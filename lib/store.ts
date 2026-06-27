import { create } from 'zustand'
import type { Tree } from '@/types'

interface AppState {
  selectedTreeId: string | null
  activeNodeId: string | null
  isDrawerOpen: boolean
  isDrawerExpanded: boolean
  isLeftCollapsed: boolean
  isModalOpen: boolean
  trees: Tree[]
  setSelectedTreeId: (id: string | null) => void
  setActiveNodeId: (id: string | null) => void
  setDrawerOpen: (open: boolean) => void
  setDrawerExpanded: (expanded: boolean) => void
  setLeftCollapsed: (collapsed: boolean) => void
  setIsModalOpen: (open: boolean) => void
  setTrees: (trees: Tree[]) => void
  prependTree: (tree: Tree) => void
  removeTree: (id: string) => void
  renameTree: (id: string, title: string) => void
  graphVersion: number
  bumpGraphVersion: () => void
}

export const useStore = create<AppState>()((set) => ({
  selectedTreeId: null,
  activeNodeId: null,
  isDrawerOpen: false,
  isDrawerExpanded: false,
  isLeftCollapsed: false,
  isModalOpen: false,
  trees: [],
  setSelectedTreeId: (id) => set({ selectedTreeId: id }),
  setActiveNodeId: (id) => set({ activeNodeId: id }),
  setDrawerOpen: (open) => set({ isDrawerOpen: open }),
  setDrawerExpanded: (expanded) => set({ isDrawerExpanded: expanded }),
  setLeftCollapsed: (collapsed) => set({ isLeftCollapsed: collapsed }),
  setIsModalOpen: (open) => set({ isModalOpen: open }),
  setTrees: (trees) => set({ trees }),
  prependTree: (tree) => set((s) => ({ trees: [tree, ...s.trees] })),
  removeTree: (id) => set((s) => ({
    trees: s.trees.filter((t) => t.id !== id),
    selectedTreeId: s.selectedTreeId === id ? null : s.selectedTreeId,
  })),
  renameTree: (id, title) => set((s) => ({
    trees: s.trees.map((t) => t.id === id ? { ...t, title } : t),
  })),
  graphVersion: 0,
  bumpGraphVersion: () => set((s) => ({ graphVersion: s.graphVersion + 1 })),
}))
