/**
 * ============================================================
 * IndraChat — sidebar.js
 * Gestion de la Barre Latérale
 *
 * S'occupe de l'affichage de l'historique des conversations,
 * du tri par date, des dossiers, de la recherche, et des
 * menus contextuels (Renommer, Supprimer).
 *
 * HTML IDs utilisés:
 *   - #list-conversations  (liste des conversations récentes)
 *   - #search-conversations (input de recherche)
 *   - #btn-clear-search    (bouton effacer recherche)
 *   - #conversation-context-menu (menu contextuel)
 *
 * Imports : database.js, controller.js, state.js, helpers.js
 * ============================================================
 */

import { getAllConversations, deleteConversation } from '../storage/database.js';
import { loadConversation, startNewConversation } from '../chat/controller.js';
import { subscribe, dispatch, getStateValue } from '../state.js';
import { debounce, escapeHtml, formatDate } from '../utils/helpers.js';
import { openModal } from './modal.js';

let allConversationsCache = [];

export function initSidebar() {
  // 1. Initialiser la recherche
  const searchInput = document.getElementById('search-conversations');
  if (searchInput) {
    const debouncedSearch = debounce((e) => {
      dispatch('chat.searchQuery', e.target.value.trim().toLowerCase());
    }, 200);

    searchInput.addEventListener('input', debouncedSearch);
  }

  // 2. Écouter les changements d'état (Recherche & Chat actif)
  subscribe('chat.searchQuery', () => renderConversationsList());
  subscribe('chat.activeConversationId', () => updateActiveState());

  // 3. Charger les données initiales
  refreshSidebar();
}

/**
 * Recharge les conversations depuis IndexedDB et les affiche.
 * Exporté pour être appelé après chaque modification (envoi de message, suppression, etc.)
 */
export async function refreshSidebar() {
  try {
    allConversationsCache = await getAllConversations();
    renderConversationsList();
  } catch (error) {
    console.error('[Sidebar] Erreur chargement historique:', error);
  }
}

/**
 * Génère le HTML pour la liste des conversations (avec filtrage).
 * Utilise l'ID HTML correct : #list-conversations
 */
function renderConversationsList() {
  // FIX: L'HTML utilise id="list-conversations", pas "history-list"
  const listContainer = document.getElementById('list-conversations');
  if (!listContainer) return;

  const query = getStateValue('chat.searchQuery') || '';
  const activeId = getStateValue('chat.activeConversationId');

  // Filtrage
  const filtered = query
    ? allConversationsCache.filter(c =>
        c.title && c.title.toLowerCase().includes(query)
      )
    : allConversationsCache;

  if (filtered.length === 0) {
    listContainer.innerHTML = `
      <li style="padding: var(--space-4); text-align: center; color: var(--color-text-muted); font-size: var(--text-sm); list-style: none;">
        ${query ? 'Aucun résultat.' : 'Aucune conversation.'}
      </li>
    `;

    // Afficher ou cacher l'état vide global
    const emptyEl = document.getElementById('sidebar-empty');
    if (emptyEl && !query) emptyEl.classList.remove('hidden');
    return;
  }

  // Cacher l'état vide
  document.getElementById('sidebar-empty')?.classList.add('hidden');

  let html = '';
  for (const conv of filtered) {
    const isActive = conv.id === activeId;
    const isActiveClass = isActive ? 'is-active' : '';
    const dateStr = formatDate(conv.updatedAt);
    const title = escapeHtml(conv.title || 'Nouvelle conversation');

    html += `
      <li class="nav-item ${isActiveClass}" data-id="${conv.id}" title="${title}" role="listitem">
        <svg class="nav-item__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
        </svg>
        <span class="nav-item__text">${title}</span>
        <button class="nav-item__options-btn" aria-label="Options de conversation" data-id="${conv.id}" title="Options">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="5" r="1" fill="currentColor"></circle>
            <circle cx="12" cy="12" r="1" fill="currentColor"></circle>
            <circle cx="12" cy="19" r="1" fill="currentColor"></circle>
          </svg>
        </button>
      </li>
    `;
  }

  listContainer.innerHTML = html;

  // Attacher les événements via délégation
  listContainer.querySelectorAll('.nav-item').forEach(item => {
    // Clic pour charger la conversation
    item.addEventListener('click', (e) => {
      // Ignorer si on a cliqué sur le bouton d'options
      if (e.target.closest('.nav-item__options-btn')) return;
      const id = item.getAttribute('data-id');
      const titleEl = item.querySelector('.nav-item__text');
      const title = titleEl ? titleEl.textContent : 'Conversation';
      if (id !== getStateValue('chat.activeConversationId')) {
        loadConversation(id, title);

        // Sur mobile, fermer la sidebar après un clic
        if (window.innerWidth <= 768) {
          document.getElementById('btn-toggle-sidebar')?.click();
        }
      }
    });

    // Clic options
    const optBtn = item.querySelector('.nav-item__options-btn');
    if (optBtn) {
      optBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        openContextMenu(e, item.getAttribute('data-id'));
      });
    }
  });
}

