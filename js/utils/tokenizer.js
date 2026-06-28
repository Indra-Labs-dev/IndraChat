/**
 * ============================================================
 * IndraChat — tokenizer.js
 * Utilitaires de Comptage de Tokens
 *
 * Fournit une estimation très rapide du nombre de tokens pour
 * la barre de saisie, sans charger la lourde librairie tiktoken
 * complète au démarrage.
 * Si le projet évolue, on pourrait dynamiquement importer
 * js-tiktoken pour des modèles spécifiques (ex: cl100k_base).
 *
 * Imports : aucun
 * Exports : estimateTokens, getContextLimits
 * ============================================================
 */

/**
 * Estime le nombre de tokens d'un texte.
 * L'heuristique standard (BPE) donne en moyenne :
 * - 1 token ≈ 4 caractères en anglais
 * - 1 token ≈ ¾ de mot
 * - Les caractères CJK/Unicode complexes consomment plus de tokens.
 *
 * Cette implémentation est une approximation rapide (~5% de marge d'erreur)
 * basée sur des patterns regex courants dans les encodeurs BPE.
 *
 * @param {string} text - Le texte à mesurer
 * @returns {number} Nombre estimé de tokens
 */
export function estimateTokens(text) {
  if (!text) return 0;
  
  // 1. Comptage des mots standard et de la ponctuation (≈ BPE splits)
  // Les mots normaux, nombres, et ponctuations isolées
  const regex = /'s|'t|'re|'ve|'m|'ll|'d| ?\p{L}+| ?\p{N}+| ?[^\s\p{L}\p{N}]+|\s+(?!\S)|\s+/gu;
  
  const matches = text.match(regex) || [];
  let tokenCount = 0;

  for (const match of matches) {
    // Si un bloc "mot" est très long, le BPE va le découper en plusieurs sous-mots.
    // En moyenne, 1 token par tranche de 4-5 caractères pour l'anglais/français.
    if (match.length > 5) {
      tokenCount += Math.ceil(match.length / 4);
    } else {
      tokenCount += 1;
    }
  }

  // 2. Majoration pour les textes non-latins (Emojis, CJK, etc.)
  // Le tokenizer OpenAI/Llama encode souvent l'Unicode exotique en 2 ou 3 tokens par caractère.
  const nonLatinRegex = /[^\u0000-\u024F]/g;
  const nonLatinMatches = text.match(nonLatinRegex);
  if (nonLatinMatches) {
    tokenCount += nonLatinMatches.length * 1.5; // Pénalité empirique
  }

  return Math.ceil(tokenCount);
}

/**
 * Retourne les limites de contexte typiques pour un provider/modèle donné.
 * Utilisé pour afficher la jauge de tokens dans l'UI.
 *
 * @param {string} providerId
 * @param {string} modelName
 * @returns {number} Limite max de tokens
 */
export function getContextLimits(providerId, modelName = '') {
  const nameLower = modelName.toLowerCase();

  // Modèles avec fenêtre de contexte géante
  if (nameLower.includes('claude-3') || nameLower.includes('gpt-4-turbo') || nameLower.includes('gpt-4o')) {
    return 128000;
  }
  
  if (nameLower.includes('32k')) return 32768;
  if (nameLower.includes('16k') || nameLower.includes('gpt-3.5-turbo-16k')) return 16384;
  if (nameLower.includes('mixtral') || nameLower.includes('llama-3')) return 8192;
  
  // Par défaut, modèles locaux / anciens standards
  return 4096;
}
