'use client'

import { useStore } from '@/lib/store'
import LeftPanel from '@/components/LeftPanel'
import NewTreeModal from '@/components/NewTreeModal'
import Graph from '@/components/Graph'
import NodeDrawer from '@/components/NodeDrawer'
import type { Tree, ElanNode } from '@/types'

export default function AppPage() {
  const selectedTreeId = useStore((s) => s.selectedTreeId)
  const isModalOpen = useStore((s) => s.isModalOpen)
  const setIsModalOpen = useStore((s) => s.setIsModalOpen)
  const setSelectedTreeId = useStore((s) => s.setSelectedTreeId)
  const prependTree = useStore((s) => s.prependTree)

  function handleTreeCreated(tree: Tree, _rootNode: ElanNode) {
    prependTree(tree)
    setSelectedTreeId(tree.id)
    setIsModalOpen(false)
  }

  return (
    <div style={{
      position: 'relative',
      display: 'flex',
      height: '100vh',
      overflow: 'hidden',
    }}>
      <LeftPanel />

      <main style={{
        flex: 1,
        overflow: 'hidden',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
      }}>
        {/* Paper texture — always present, static in empty state */}
        <div aria-hidden style={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
          backgroundImage: "url('/paper-texture.png')",
          backgroundRepeat: 'repeat',
          backgroundSize: '400px 400px',
        }} />
        {/* Warm tint overlay — theme-aware */}
        <div aria-hidden style={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
          background: 'var(--canvas-overlay)',
          transition: 'background 0.3s cubic-bezier(0,0,0.2,1)',
        }} />

        {selectedTreeId ? (
          <Graph />
        ) : (
          <p style={{
            margin: 0,
            fontSize: 14,
            color: 'var(--text-muted)',
            letterSpacing: '0.02em',
            userSelect: 'none',
            pointerEvents: 'none',
            position: 'relative',
            zIndex: 1,
          }}>
            Pick a tree to explore
          </p>
        )}
      </main>

      <NodeDrawer />

      <NewTreeModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onComplete={handleTreeCreated}
      />
    </div>
  )
}
