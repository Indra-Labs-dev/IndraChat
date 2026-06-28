/**
 * ============================================================
 * IndraChat — config.js
 * Configuration Globale & Constantes de l'Application
 *
 * Ce module exporte des constantes immuables utilisées dans tout
 * le projet. Aucune logique métier ici — seulement des données.
 *
 * Imports : aucun
 * Exports : APP_CONFIG, PROVIDERS, DEFAULT_SETTINGS
 * ============================================================
 */


/**
 * Métadonnées de l'application.
 * @constant {Object}
 */
export const APP_CONFIG = Object.freeze({
  name:    'IndraChat',
  version: '0.1.0',
  author:  'Indra Labs',
  /** Préfixe utilisé pour toutes les clés LocalStorage */
  storagePrefix: 'indrachat_',
  /** Nombre maximum de messages gardés en mémoire par conversation */
  maxMessagesInMemory: 1000,
  /** Délai de debounce pour la recherche dans la sidebar (ms) */
  searchDebounceMs: 200,
});


/**
 * Définition de tous les providers d'IA supportés.
 * Chaque provider peut avoir plusieurs endpoints / modes d'authentification.
 *
 * @typedef  {Object} Provider
 * @property {string}   id          - Identifiant unique (utilisé dans le state)
 * @property {string}   name        - Nom affiché dans l'UI
 * @property {string}   defaultUrl  - URL de base par défaut
 * @property {string}   modelsPath  - Chemin pour lister les modèles
 * @property {string}   chatPath    - Chemin pour le chat/completion
 * @property {boolean}  requiresKey - Si une clé API est nécessaire
 * @property {boolean}  supportsStreaming - Si le streaming SSE est supporté
 * @property {string}   adapterModule    - Nom du module adapter (dans js/api/)
 */
export const PROVIDERS = Object.freeze([
  {
    id:                'ollama',
    name:              'Ollama',
    defaultUrl:        'http://localhost:11434',
    modelsPath:        '/api/tags',
    chatPath:          '/api/chat',
    requiresKey:       false,
    supportsStreaming:  true,
    adapterModule:     'ollama',
    icon:              '🦙',
  },
  {
    id:                'lmstudio',
    name:              'LM Studio',
    defaultUrl:        'http://localhost:1234',
    modelsPath:        '/v1/models',
    chatPath:          '/v1/chat/completions',
    requiresKey:       false,
    supportsStreaming:  true,
    adapterModule:     'lmstudio',
    icon:              '🖥️',
  },
  {
    id:                'openai',
    name:              'OpenAI',
    defaultUrl:        'https://api.openai.com',
    modelsPath:        '/v1/models',
    chatPath:          '/v1/chat/completions',
    requiresKey:       true,
    supportsStreaming:  true,
    adapterModule:     'openai',
    icon:              '🤖',
  },
  {
    id:                'openrouter',
    name:              'OpenRouter',
    defaultUrl:        'https://openrouter.ai/api',
    modelsPath:        '/v1/models',
    chatPath:          '/v1/chat/completions',
    requiresKey:       true,
    supportsStreaming:  true,
    adapterModule:     'openrouter',
    icon:              '🔀',
  },
  {
    id:                'vllm',
    name:              'vLLM',
    defaultUrl:        'http://localhost:8000',
    modelsPath:        '/v1/models',
    chatPath:          '/v1/chat/completions',
    requiresKey:       false,
    supportsStreaming:  true,
    adapterModule:     'vllm',
    icon:              '⚡',
  },
  {
    id:                'openai-compatible',
    name:              'OpenAI Compatible',
    defaultUrl:        'http://localhost:8080',
    modelsPath:        '/v1/models',
    chatPath:          '/v1/chat/completions',
    requiresKey:       false,
    supportsStreaming:  true,
    adapterModule:     'openai',
    icon:              '🔌',
  },
]);

/**
 * Map des providers par ID pour accès O(1).
 * @constant {Map<string, Provider>}
 */
export const PROVIDERS_MAP = new Map(PROVIDERS.map(p => [p.id, p]));


/**
 * Paramètres par défaut de l'application.
 * Ces valeurs sont utilisées lors de la première installation
 * et comme valeurs de repli si une clé est absente du LocalStorage.
 *
 * @constant {Object}
 */
export const DEFAULT_SETTINGS = Object.freeze({

  /* ── API & Provider ── */
  provider:     'ollama',
  apiUrl:       'http://localhost:11434',
  apiKey:       '',
  model:        '',

  /* ── Paramètres du modèle ── */
  temperature:  0.7,
  top_p:        0.9,
  top_k:        40,
  max_tokens:   4096,
  seed:         -1,         // -1 = aléatoire
  stream:       true,

  /* ── Interface ── */
  theme:        'dark',     // 'dark' | 'light' | 'system'
  accentColor:  'blue',     // 'blue' | 'violet' | 'green' | 'orange'
  fontSize:     'base',     // 'sm' | 'base' | 'lg'
  fontFamily:   'inter',    // 'inter' | 'system' | 'mono'
  messageWidth: 'normal',   // 'narrow' | 'normal' | 'wide'
  density:      'normal',   // 'compact' | 'normal' | 'comfortable'
  animations:   true,
  sendOnEnter:  true,

  /* ── Comportement du chat ── */
  systemPrompt:      '',
  showModelInfo:     true,
  showTimestamps:    false,
  autoTitle:         true,   // Nommer automatiquement la conversation via le premier message
  autoScroll:        true,
  codeHighlighting:  true,
  renderMarkdown:    true,
  renderLatex:       true,
  renderMermaid:     true,

  /* ── Speech ── */
  speechLanguage: 'fr-FR',
  speechVoice:    '',        // Nom de la voix (vide = voix par défaut)
  speechRate:     1.0,
  speechPitch:    1.0,

  /* ── Notifications ── */
  browserNotifications: false,
  notifyOnComplete:     true,
});


/**
 * Raccourcis clavier de l'application.
 * Utilisés par js/events/listeners.js pour enregistrer les handlers.
 *
 * @constant {Array<{key: string, ctrl?: boolean, shift?: boolean, action: string, description: string}>}
 */
export const KEYBOARD_SHORTCUTS = Object.freeze([
  { key: 'n',      ctrl: true,  action: 'new-chat',       description: 'Nouvelle conversation' },
  { key: ',',      ctrl: true,  action: 'open-settings',  description: 'Ouvrir les paramètres' },
  { key: 'k',      ctrl: true,  action: 'search',         description: 'Rechercher' },
  { key: 'Escape',              action: 'close-modal',    description: 'Fermer la fenêtre / interrompre' },
  { key: 'F11',                 action: 'fullscreen',     description: 'Plein écran' },
  { key: 'Enter',  ctrl: true,  action: 'send-message',   description: 'Envoyer (alt)' },
]);


/**
 * Types MIME acceptés pour les pièces jointes.
 * @constant {string[]}
 */
export const ACCEPTED_MIME_TYPES = Object.freeze([
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'application/pdf',
  'text/plain',
  'text/markdown',
  'application/json',
]);

/**
 * Taille maximale des pièces jointes (10 Mo).
 * @constant {number}
 */
export const MAX_ATTACHMENT_SIZE = 10 * 1024 * 1024;
