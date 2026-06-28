import { $inputRule } from '@milkdown/utils'
import { InputRule } from '@milkdown/prose/inputrules'
import { linkSchema } from '@milkdown/preset-commonmark'

// Commonmark ships no input rule for links, so typing `[text](url)` is left as
// plain text — which then serializes with escaped brackets and reloads as a
// broken split (literal `[text](` + a GFM-autolinked bare URL). This rule turns
// typed `[text](url)` into a real link mark, so it round-trips cleanly.
export const linkInputRule = $inputRule((ctx) =>
  new InputRule(
    /\[([^\]]+)\]\(([^\s()]+)\)$/,
    (state, match, start, end) => {
      const [, label, href] = match
      if (!label || !href) return null
      const markType = linkSchema.type(ctx)
      const node = state.schema.text(label, [markType.create({ href, title: null })])
      return state.tr.replaceWith(start, end, node).removeStoredMark(markType)
    },
  ),
)
