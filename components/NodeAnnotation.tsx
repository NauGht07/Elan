'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Editor, rootCtx, defaultValueCtx, editorViewCtx } from '@milkdown/core'
import { Milkdown, MilkdownProvider, useEditor } from '@milkdown/react'
import { commonmark } from '@milkdown/preset-commonmark'
import { gfm } from '@milkdown/preset-gfm'
import { listener, listenerCtx } from '@milkdown/plugin-listener'
import { createBrowserClient } from '@/lib/supabase-browser'
import type { Annotation } from '@/types'

interface EditorProps {
  defaultValue: string
  onChange: (text: string) => void
}

function AnnotationEditorInner({ defaultValue, onChange }: EditorProps) {
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange

  const editor = useEditor((root) =>
    Editor.make()
      .config((ctx) => {
        ctx.set(rootCtx, root)
        ctx.set(defaultValueCtx, defaultValue)
        ctx.get(listenerCtx).markdownUpdated((_, markdown, prevMarkdown) => {
          if (prevMarkdown === undefined) return
          onChangeRef.current(markdown)
        })
      })
      .use(commonmark)
      .use(gfm)
      .use(listener)
  )

  function handleClick(e: React.MouseEvent<HTMLDivElement>) {
    const target = e.target as Element
    const li = target.closest('li[data-item-type="task"]')
    if (!li) return
    const rect = li.getBoundingClientRect()
    if (e.clientX - rect.left >= 24) return

    e.preventDefault()

    const editorInst = editor.get()
    if (!editorInst) return
    const view = editorInst.action(ctx => ctx.get(editorViewCtx))

    const coords = view.posAtCoords({ left: rect.left + rect.width / 2, top: e.clientY })
    if (!coords) return

    const resolved = view.state.doc.resolve(coords.pos)
    for (let depth = resolved.depth; depth > 0; depth--) {
      const node = resolved.node(depth)
      if (node.type.name === 'list_item' && node.attrs.checked != null) {
        const pos = resolved.before(depth)
        view.dispatch(view.state.tr.setNodeMarkup(pos, undefined, {
          ...node.attrs,
          checked: !node.attrs.checked,
        }))
        break
      }
    }
  }

  return (
    <div onClick={handleClick}>
      <Milkdown />
    </div>
  )
}

interface Props {
  nodeId: string
}

export default function NodeAnnotation({ nodeId }: Props) {
  const [loading, setLoading] = useState(true)
  const [initialText, setInitialText] = useState('')
  const [saveError, setSaveError] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const annotationIdRef = useRef<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setSaveError(false)
    const supabase = createBrowserClient()

    supabase
      .from('annotations')
      .select('*')
      .eq('node_id', nodeId)
      .eq('anchor_type', 'node')
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled) return
        const annotation = data as Annotation | null
        annotationIdRef.current = annotation?.id ?? null
        const text = annotation?.text ?? ''
        setInitialText(text)
        setLoading(false)
      })

    return () => { cancelled = true }
  }, [nodeId])

  useEffect(() => {
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [])

  const handleChange = useCallback((text: string) => {
    setSaveError(false)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      const supabase = createBrowserClient()
      const currentId = annotationIdRef.current
      try {
        if (currentId) {
          const { error } = await supabase
            .from('annotations')
            .update({ text })
            .eq('id', currentId)
          if (error) throw error
        } else {
          const { data, error } = await supabase
            .from('annotations')
            .insert({ node_id: nodeId, anchor_type: 'node', anchor_start: null, anchor_end: null, text })
            .select('id')
            .single()
          if (error) throw error
          annotationIdRef.current = (data as { id: string }).id
        }
      } catch {
        setSaveError(true)
      }
    }, 1000)
  }, [nodeId])

  if (loading) return null

  return (
    <div>
      <h3 style={{
        margin: '0 0 10px',
        fontSize: 12,
        fontWeight: 600,
        letterSpacing: '0.08em',
        textTransform: 'uppercase',
        color: 'var(--text-muted)',
      }}>
        Notes
      </h3>
      <div className="annotation-editor">
        <MilkdownProvider>
          <AnnotationEditorInner defaultValue={initialText} onChange={handleChange} />
        </MilkdownProvider>
      </div>
      {saveError && (
        <p style={{ margin: '6px 0 0', fontSize: 12, color: 'var(--node-practical)' }}>
          Couldn't save, try again?
        </p>
      )}
    </div>
  )
}
