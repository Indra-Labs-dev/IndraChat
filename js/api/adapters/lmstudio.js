/**
 * ============================================================
 * IndraChat — api/adapters/lmstudio.js
 * Adaptateur LM Studio
 *
 * LM Studio expose une API compatible OpenAI, on réutilise donc
 * l'adaptateur openai.js tel quel.
 * ============================================================
 */

// LM Studio implémente exactement l'API OpenAI (/v1/models et /v1/chat/completions)
// On réexporte simplement les fonctions de l'adaptateur OpenAI.
export { fetchModels, chatCompletion } from './openai.js';
