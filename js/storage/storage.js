/**
 * ============================================================
 * IndraChat — storage.js
 * Abstraction du LocalStorage & Persistance
 *
 * Gère l'enregistrement des données (paramètres, état, conversations)
 * dans le LocalStorage avec le préfixe de l'application.
 * Inclut la gestion des erreurs (quota dépassé) et la sérialisation JSON.
 *
 * Imports : APP_CONFIG depuis config.js
 * ============================================================
 */

import { APP_CONFIG } from '../config.js';

/**
 * Lit une valeur depuis le LocalStorage.
 *
 * @param {string} key - Clé (sans le préfixe global)
 * @param {any} defaultValue - Valeur retournée si la clé n'existe pas ou s'il y a une erreur
 * @returns {any} Valeur parsée depuis le JSON, ou defaultValue
 */
export function getItem(key, defaultValue = null) {
  try {
    const raw = localStorage.getItem(APP_CONFIG.storagePrefix + key);
    if (raw === null) return defaultValue;
    return JSON.parse(raw);
  } catch (error) {
    console.error(`[Storage] Erreur de lecture pour la clé '${key}':`, error);
    return defaultValue;
  }
}

/**
 * Écrit une valeur dans le LocalStorage.
 * Gère gracieusement les erreurs (ex: navigation privée, QuotaExceeded).
 *
 * @param {string} key - Clé (sans le préfixe global)
 * @param {any} value - Valeur à sérialiser (doit être JSON compatible)
 * @returns {boolean} true si l'écriture a réussi, false sinon
 */
export function setItem(key, value) {
  try {
    const serialized = JSON.stringify(value);
    localStorage.setItem(APP_CONFIG.storagePrefix + key, serialized);
    return true;
  } catch (error) {
    console.error(`[Storage] Erreur d'écriture pour la clé '${key}':`, error);
    
    // Si l'erreur est un QuotaExceededError (code 22), l'espace est plein
    if (error.name === 'QuotaExceededError' || error.code === 22) {
      console.warn(`[Storage] Quota LocalStorage dépassé ! Impossible d'enregistrer.`);
      // TODO: Déclencher un événement global pour afficher un toast à l'utilisateur
    }
    return false;
  }
}

/**
 * Supprime une clé spécifique du LocalStorage.
 *
 * @param {string} key - Clé (sans le préfixe global)
 */
export function removeItem(key) {
  try {
    localStorage.removeItem(APP_CONFIG.storagePrefix + key);
  } catch (error) {
    console.error(`[Storage] Erreur de suppression pour la clé '${key}':`, error);
  }
}

/**
 * Efface TOUTES les données de l'application (basé sur le préfixe).
 * Ne touche pas aux clés des autres applications sur le même domaine.
 */
export function clearAll() {
  try {
    const prefix = APP_CONFIG.storagePrefix;
    // On doit itérer de la fin vers le début quand on supprime dans un tableau
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const key = localStorage.key(i);
      if (key && key.startsWith(prefix)) {
        localStorage.removeItem(key);
      }
    }
    console.log(`[Storage] Toutes les clés avec le préfixe '${prefix}' ont été supprimées.`);
  } catch (error) {
    console.error(`[Storage] Erreur lors du nettoyage global:`, error);
  }
}

/**
 * Vérifie l'espace total estimé utilisé par l'application.
 *
 * @returns {number} Taille en octets
 */
export function getUsedSpace() {
  let totalBytes = 0;
  const prefix = APP_CONFIG.storagePrefix;
  
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(prefix)) {
        // La longueur string JS en UTF-16 = 2 octets par caractère
        totalBytes += (key.length + localStorage.getItem(key).length) * 2;
      }
    }
  } catch (error) {
    console.error('[Storage] Erreur de calcul de taille:', error);
  }
  
  return totalBytes;
}
