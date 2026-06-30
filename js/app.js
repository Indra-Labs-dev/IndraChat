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
 *   1. State (chargement des settings depuis LocalStorage)
 *   2. Thème (appliqué en premier pour éviter le flash)
 *   3. Database (IndexedDB)
 *   4. UI (sidebar, topbar, modal, settings, toast...)
 *   5. Chat (contrôleur)
 *   6. Events (listeners globaux et raccourcis)
 * ============================================================
 */

import { APP_CONFIG, DEFAULT_SETTINGS } from './config.js';
import { initStore, subscribe, getStateValue, dispatch } from './state.js';
import { initTheme } from './ui/theme.js';
import { initModals, openModal, closeModal } from './ui/modal.js';
import { initSettingsUI } from './ui/settings.js';
import { toastError } from './ui/toast.js';
import { initDB } from './storage/database.js';
import { initChat, startNewConversation } from './chat/controller.js';
import { initSidebar } from './ui/sidebar.js';
import { initTopbar, closeModelDropdown } from './ui/topbar.js';
import { initGlobalListeners } from './events/listeners.js';
import { estimateTokens } from './utils/tokenizer.js';

/**
 * Initialisation principale de l'application.
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
    initModals();
    initSettingsUI();
    registerBaseListeners();

    // ── 6. Initialiser l'Interface Latérale et Supérieure ──
    initSidebar();
    initTopbar();

    // ── 7. Initialiser le contrôleur de Chat ──
    initChat();

    // ── 8. Activer les Raccourcis Clavier Globaux ──
    initGlobalListeners();

    console.log('✅ IndraChat est prêt !');

  } catch (error) {
    console.error('❌ Erreur critique lors de l\'initialisation:', error);
    toastError('Erreur Fatale', 'Impossible de démarrer l\'application. Vérifiez la console.');
  }
}

/**
 * Ferme tous les menus déroulants et menus contextuels ouverts.
 * Fonction centralisée appelée par les listeners de clic global et Escape.
 */
function closeAllDropdowns() {
  closeModelDropdown();
  document.getElementById('conversation-context-menu')?.classList.add('hidden');
}

/**
 * Enregistre les listeners de base de l'interface principale.
 */
function registerBaseListeners() {

  // ── Bouton toggle thème ──
  document.getElementById('btn-toggle-theme')?.addEventListener('click', () => {
    const current = getStateValue('settings.theme');
    const next = current === 'dark' ? 'light' : 'dark';
    dispatch('settings.theme', next); // theme.js met à jour l'UI via subscribe
  });

  // ── Bouton nouveau chat (sidebar) ──
  document.getElementById('btn-new-chat')?.addEventListener('click', () => {
    startNewConversation();
  });

  // ── Bouton paramètres (sidebar footer) ──
  document.getElementById('btn-settings')?.addEventListener('click', () => {
    openModal('settings');
  });

  // ── Bouton plein écran ──
  document.getElementById('btn-fullscreen')?.addEventListener('click', toggleFullscreen);

  // ── Chips de suggestions sur l'écran de bienvenue ──
  document.getElementById('welcome-suggestions')?.addEventListener('click', (e) => {
    const chip = e.target.closest('.suggestion-chip');
    if (chip) {
      const prompt = chip.dataset.prompt;
      const input = document.getElementById('message-input');
      if (input && prompt) {
        input.value = prompt;
        input.dispatchEvent(new Event('input')); // déclenche auto-resize et activation du bouton send
        input.focus();
      }
    }
  });

  // ── Titre de conversation : double-clic pour renommer ──
  const titleEl = document.getElementById('conversation-title');
  if (titleEl) {
    titleEl.addEventListener('dblclick', () => {
      titleEl.contentEditable = 'true';
      titleEl.focus();
      // Sélectionner tout le texte
      const range = document.createRange();
      range.selectNodeContents(titleEl);
      window.getSelection().removeAllRanges();
      window.getSelection().addRange(range);
    });

    titleEl.addEventListener('blur', () => {
      titleEl.contentEditable = 'false';
    });

    titleEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        titleEl.blur();
      }
      if (e.key === 'Escape') {
        titleEl.contentEditable = 'false';
      }
    });
  }

  // ── Auto-resize du textarea ──
  const textarea = document.getElementById('message-input');
  const btnSend = document.getElementById('btn-send');

  if (textarea) {
    textarea.addEventListener('input', () => {
      // Auto-resize
      textarea.style.height = 'auto';
      textarea.style.height = Math.min(textarea.scrollHeight, 200) + 'px';

      // Activer/désactiver le bouton envoyer
      const hasContent = textarea.value.trim().length > 0;
      if (btnSend) btnSend.disabled = !hasContent;

      // Compteur de tokens
      const tokenCount = estimateTokens(textarea.value);
      const counter = document.getElementById('token-counter');
      if (counter) counter.textContent = `${tokenCount} token${tokenCount !== 1 ? 's' : ''}`;
    });

    // Envoi avec Entrée (Shift+Entrée = nouvelle ligne)
    textarea.addEventListener('keydown', (e) => {
      const sendOnEnter = getStateValue('settings.sendOnEnter');
      if (e.key === 'Enter' && !e.shiftKey && sendOnEnter !== false) {
        e.preventDefault();
        if (btnSend && !btnSend.disabled) {
          btnSend.click();
        }
      }
    });
  }

  // ── Bouton fermer recherche dans la sidebar ──
  const searchInput = document.getElementById('search-conversations');
  const clearBtn = document.getElementById('btn-clear-search');

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

  // ── Sidebar mobile : bouton hamburger ──
  document.getElementById('btn-toggle-sidebar')?.addEventListener('click', () => {
    toggleMobileSidebar(true);
  });
  document.getElementById('sidebar-overlay')?.addEventListener('click', () => {
    toggleMobileSidebar(false);
  });

  // ── Touche Échap : fermer menus/modales ──
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      // Si une modale est ouverte, la fermer
      if (getStateValue('ui.activeModal')) {
        closeModal();
        return;
      }
      // Sinon fermer les dropdowns
      closeAllDropdowns();
    }
  });

  // ── Clic en dehors : fermer les dropdowns ──
  document.addEventListener('click', (e) => {
    // Fermer le menu contextuel si clic en dehors
    const contextMenu = document.getElementById('conversation-context-menu');
    if (contextMenu && !contextMenu.classList.contains('hidden')) {
      if (!contextMenu.contains(e.target) && !e.target.closest('.nav-item__options-btn')) {
        contextMenu.classList.add('hidden');
      }
    }

    // Fermer le dropdown modèle si clic en dehors du bouton ET du dropdown
    const modelDropdown = document.querySelector('.model-dropdown');
    const btnModelSelector = document.getElementById('btn-model-selector');
    if (modelDropdown && !modelDropdown.classList.contains('hidden')) {
      if (!modelDropdown.contains(e.target) && !btnModelSelector?.contains(e.target)) {
        closeAllDropdowns();
      }
    }
  });
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
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebar-overlay');
  const menuBtn = document.getElementById('btn-toggle-sidebar');

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