/**
 * Met à jour visuellement l'item actif dans la sidebar.
 */
function updateActiveState() {
  const activeId = getStateValue('chat.activeConversationId');
  // FIX: Bon sélecteur correspondant à l'HTML
  const items = document.querySelectorAll('#list-conversations .nav-item');

  items.forEach(item => {
    if (item.getAttribute('data-id') === activeId) {
      item.classList.add('is-active');
    } else {
      item.classList.remove('is-active');
    }
  });
}

/**
 * Ouvre le menu contextuel d'une conversation.
 */
function openContextMenu(event, convId) {
  const menu = document.getElementById('conversation-context-menu');
  if (!menu) return;

  menu.setAttribute('data-target-id', convId);

  // Positionner le menu près du bouton cliqué
  const rect = event.currentTarget.getBoundingClientRect();
  const menuWidth = 180;
  let left = rect.left - menuWidth;
  if (left < 8) left = rect.right + 4;
  menu.style.top = `${rect.bottom + 4}px`;
  menu.style.left = `${left}px`;

  menu.classList.remove('hidden');

  // Attacher les listeners une seule fois
  if (!menu.dataset.listenersBound) {
    const handleMenuClick = async (e) => {
      const btn = e.target.closest('[data-action]');
      if (!btn) return;
      const action = btn.getAttribute('data-action');
      const targetId = menu.getAttribute('data-target-id');

      menu.classList.add('hidden');

      if (action === 'delete' && targetId) {
        if (confirm('Voulez-vous vraiment supprimer cette conversation ?')) {
          await deleteConversation(targetId);
          if (getStateValue('chat.activeConversationId') === targetId) {
            startNewConversation();
          }
          refreshSidebar();
        }
      } else if (action === 'rename' && targetId) {
        const newTitle = prompt('Nouveau nom de la conversation :');
        if (newTitle && newTitle.trim()) {
          const { saveConversation } = await import('../storage/database.js');
          await saveConversation({ id: targetId, title: newTitle.trim(), updatedAt: Date.now() });
          refreshSidebar();
          // Mettre à jour le titre dans la topbar si c'est la conv active
          if (getStateValue('chat.activeConversationId') === targetId) {
            const titleEl = document.getElementById('conversation-title');
            if (titleEl) titleEl.textContent = newTitle.trim();
          }
        }
      }
    };

    menu.addEventListener('click', handleMenuClick);
    menu.dataset.listenersBound = 'true';
  }

  // Fermer si clic en dehors
  const closeMenuOnOutsideClick = (e) => {
    if (!menu.contains(e.target) && !e.target.closest('.nav-item__options-btn')) {
      menu.classList.add('hidden');
      document.removeEventListener('click', closeMenuOnOutsideClick, true);
    }
  };
  // Délai pour ne pas capturer le clic courant
  setTimeout(() => {
    document.addEventListener('click', closeMenuOnOutsideClick, true);
  }, 0);
}
