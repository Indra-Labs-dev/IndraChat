/**
 * ============================================================
 * IndraChat — ids.js
 * Génération d'Identifiants Uniques
 *
 * Fournit des UUID v4 cryptographiquement sûrs via l'API
 * `crypto.randomUUID()` avec un fallback manuel pour les
 * environnements qui ne la supportent pas (HTTP local, vieux Safari).
 *
 * Imports : aucun
 * Exports : generateId, generateShortId
 * ============================================================
 */


/**
 * Génère un UUID v4 cryptographiquement sûr.
 *
 * Utilise `crypto.randomUUID()` si disponible (navigateurs modernes),
 * sinon génère manuellement un UUID v4 conforme à la RFC 4122.
 *
 * @returns {string} UUID v4 au format xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
 *
 * @example
 * const id = generateId();
 * // → "f47ac10b-58cc-4372-a567-0e02b2c3d479"
 */
export function generateId() {
  // Méthode native — disponible dans Chrome 92+, Firefox 95+, Safari 15.4+
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  // Fallback RFC 4122 v4 via getRandomValues()
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    return ([1e7] + -1e3 + -4e3 + -8e3 + -1e11).replace(/[018]/g, (c) =>
      (c ^ (crypto.getRandomValues(new Uint8Array(1))[0] & (15 >> (c / 4)))).toString(16)
    );
  }

  // Dernier recours — Math.random (non cryptographique, éviter en prod)
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}


/**
 * Génère un identifiant court (8 caractères hexadécimaux).
 * Utile pour les IDs d'éléments DOM, les noms de conversations par défaut, etc.
 * Non garanti unique sur de très grands volumes — préférer generateId() pour
 * les clés de base de données.
 *
 * @returns {string} 8 caractères hexadécimaux, ex: "a1b2c3d4"
 *
 * @example
 * const shortId = generateShortId();
 * // → "f4a8b2c1"
 */
export function generateShortId() {
  const arr = new Uint8Array(4);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(arr);
  } else {
    // Fallback non-cryptographique
    arr.forEach((_, i) => { arr[i] = Math.floor(Math.random() * 256); });
  }
  return Array.from(arr, (b) => b.toString(16).padStart(2, '0')).join('');
}


/**
 * Génère un ID de conversation avec un préfixe lisible.
 * Format : "conv_<shortId>", ex: "conv_f4a8b2c1"
 *
 * @returns {string}
 */
export function generateConversationId() {
  return `conv_${generateShortId()}`;
}


/**
 * Génère un ID de message avec un préfixe lisible.
 * Format : "msg_<shortId>", ex: "msg_f4a8b2c1"
 *
 * @returns {string}
 */
export function generateMessageId() {
  return `msg_${generateShortId()}`;
}
