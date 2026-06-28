/**
 * ============================================================
 * IndraChat — sidebar.js
 * Gestion de la Barre Latérale
 *
 * S'occupe de l'affichage de l'historique des conversations,
 * du tri par date, des dossiers, de la recherche, et des
 * menus contextuels (Renommer, Supprimer).
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
    }, getStateValue('settings.searchDebounceMs') || 200);
    
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
 */
function renderConversationsList() {
  const listContainer = document.getElementById('history-list');
  if (!listContainer) return;

  const query = getStateValue('chat.searchQuery');
  const activeId = getStateValue('chat.activeConversationId');

  // Filtrage
  const filtered = query 
    ? allConversationsCache.filter(c => c.title.toLowerCase().includes(query))
    : allConversationsCache;

  if (filtered.length === 0) {
    listContainer.innerHTML = `
      <div style="padding: var(--space-4); text-align: center; color: var(--color-text-muted); font-size: var(--text-sm);">
        ${query ? 'Aucun résultat.' : 'Aucune conversation.'}
      </div>
    `;
    return;
  }

  // Groupement temporel simpliste (Aujourd'hui, Hier, Mois précédent...)
  // Pour rester Vanilla et simple, on fait juste une liste plate triée par date (plus récent au plus vieux)
  // L'IndexedDB renvoie déjà trié par updatedAt DESC.

  let html = '';
  for (const conv of filtered) {
    const isActive = conv.id === activeId ? 'is-active' : '';
    const dateStr = formatDate(conv.updatedAt);
    const title = escapeHtml(conv.title || 'Nouvelle conversation');

    html += `
      <div class="nav-item ${isActive}" data-id="${conv.id}" title="${title}">
        <svg class="nav-item__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
        <span class="nav-item__text">${title}</span>
        <button class="nav-item__options-btn" aria-label="Options de conversation" data-id="${conv.id}">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="1"></circle><circle cx="12" cy="5" r="1"></circle><circle cx="12" cy="19" r="1"></circle></svg>
        </button>
      </div>
    `;
  }

  listContainer.innerHTML = html;

  // Attacher les événements (Délégation d'événements)
  listContainer.querySelectorAll('.nav-item').forEach(item => {
    // Clic pour charger
    item.addEventListener('click', (e) => {
      // Ignorer si on a cliqué sur le bouton d'options
      if (e.target.closest('.nav-item__options-btn')) return;
      const id = item.getAttribute('data-id');
      const title = item.querySelector('.nav-item__text').textContent;
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

function updateActiveState() {
  const activeId = getStateValue('chat.activeConversationId');
  const items = document.querySelectorAll('#history-list .nav-item');
  
  items.forEach(item => {
    if (item.getAttribute('data-id') === activeId) {
      item.classList.add('is-active');
    } else {
      item.classList.remove('is-active');
    }
  });
}

function openContextMenu(event, convId) {
  const menu = document.getElementById('conversation-context-menu');
  if (!menu) return;

  menu.setAttribute('data-target-id', convId);
  
  // Positionner le menu
  const rect = event.target.getBoundingClientRect();
  menu.style.top = `${rect.bottom + 5}px`;
  menu.style.left = `${rect.left}px`;
  
  menu.classList.remove('hidden');

  // Attacher une seule fois les événements (on écrase les anciens via cloneNode si besoin, ou on gere dynamiquement)
  const btnDelete = menu.querySelector('#btn-ctx-delete');
  
  // Utilisation d'un event listener unique via un flag
  if (!menu.dataset.listenersBound) {
    btnDelete?.addEventListener('click', async () => {
      const targetId = menu.getAttribute('data-target-id');
      if (targetId) {
        if (confirm('Voulez-vous vraiment supprimer cette conversation ?')) {
          await deleteConversation(targetId);
          menu.classList.add('hidden');
          
          if (getStateValue('chat.activeConversationId') === targetId) {
            startNewConversation();
          }
          refreshSidebar();
        }
      }
    });
    menu.dataset.listenersBound = "true";
  }
}
