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

/**
 * Initialisation minimal pour le rendu initial de l'UI.
 * Les autres modules seront importés au fil des étapes suivantes.
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

  // ── 1. Appliquer le thème sauvegardé (avant tout rendu) ──
  applyInitialTheme();

  // ── 2. Marquer l'app comme chargée ──
  document.getElementById('app')?.classList.add('is-ready');

  // ── 3. Enregistrer les listeners de base ──
  registerBaseListeners();

  console.log('✅ IndraChat initialisé — modules complets à venir (Étape 2+)');
}


/**
 * Applique le thème initial depuis le LocalStorage pour éviter
 * le "flash of wrong theme" (FOWT) au chargement de la page.
 */
function applyInitialTheme() {
  const key = `${APP_CONFIG.storagePrefix}settings`;
  let theme = DEFAULT_SETTINGS.theme;
  let accent = DEFAULT_SETTINGS.accentColor;

  try {
    const raw = localStorage.getItem(key);
    if (raw) {
      const settings = JSON.parse(raw);
      theme  = settings.theme  ?? theme;
      accent = settings.accentColor ?? accent;
    }
  } catch {
    // LocalStorage indisponible ou JSON invalide — on garde les défauts
  }

  // Résolution du thème "system"
  if (theme === 'system') {
    theme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  document.documentElement.setAttribute('data-theme', theme);
  document.documentElement.setAttribute('data-accent', accent);

  // Synchroniser l'icône du bouton de thème
  updateThemeIcon(theme);
}

/**
 * Met à jour les icônes soleil/lune dans la topbar selon le thème actif.
 * @param {string} theme - 'dark' | 'light'
 */
function updateThemeIcon(theme) {
  const sunIcon  = document.getElementById('icon-sun');
  const moonIcon = document.getElementById('icon-moon');
  if (!sunIcon || !moonIcon) return;

  if (theme === 'dark') {
    sunIcon.classList.add('hidden');
    moonIcon.classList.remove('hidden');
  } else {
    sunIcon.classList.remove('hidden');
    moonIcon.classList.add('hidden');
  }
}


/**
 * Enregistre les listeners de base qui doivent fonctionner
 * dès le chargement de la page, avant les modules complets.
 *
 * Les listeners complets seront gérés par js/events/listeners.js.
 */
function registerBaseListeners() {

  // ── Bouton toggle thème ──
  document.getElementById('btn-toggle-theme')?.addEventListener('click', () => {
    const html  = document.documentElement;
    const current = html.getAttribute('data-theme') ?? 'dark';
    const next    = current === 'dark' ? 'light' : 'dark';

    // Transition fluide
    html.classList.add('theme-transition');
    html.setAttribute('data-theme', next);
    updateThemeIcon(next);

    // Sauvegarder dans le LocalStorage
    try {
      const key = `${APP_CONFIG.storagePrefix}settings`;
      const raw = localStorage.getItem(key);
      const settings = raw ? JSON.parse(raw) : { ...DEFAULT_SETTINGS };
      settings.theme = next;
      localStorage.setItem(key, JSON.stringify(settings));
    } catch { /* ignore */ }

    // Supprimer la classe de transition après l'animation
    setTimeout(() => html.classList.remove('theme-transition'), 500);
  });

  // ── Bouton nouveau chat ──
  document.getElementById('btn-new-chat')?.addEventListener('click', () => {
    showWelcomeScreen();
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

      // Compteur de tokens (estimation simple pour l'instant)
      const tokenCount = estimateTokens(textarea.value);
      const counter    = document.getElementById('token-counter');
      if (counter) counter.textContent = `${tokenCount} token${tokenCount !== 1 ? 's' : ''}`;
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

  // ── Touche Échap — fermer les menus ouverts ──
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeAllDropdowns();
    }
  });

  // ── Clic en dehors — fermer les dropdowns ──
  document.addEventListener('click', (e) => {
    const dropdown = document.getElementById('model-dropdown');
    const contextMenu = document.getElementById('conversation-context-menu');
    const modelBtn = document.getElementById('btn-model-selector');

    if (dropdown && !dropdown.classList.contains('hidden')) {
      if (!dropdown.contains(e.target) && e.target !== modelBtn && !modelBtn?.contains(e.target)) {
        closeAllDropdowns();
      }
    }
    if (contextMenu && !contextMenu.classList.contains('hidden')) {
      if (!contextMenu.contains(e.target)) {
        contextMenu.classList.add('hidden');
      }
    }
  });

  // ── Bouton modèle — toggle dropdown ──
  document.getElementById('btn-model-selector')?.addEventListener('click', (e) => {
    e.stopPropagation();
    const dropdown = document.getElementById('model-dropdown');
    const btn      = document.getElementById('btn-model-selector');
    if (!dropdown) return;

    const isOpen = !dropdown.classList.contains('hidden');
    if (isOpen) {
      closeAllDropdowns();
    } else {
      // Positionner le dropdown sous le bouton
      const rect = btn.getBoundingClientRect();
      dropdown.style.top  = `${rect.bottom + 8}px`;
      dropdown.style.left = `${rect.left + rect.width / 2 - 180}px`;
      dropdown.classList.remove('hidden');
      btn.classList.add('is-open');
      document.getElementById('model-search-input')?.focus();
    }
  });

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

/**
 * Estimation naïve du nombre de tokens (≈4 chars/token, compatible BPE).
 * Le module js/utils/tokenizer.js fournira une implémentation plus précise.
 *
 * @param {string} text - Le texte à mesurer
 * @returns {number} Nombre estimé de tokens
 */
function estimateTokens(text) {
  if (!text) return 0;
  return Math.ceil(text.length / 4);
}


// ── Démarrage ──
bootstrap();
