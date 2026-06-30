/**
 * ============================================================
 * IndraChat — api/adapters/openrouter.js
 * Adaptateur OpenRouter
 *
 * OpenRouter expose une API compatible OpenAI. L'adaptateur openai.js
 * gère déjà les headers spéciaux OpenRouter (HTTP-Referer, X-Title).
 * ============================================================
 */

// OpenRouter implémente l'API OpenAI avec des headers supplémentaires
// déjà gérés dans openai.js (vérification config.provider.id === 'openrouter').
export { fetchModels, chatCompletion } from './openai.js';
