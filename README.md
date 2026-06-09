# Elan

An AI-powered learning tree. Enter any topic, get an opinionated breakdown, and explore as deep as you want — every node knows exactly where you've been.

## What it is

Most learning tools give you information. Elan gives you a path. Enter a topic, get a summary and ranked subtopics to explore. Click into any subtopic and go deeper. The tree remembers your entire journey, so every new node is calibrated to what you've already covered.

ChatGPT can explain things. It can't build a persistent map of your understanding. Elan can.

## Stack

- Next.js + TypeScript
- Groq (LLaMA 3.3 70B)
- React Flow
- Tailwind CSS

## Getting Started

```bash
git clone https://github.com/yourusername/elan.git
cd elan
npm install
```

Create a `.env.local` file:

```
GROQ_API_KEY=your_key_here
SYSTEM_PROMPT=your_prompt_here
```

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Status

MVP in progress. Core loop working — topic input, recursive tree generation, graph visualization, ancestor context chaining.

**Coming soon:**

- Supabase persistence
- Chat layer per node
- Annotations and highlights
- Community shared trees
- Mobile responsive

## License

MIT
