# Elan Design System

## Philosophy

Elan should feel like a place you want to spend time in, not a tool
you use and close. Every element should feel considered, warm, and
alive. Nothing harsh, nothing shouting for attention. The interface
recedes so curiosity can take center stage.

## Canvas & Surface

The graph lives on a paper surface, not a void. Light mode: warm
off-white/cream (#FAF7F2 base) with subtle paper texture - grain,
maybe faint fiber or fold marks, nothing heavy. Dark mode: warm
charcoal/graphite grey (not pure black) with the same paper texture -
think dark kraft paper or slate, not a screen.

This paper canvas extends the full screen - it IS the background,
not a panel. Light mode is primary/default.

## Colors

Semantic colors for node/path classification:
--node-factual: #7B9EFF (soft blue, understanding)
--node-practical: #F4B97A (soft amber, doing)
Reserved: #C4A7E7 (soft purple), #F28B8B (soft coral) - future use

All colors desaturated and soft - work on both light and dark
paper without screaming.

## Panels - Liquid Glass

UI panels (left panel, drawer, modals) are liquid glass slabs
floating ABOVE the paper canvas. With real textured content behind
them, glass should actually refract/blur properly.

background: rgba(255,255,255,0.06) on dark paper,
rgba(0,0,0,0.04) on light paper
backdrop-filter: blur(24px) saturate(180%)
border: 1px solid rgba(255,255,255,0.1)
border-radius: 20px

Edges of panels catch light subtly - faint sheen on hover/active
states. Subtle shadow underneath reinforces these slabs hovering
above the paper.

## Nodes - Open Exploration

Nodes no longer need to be glass orbs - the paper canvas opens up
new directions. Explore freely:

- Colorful stickers or stamps - tactile, collectible feeling
- Soft floating paper cards/shapes in semantic colors
- Ink-style circles or marks - like annotations on the page itself
- Something else entirely that fits "paper + exploration"

Semantic colors still apply for type-coding. Edges can be literal
lines/connections drawn on the paper - pencil/ink line quality
could work well.

## Typography

Font: Inter or DM Sans - clean, warm, highly legible
Body text: slightly off-white on dark (#E8E8F0), dark grey on
light (#1A1A2E)
Never pure white or pure black text
Generous line height - 1.7 for content, 1.4 for UI

## Motion

All transitions: ease-out cubic bezier, never linear
Duration: 200ms micro-interactions, 400ms panel transitions,
600ms graph animations
New nodes bloom in from their parent - scale from 0 with subtle
glow/ink-spread burst
Camera moves feel like floating, smooth ease with slight overshoot

## Voice

Loading states: never spinners - Elan says something. "On it...",
"Give me a sec...", "Pulling this together..."
Empty states open a conversation: "What are you curious about
right now?"
Errors are warm: "Something went wrong on my end, try again?"
Button labels are what Elan would say, not what the action does:
"Let's go" not "Submit", "Take me deeper" not "Expand node"
