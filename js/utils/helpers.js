/**
 * ============================================================
 * IndraChat — helpers.js
 * Utilitaires Génériques (Fonctions Pures)
 *
 * Imports : aucun
 * Exports : debounce, throttle, escapeHtml, formatDate, formatBytes, deepClone
 * ============================================================
 */

/**
 * Exécute une fonction seulement après un délai sans nouvel appel.
 * Idéal pour l'auto-save ou la recherche instantanée (pour ne pas spammer l'API).
 *
 * @param {Function} func - Fonction à debouncer
 * @param {number} wait - Délai en millisecondes
 * @returns {Function} Fonction debouncée
 */
export function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

/**
 * Assure qu'une fonction n'est appelée qu'une fois par intervalle de temps.
 * Idéal pour les événements de scroll ou resize.
 *
 * @param {Function} func - Fonction à throttler
 * @param {number} limit - Intervalle minimum en millisecondes
 * @returns {Function} Fonction throttlée
 */
export function throttle(func, limit) {
  let inThrottle;
  return function(...args) {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
}

/**
 * Échappe les caractères HTML dangereux pour prévenir les failles XSS.
 * Note : DOMPurify gère le Markdown, mais ceci est utile pour les titres de conversation.
 *
 * @param {string} unsafe - Chaine potentiellement non sûre
 * @returns {string} Chaine sécurisée
 */
export function escapeHtml(unsafe) {
  if (typeof unsafe !== 'string') return '';
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/**
 * Formate un timestamp ISO en date/heure lisible localisée.
 * Affiche l'heure si c'est aujourd'hui, sinon la date courte.
 *
 * @param {string|number} isoString - Date ISO ou timestamp MS
 * @returns {string} Format: "14:32" (ajd) ou "12 Oct" (passé)
 */
export function formatDate(isoString) {
  const date = new Date(isoString);
  if (isNaN(date.getTime())) return '';

  const now = new Date();
  const isToday = date.getDate() === now.getDate() &&
                  date.getMonth() === now.getMonth() &&
                  date.getFullYear() === now.getFullYear();

  if (isToday) {
    return date.toLocaleTimeString(navigator.language, {
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  return date.toLocaleDateString(navigator.language, {
    day: 'numeric',
    month: 'short'
  });
}

/**
 * Convertit des octets en un format humain lisible (KB, MB, GB).
 *
 * @param {number} bytes - Taille en octets
 * @param {number} decimals - Nombre de décimales (défaut 1)
 * @returns {string} Taille formatée ex: "4.2 MB"
 */
export function formatBytes(bytes, decimals = 1) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];

  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

/**
 * Effectue un clonage profond natif d'un objet.
 * Utilise structredClone() s'il est disponible (plus rapide et supporte Maps/Sets/Dates),
 * sinon se rabat sur JSON parse/stringify (uniquement structures simples).
 *
 * @param {any} obj - Objet à cloner
 * @returns {any} Objet cloné
 */
export function deepClone(obj) {
  if (typeof structuredClone === 'function') {
    return structuredClone(obj);
  }
  return JSON.parse(JSON.stringify(obj));
}
