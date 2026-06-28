/**
 * ============================================================
 * IndraChat — state.js
 * Store d'État Réactif (Pattern Observable)
 *
 * Ce module gère l'état global de l'application et permet aux autres
 * modules de s'y abonner. Il assure la synchronisation avec le LocalStorage.
 *
 * Imports : config.js, storage/storage.js, utils/helpers.js
 * Exports : state (l'objet d'état), subscribe, dispatch, initSettings
 * ============================================================
 */

import { DEFAULT_SETTINGS } from './config.js';
import { getItem, setItem } from './storage/storage.js';
import { deepClone } from './utils/helpers.js';

/**
 * L'état global de l'application.
 * Ne JAMAIS modifier cet objet directement de l'extérieur.
 * Utiliser la fonction dispatch().
 */
const state = {
  // Paramètres globaux (fusion de DEFAULT_SETTINGS et de ce qui est en LocalStorage)
  settings: { ...DEFAULT_SETTINGS },

  // Interface utilisateur
  ui: {
    sidebarOpen: window.innerWidth > 768, // Ouvert par défaut sur desktop
    settingsModalOpen: false,
    activeModal: null,
  },

  // IA & Modèles
  ai: {
    activeProviderId: DEFAULT_SETTINGS.provider,
    activeModelId: DEFAULT_SETTINGS.model,
    availableModels: [], // Peuplé par l'API
    isGenerating: false, // True quand un modèle répond
  },

  // Conversations
  chat: {
    activeConversationId: null,
    searchQuery: '',
  }
};

/**
 * Liste des abonnés.
 * Clé = chemin dans l'état (ex: "settings.theme"), Valeur = Set de callbacks
 * @type {Map<string, Set<Function>>}
 */
const subscribers = new Map();

/**
 * S'abonne aux changements d'une partie de l'état.
 *
 * @param {string} path - Chemin à observer (ex: "settings.theme", "ai.isGenerating", ou "*" pour tout)
 * @param {Function} callback - Fonction appelée: (newValue, oldValue) => {}
 * @returns {Function} Fonction de désabonnement (unsub)
 *
 * @example
 * const unsub = subscribe('settings.theme', (newTheme) => {
 *   document.documentElement.setAttribute('data-theme', newTheme);
 * });
 */
export function subscribe(path, callback) {
  if (!subscribers.has(path)) {
    subscribers.set(path, new Set());
  }
  subscribers.get(path).add(callback);

  // Retourne la fonction pour se désabonner
  return () => {
    subscribers.get(path)?.delete(callback);
  };
}

/**
 * Récupère une valeur dans un objet imbriqué via un chemin sous forme de string.
 *
 * @param {Object} obj - Objet source
 * @param {string} path - Chemin (ex: "settings.theme")
 * @returns {any} Valeur trouvée ou undefined
 */
function getValueByPath(obj, path) {
  return path.split('.').reduce((acc, part) => acc && acc[part], obj);
}

/**
 * Définit une valeur dans un objet imbriqué via un chemin sous forme de string.
 * Mutate l'objet.
 *
 * @param {Object} obj - Objet source
 * @param {string} path - Chemin
 * @param {any} value - Nouvelle valeur
 */
function setValueByPath(obj, path, value) {
  const parts = path.split('.');
  const last = parts.pop();
  const target = parts.reduce((acc, part) => {
    if (!acc[part]) acc[part] = {};
    return acc[part];
  }, obj);
  target[last] = value;
}

/**
 * Met à jour l'état de l'application et notifie les abonnés.
 * Si le chemin commence par "settings.", la sauvegarde automatique en LocalStorage est déclenchée.
 *
 * @param {string} path - Chemin à mettre à jour (ex: "settings.theme", "ai.activeModelId")
 * @param {any} value - Nouvelle valeur
 *
 * @example
 * dispatch('ui.sidebarOpen', true);
 * dispatch('settings.theme', 'dark');
 */
export function dispatch(path, value) {
  const oldValue = getValueByPath(state, path);

  // Éviter les notifications si la valeur n'a pas changé (par référence simple)
  if (oldValue === value) return;

  // Mise à jour de l'état
  setValueByPath(state, path, value);

  // Notification des abonnés spécifiques à ce chemin
  if (subscribers.has(path)) {
    subscribers.get(path).forEach(callback => {
      try {
        callback(value, oldValue);
      } catch (e) {
        console.error(`[State] Erreur dans un abonné pour '${path}':`, e);
      }
    });
  }

  // Notification des abonnés globaux ("*")
  if (subscribers.has('*')) {
    subscribers.get('*').forEach(callback => {
      try {
        callback(path, value, oldValue);
      } catch (e) {
        console.error(`[State] Erreur dans un abonné global:`, e);
      }
    });
  }

  // Sauvegarde automatique des paramètres
  if (path.startsWith('settings.')) {
    // On utilise un setTimeout court (debounce très rapide) pour éviter
    // de surcharger le storage si plusieurs dispatches ont lieu dans la même frame
    scheduleSettingsSave();
  }
}

// ── Gestion de la sauvegarde des settings ──

let saveTimeout = null;

/**
 * Planifie une sauvegarde de l'objet settings complet dans le LocalStorage.
 */
function scheduleSettingsSave() {
  if (saveTimeout) clearTimeout(saveTimeout);
  saveTimeout = setTimeout(() => {
    setItem('settings', state.settings);
    saveTimeout = null;
  }, 100);
}

/**
 * Initialise l'état avec les données du LocalStorage.
 * Doit être appelé lors du démarrage (par app.js).
 */
export function initStore() {
  console.log('[State] Initialisation du store...');

  // 1. Charger les paramètres
  const savedSettings = getItem('settings');
  if (savedSettings) {
    // Fusion profonde pour s'assurer que les nouvelles clés de DEFAULT_SETTINGS
    // (en cas de mise à jour de version) sont bien présentes,
    // sans écraser les choix de l'utilisateur.
    state.settings = { ...DEFAULT_SETTINGS, ...savedSettings };

    // Nettoyage rapide pour d'anciennes clés potentiellement supprimées
    // (optionnel mais recommandé dans une SPA qui évolue)
    for (const key in state.settings) {
      if (!(key in DEFAULT_SETTINGS)) {
        delete state.settings[key];
      }
    }
  } else {
    // Premier démarrage
    setItem('settings', state.settings);
  }

  // Les autres chargements lourds (ex: base de données de conversations)
  // seront gérés par les modules dédiés qui mettront à jour l'état.
}

/**
 * Retourne une copie en lecture seule (clonée) de l'état actuel pour consultation.
 * @returns {Object}
 */
export function getState() {
  return deepClone(state);
}

/**
 * Retourne une valeur spécifique de l'état sans s'abonner.
 * @param {string} path 
 * @returns {any}
 */
export function getStateValue(path) {
  return deepClone(getValueByPath(state, path));
}
