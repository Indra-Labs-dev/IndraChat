/**
 * ============================================================
 * IndraChat — app.js
 * Point d'Entrée Principal — Bootstrap de l'Application
 *
 * Ce module est le seul chargé par index.html via <script type="module">.
 * Il initialise tous les sous-modules dans le bon ordre et orchestre
 * le démarrage de l'application.
 *
 * Ordre d'initialisation :
 *   1. Thème (appliqué en premier pour éviter le flash)
 *   2. Storage (chargement des settings)
 *   3. State (initialisation avec les settings sauvegardés)
 *   4. UI (sidebar, renderer, modal, toast...)
 *   5. API (détection providers, chargement modèles)
 *   6. Events (listeners globaux)
 *   7. Conversations (chargement depuis le storage)
 *
 * Imports :
 *   - config.js, state.js, et tous les modules ui/chat/api/events
 * ============================================================
 */

import { APP_CONFIG, DEFAULT_SETTINGS } from './config.js';
import { initStore, subscribe } from './state.js';
import { initTheme } from './ui/theme.js';
import { initModals } from './ui/modal.js';
import { initSettingsUI } from './ui/settings.js';
import { toastSuccess, toastError } from './ui/toast.js';
import { initDB } from './storage/database.js';
import { initChat } from './chat/controller.js';
import { initSidebar } from './ui/sidebar.js';
import { initTopbar } from './ui/topbar.js';
import { initGlobalListeners } from './events/listeners.js';
import { startNewConversation } from './chat/controller.js';
import { estimateTokens } from './utils/tokenizer.js';
import { openModal } from './ui/modal.js';
import { getStateValue, dispatch } from './state.js';

/**
 * Initialisation principale de l'application.
 *
 * @async
 */
async function bootstrap() {
  console.log(`%c🚀 ${APP_CONFIG.name} v${APP_CONFIG.version}`, [
    'color: #3b82f6',
    'font-weight: bold',
    'font-size: 14px',
    'padding: 4px 8px',
    'border-radius: 4px',
    'background: rgba(59,130,246,0.1)',
  ].join(';'));

  try {
    // ── 1. Initialiser le State (charge depuis le LocalStorage) ──
    initStore();

    // ── 2. Initialiser le gestionnaire de Thème (s'abonne au State) ──
    initTheme();

    // ── 3. Initialiser la Base de Données (IndexedDB) ──
    await initDB();

    // ── 4. Marquer l'app comme prête visuellement ──
    document.getElementById('app')?.classList.add('is-ready');

    // ── 5. Enregistrer les listeners UI et Modales ──
    registerBaseListeners();
    initModals();
    initSettingsUI();

    // ── 6. Initialiser l'Interface Latérale et Supérieure ──
    initSidebar();
    initTopbar();

    // ── 7. Initialiser le contrôleur de Chat ──
    initChat();

    // ── 8. Activer les Raccourcis Clavier Globaux ──
    initGlobalListeners();

    console.log('✅ IndraChat est prêt ! (Toutes les étapes validées)');
    
    // Afficher un toast de bienvenue uniquement en dev (optionnel)
    // toastSuccess('Prêt', `IndraChat v${APP_CONFIG.version} chargé avec succès.`);

  } catch (error) {
    console.error('❌ Erreur critique lors de l\'initialisation:', error);
    toastError('Erreur Fatale', 'Impossible de démarrer l\'application.');
  }
}

/**
 * Enregistre les listeners de base de l'interface principale.
 * Les raccourcis clavier globaux seront gérés ultérieurement.
 */
