/**
 * ============================================================
 * IndraChat — api/adapters/vllm.js
 * Adaptateur vLLM
 *
 * vLLM expose une API compatible OpenAI (/v1/models et /v1/chat/completions).
 * On réexporte donc simplement l'adaptateur openai.js.
 * ============================================================
 */

// vLLM implémente l'API OpenAI standard.
export { fetchModels, chatCompletion } from './openai.js';
