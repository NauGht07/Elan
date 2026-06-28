import Groq from 'groq-sdk';

export const LARGE_MODEL = 'qwen/qwen3-32b';
export const SMALL_MODEL = 'llama-3.1-8b-instant';

export const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