function registerBaseListeners() {

  // ── Bouton toggle thème ──
  document.getElementById('btn-toggle-theme')?.addEventListener('click', () => {
    const current = getStateValue('settings.theme');
    const next = current === 'dark' ? 'light' : 'dark';
    dispatch('settings.theme', next); // theme.js gère l'UI (icône, attribut) via subscribe
  });

  // ── Bouton nouveau chat ──
  document.getElementById('btn-new-chat')?.addEventListener('click', () => {
    startNewConversation();
  });

  // ── Bouton paramètres ──
  document.getElementById('btn-settings')?.addEventListener('click', () => {
    openModal('settings');
  });

  // ── Chips de suggestions ──
  document.getElementById('welcome-suggestions')?.addEventListener('click', (e) => {
    const chip = e.target.closest('.suggestion-chip');
    if (chip) {
      const prompt = chip.dataset.prompt;
      const input  = document.getElementById('message-input');
      if (input && prompt) {
        input.value = prompt;
        input.dispatchEvent(new Event('input')); // Pour l'auto-resize et le bouton envoyer
        input.focus();
      }
    }
  });

  // ── Auto-resize du textarea ──
  const textarea = document.getElementById('message-input');
  const btnSend  = document.getElementById('btn-send');

  if (textarea) {
    textarea.addEventListener('input', () => {
      // Auto-resize
      textarea.style.height = 'auto';
      textarea.style.height = Math.min(textarea.scrollHeight, 200) + 'px';

      // Activer/désactiver le bouton envoyer
      const hasContent = textarea.value.trim().length > 0;
      if (btnSend) btnSend.disabled = !hasContent;

      // Compteur de tokens
      if (typeof estimateTokens === 'function') {
        const tokenCount = estimateTokens(textarea.value);
        const counter    = document.getElementById('token-counter');
        if (counter) counter.textContent = `${tokenCount} token${tokenCount !== 1 ? 's' : ''}`;
      }
    });

    // Envoi avec Entrée (Shift+Entrée = nouvelle ligne)
    textarea.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        if (!btnSend?.disabled) {
          btnSend?.click();
        }
      }
    });
  }

  // ── Bouton fermer recherche ──
  const searchInput = document.getElementById('search-conversations');
  const clearBtn    = document.getElementById('btn-clear-search');

  if (searchInput && clearBtn) {
    searchInput.addEventListener('input', () => {
      clearBtn.classList.toggle('hidden', searchInput.value.length === 0);
    });
    clearBtn.addEventListener('click', () => {
      searchInput.value = '';
      searchInput.dispatchEvent(new Event('input'));
      searchInput.focus();
    });
  }

  // ── Fonction utilitaire : Fermer menus ──
  function closeAllDropdowns() {
    document.querySelector('.model-dropdown')?.classList.add('hidden');
    document.getElementById('btn-model-selector')?.classList.remove('is-open');
    document.getElementById('conversation-context-menu')?.classList.add('hidden');
  }

  // ── Touche Échap — fermer les menus ouverts ──
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeAllDropdowns();
    }
  });

  // ── Clic en dehors — fermer les dropdowns ──
  document.addEventListener('click', (e) => {
    const dropdown = document.querySelector('.model-dropdown');
    const contextMenu = document.getElementById('conversation-context-menu');
    const modelBtn = document.getElementById('btn-model-selector');

    let clickedInDropdown = dropdown && !dropdown.classList.contains('hidden') && (dropdown.contains(e.target) || modelBtn?.contains(e.target));
    let clickedInContextMenu = contextMenu && !contextMenu.classList.contains('hidden') && contextMenu.contains(e.target);

    const isOptionBtn = e.target.closest('.nav-item__options-btn');

    if (!clickedInDropdown && !clickedInContextMenu && !isOptionBtn) {
      closeAllDropdowns();
    }
  });

  // ── Bouton modèle — toggle dropdown ──
  // Géré dans js/ui/topbar.js désormais, mais on peut le garder ici si besoin. 
  // On le retire d'ici pour éviter les conflits car il est dans topbar.js.


  // ── Bouton plein écran ──
  document.getElementById('btn-fullscreen')?.addEventListener('click', toggleFullscreen);

  // ── Sidebar mobile ──
  document.getElementById('btn-toggle-sidebar')?.addEventListener('click', () => {
    toggleMobileSidebar(true);
  });
  document.getElementById('sidebar-overlay')?.addEventListener('click', () => {
    toggleMobileSidebar(false);
  });
}


/**
 * Ferme tous les menus déroulants ouverts.
 */
function closeAllDropdowns() {
  document.getElementById('model-dropdown')?.classList.add('hidden');
  document.getElementById('btn-model-selector')?.classList.remove('is-open');
  document.getElementById('conversation-context-menu')?.classList.add('hidden');
}

/**
 * Affiche l'écran de bienvenue et cache la liste de messages.
 */
function showWelcomeScreen() {
  document.getElementById('welcome-screen')?.classList.remove('hidden');
  document.getElementById('messages-list')?.replaceChildren();
  document.getElementById('conversation-title').textContent = 'Nouvelle conversation';
  document.getElementById('generation-stats')?.classList.add('hidden');
  document.getElementById('message-input').value = '';
  document.getElementById('message-input').style.height = 'auto';
  document.getElementById('btn-send').disabled = true;
  const counter = document.getElementById('token-counter');
  if (counter) counter.textContent = '0 token';
}

/**
 * Bascule le mode plein écran natif.
 */
function toggleFullscreen() {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen().catch(() => {});
  } else {
    document.exitFullscreen().catch(() => {});
  }
}

/**
 * Ouvre ou ferme la sidebar sur mobile.
 * @param {boolean} open - true pour ouvrir, false pour fermer
 */
function toggleMobileSidebar(open) {
  const sidebar  = document.getElementById('sidebar');
  const overlay  = document.getElementById('sidebar-overlay');
  const menuBtn  = document.getElementById('btn-toggle-sidebar');

  if (open) {
    sidebar?.classList.add('is-open');
    overlay?.classList.remove('hidden');
    menuBtn?.setAttribute('aria-expanded', 'true');
  } else {
    sidebar?.classList.remove('is-open');
    overlay?.classList.add('hidden');
    menuBtn?.setAttribute('aria-expanded', 'false');
  }
}




// ── Démarrage ──
bootstrap();
