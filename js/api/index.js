/**
 * ============================================================
 * IndraChat — api/index.js
 * Client API Centralisé & Orchestrateur
 *
 * Ce module sert de point d'entrée unique pour toutes les requêtes
 * vers les IAs. Il consulte l'état (state.js) pour connaître
 * le provider actif, charge dynamiquement le bon adaptateur,
 * et unifie les flux (SSE Streaming ou requêtes classiques).
 *
 * Imports : config.js, state.js
 * Exports : fetchModels, chatCompletion
 * ============================================================
 */

import { PROVIDERS_MAP } from '../config.js';
import { getStateValue } from '../state.js';

// Cache des adaptateurs chargés dynamiquement
const adaptersCache = new Map();

/**
 * Charge dynamiquement l'adaptateur requis (ex: openai.js, ollama.js).
 * @param {string} adapterName - Nom du module (défini dans config.js)
 * @returns {Promise<Object>} Module adaptateur
 */
async function loadAdapter(adapterName) {
  if (adaptersCache.has(adapterName)) {
    return adaptersCache.get(adapterName);
  }
  
  try {
    const module = await import(`./adapters/${adapterName}.js`);
    adaptersCache.set(adapterName, module);
    return module;
  } catch (error) {
    console.error(`[API] Impossible de charger l'adaptateur: ${adapterName}`, error);
    throw new Error(`Adaptateur non supporté ou introuvable : ${adapterName}`);
  }
}

/**
 * Prépare la configuration requise pour un appel API.
 * Récupère les credentials actuels du state.
 * @returns {Object} Config object
 */
function getApiConfig() {
  const providerId = getStateValue('ai.activeProviderId');
  const provider = PROVIDERS_MAP.get(providerId);

  if (!provider) {
    throw new Error('Provider inconnu ou non configuré.');
  }

  const baseUrl = getStateValue('settings.apiUrl') || provider.defaultUrl;
  const apiKey = getStateValue('settings.apiKey') || '';

  if (provider.requiresKey && !apiKey.trim()) {
    throw new Error(`Une clé API est requise pour utiliser ${provider.name}.`);
  }

  // Nettoyage de l'URL (enlever le slash final)
  const cleanUrl = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;

  return {
    provider,
    baseUrl: cleanUrl,
    apiKey,
    model: getStateValue('settings.model'),
    temperature: getStateValue('settings.temperature'),
    top_p: getStateValue('settings.top_p'),
    top_k: getStateValue('settings.top_k'),
    max_tokens: getStateValue('settings.max_tokens'),
    seed: getStateValue('settings.seed'),
    stream: getStateValue('settings.stream')
  };
}

/**
 * Récupère la liste des modèles disponibles pour le provider actif.
 *
 * @returns {Promise<Array<{id: string, name: string}>>}
 */
export async function fetchModels() {
  try {
    const config = getApiConfig();
    const adapter = await loadAdapter(config.provider.adapterModule);
    
    if (typeof adapter.fetchModels !== 'function') {
      console.warn(`[API] fetchModels non implémenté par l'adaptateur ${config.provider.adapterModule}`);
      return [];
    }

    return await adapter.fetchModels(config);
  } catch (error) {
    console.error('[API] Erreur lors de la récupération des modèles:', error);
    throw error;
  }
}

/**
 * Démarre une complétion de chat. Supporte le streaming.
 *
 * @param {Array<Object>} messages - Historique des messages [{role: 'user', content: '...'}]
 * @param {Object} callbacks - Fonctions de rappel
 * @param {Function} callbacks.onChunk - Appelé à chaque morceau de texte reçu (chunk)
 * @param {Function} callbacks.onDone - Appelé quand la génération est terminée
 * @param {Function} callbacks.onError - Appelé en cas d'erreur réseau ou API
 * @param {AbortSignal} [signal] - Signal pour annuler la requête (bouton stop)
 */
export async function chatCompletion(messages, callbacks, signal) {
  try {
    const config = getApiConfig();
    const systemPrompt = getStateValue('settings.systemPrompt');
    
    // Ajout du system prompt si configuré et non vide
    const finalMessages = [];
    if (systemPrompt && systemPrompt.trim().length > 0) {
      finalMessages.push({ role: 'system', content: systemPrompt });
    }
    finalMessages.push(...messages);

    const adapter = await loadAdapter(config.provider.adapterModule);
    
    if (typeof adapter.chatCompletion !== 'function') {
      throw new Error(`L'adaptateur ${config.provider.adapterModule} ne supporte pas chatCompletion.`);
    }

    // L'adaptateur s'occupe de faire le fetch et de parser le stream
    await adapter.chatCompletion(finalMessages, config, callbacks, signal);

  } catch (error) {
    // Si c'est une annulation volontaire (AbortController), on la remonte proprement
    if (error.name === 'AbortError') {
      console.log('[API] Génération annulée par l\'utilisateur');
      if (callbacks.onDone) callbacks.onDone({ aborted: true });
    } else {
      console.error('[API] Erreur chatCompletion:', error);
      if (callbacks.onError) callbacks.onError(error);
    }
  }
}
