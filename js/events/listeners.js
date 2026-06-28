/**
 * ============================================================
 * IndraChat — listeners.js
 * Gestionnaire d'Événements Globaux (Raccourcis Clavier)
 *
 * Imports : config.js (KEYBOARD_SHORTCUTS), actions
 * ============================================================
 */

import { KEYBOARD_SHORTCUTS } from '../config.js';
import { openModal, closeModal } from '../ui/modal.js';
import { startNewConversation } from '../chat/controller.js';
import { getStateValue } from '../state.js';

/**
 * Initialise l'écoute globale des raccourcis clavier.
 */
export function initGlobalListeners() {
  document.addEventListener('keydown', handleGlobalKeydown);
  console.log('[Events] Raccourcis clavier activés');
}

/**
 * Gère l'événement keydown sur le document (Event Delegation).
 */
function handleGlobalKeydown(e) {
  // Ignorer si on tape dans un input, textarea ou contenteditable (sauf si c'est un combo Ctrl)
  const isInputTarget = e.target.tagName === 'INPUT' || 
                        e.target.tagName === 'TEXTAREA' || 
                        e.target.isContentEditable;

  // On trouve le raccourci qui correspond
  const shortcut = KEYBOARD_SHORTCUTS.find(s => {
    return s.key.toLowerCase() === e.key.toLowerCase() &&
           !!s.ctrl === (e.ctrlKey || e.metaKey) && // support Mac (Cmd)
           !!s.shift === e.shiftKey;
  });

  if (!shortcut) return;

  // Règles d'interception selon le type d'input
  if (isInputTarget) {
    // Si l'utilisateur tape dans l'input de chat, 'Escape' doit seulement vider l'input (ou fermer un modal)
    // Ctrl+N ou Ctrl+, ont la priorité et doivent s'exécuter même dans un input.
    if (e.key === 'Escape') {
      // Laisser le comportement par défaut (blur), ou fermer dropdown
    } else if (!shortcut.ctrl) {
      return; // Ne pas intercepter les touches simples (ex: une lettre 'n' normale)
    }
  }

  // Exécution de l'action
  switch (shortcut.action) {
    case 'new-chat':
      e.preventDefault();
      startNewConversation();
      break;

    case 'open-settings':
      e.preventDefault();
      openModal('settings');
      break;

    case 'search':
      e.preventDefault();
      // Si sur mobile, on ouvre la sidebar
      if (window.innerWidth <= 768) {
        const sidebar = document.getElementById('sidebar');
        if (sidebar && !sidebar.classList.contains('is-open')) {
          document.getElementById('btn-toggle-sidebar')?.click();
        }
      }
      document.getElementById('search-conversations')?.focus();
      break;

    case 'close-modal':
      // Ferme une modale ouverte
      if (getStateValue('ui.activeModal')) {
        e.preventDefault();
        closeModal();
      }
      break;

    case 'fullscreen':
      e.preventDefault();
      const btn = document.getElementById('btn-fullscreen');
      if (btn) btn.click();
      break;
      
    case 'send-message':
      // Géré au niveau du textarea dans app.js pour Entrée / Shift+Entrée. 
      // Mais si on est focus ailleurs, ça peut forcer l'envoi.
      break;
  }
}
