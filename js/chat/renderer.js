/**
 * ============================================================
 * IndraChat — chat/renderer.js
 * Moteur de Rendu du DOM (UI) des Messages
 *
 * S'occupe d'injecter ou de mettre à jour les bulles de messages
 * dans la liste des messages. Traduit le Markdown en HTML.
 *
 * Imports : markdown.js, helpers.js, state.js
 * Exports : appendMessage, updateMessageChunk, finishMessageStream, clearChatUI, scrollToBottom
 * ============================================================
 */

import { renderMarkdown, renderMermaidDiagrams } from '../utils/markdown.js';
import { escapeHtml, formatDate } from '../utils/helpers.js';
import { getStateValue } from '../state.js';
import { PROVIDERS_MAP } from '../config.js';

/**
 * Cache du conteneur de liste de messages.
 * @type {HTMLElement|null}
 */
let messagesListEl = null;

function getListEl() {
  if (!messagesListEl) {
    messagesListEl = document.getElementById('messages-list');
    // Attacher les listeners de délégation sur le conteneur une seule fois
    if (messagesListEl) attachMessageListeners(messagesListEl);
  }
  return messagesListEl;
}

/**
 * Attache les listeners globaux sur le conteneur de messages.
 * Utilisé pour les boutons Copier, Régénérer, Copier code, etc.
 */
function attachMessageListeners(listEl) {
  listEl.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;

    const action = btn.getAttribute('data-action');
    const article = btn.closest('article');

    if (action === 'copy') {
      // Copier le texte brut du message
      const contentEl = article?.querySelector('.message__content, .message__text');
      const text = contentEl ? (contentEl.innerText || contentEl.textContent) : '';
      navigator.clipboard.writeText(text).then(() => {
        const origHTML = btn.innerHTML;
        btn.innerHTML = `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#22c55e" stroke-width="2"><polyline points="20 6 9 17 4 12"></polyline></svg>`;
        setTimeout(() => { btn.innerHTML = origHTML; }, 1500);
      }).catch(() => {});
    }

    if (action === 'copy-code') {
      // Copier le code d'un bloc de code
      const codeBlock = btn.closest('.code-block');
      const codeEl = codeBlock?.querySelector('code');
      const text = codeEl ? (codeEl.innerText || codeEl.textContent) : '';
      navigator.clipboard.writeText(text).then(() => {
        const span = btn.querySelector('span');
        if (span) {
          const orig = span.textContent;
          span.textContent = 'Copié !';
          setTimeout(() => { span.textContent = orig; }, 1500);
        }
      }).catch(() => {});
    }

    if (action === 'speak') {
      const contentEl = article?.querySelector('.message__content, .message__text');
      const text = contentEl ? (contentEl.innerText || contentEl.textContent) : '';
      if (text && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'fr-FR';
        window.speechSynthesis.speak(utterance);
      }
    }
  });
}

/**
 * Vide completement l'interface de chat (ex: lors de "Nouvelle conversation").
 */
export function clearChatUI() {
  const list = getListEl();
  if (list) list.innerHTML = '';
}

/**
 * Ajoute un nouveau message complet ou un "skeleton" vide dans l'interface.
 * 
 * @param {Object} msg - Objet message
 * @param {string} msg.id - ID unique
 * @param {string} msg.role - 'user' | 'assistant'
 * @param {string} msg.content - Contenu texte (Markdown)
 * @param {string} [msg.model] - Nom du modèle (optionnel, affiché pour l'assistant)
 * @param {boolean} [isStreaming=false] - Si vrai, ajoute un curseur clignotant et prépare les mises à jour
 */
export function appendMessage(msg, isStreaming = false) {
  const list = getListEl();
  if (!list) return;

  // Création du conteneur de message
  const article = document.createElement('article');
  article.className = `message message--${msg.role}`;
  article.id = `msg-${msg.id}`;
  
  if (isStreaming) {
    article.classList.add('message--streaming');
  }

  // Largeur personnalisée (basée sur settings)
  const maxWidthClass = `max-w-${getStateValue('settings.messageWidth')}`; // normal, wide, narrow
  
  let avatarHtml = '';
  let modelHtml = '';

  if (msg.role === 'assistant') {
    const providerId = getStateValue('ai.activeProviderId');
    const icon = PROVIDERS_MAP.get(providerId)?.icon || '🤖';
    
    avatarHtml = `
      <div class="message__avatar" aria-hidden="true">
        ${icon}
      </div>
    `;

    if (getStateValue('settings.showModelInfo')) {
      const modelName = msg.model || getStateValue('ai.activeModelId') || 'Assistant';
      modelHtml = `<div class="message__model-name">${escapeHtml(modelName)}</div>`;
    }
  }

  // Boutons d'action
  const actionsHtml = `
    <div class="message__actions" aria-label="Actions du message">
      <button class="message__action-btn" data-action="copy" title="Copier" aria-label="Copier le message">
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
      </button>
      ${msg.role === 'assistant' ? `
      <button class="message__action-btn" data-action="retry" title="Régénérer" aria-label="Régénérer la réponse">
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 4 23 10 17 10"></polyline><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path></svg>
      </button>
      ` : `
      <button class="message__action-btn" data-action="edit" title="Modifier" aria-label="Modifier le message">
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
      </button>
      `}
    </div>
  `;

  // Pré-rendu du Markdown (sera vide si c'est le début du streaming)
  const contentHtml = renderMarkdown(msg.content);
  const cursorClass = isStreaming ? 'streaming-cursor' : '';

  article.innerHTML = `
    ${avatarHtml}
    <div class="message__content-wrapper ${maxWidthClass}">
      ${modelHtml}
      <div class="message__bubble">
        <div class="message__content ${cursorClass}">${contentHtml}</div>
      </div>
      ${actionsHtml}
    </div>
  `;

  list.appendChild(article);
  scrollToBottom();

  if (!isStreaming) {
    // Rend les diagrammes sur un message déjà complet (ex: chargement historique)
    requestAnimationFrame(() => renderMermaidDiagrams());
  }
}

/**
 * Met à jour un message en direct (Streaming).
 * Re-parse le contenu Markdown complet à chaque chunk.
 * 
 * Note : Dans une app super optimisée, on ne parserait que le delta,
 * mais Marked.js est extrêmement rapide, donc un re-parse complet du
 * message à chaque frame à 60fps ne bloque pas le thread principal
 * pour des messages standards (< 10000 mots).
 *
 * @param {string} msgId - ID du message
 * @param {string} fullContent - Le texte Markdown concaténé jusqu'à présent
 */
export function updateMessageChunk(msgId, fullContent) {
  const article = document.getElementById(`msg-${msgId}`);
  if (!article) return;

  const contentEl = article.querySelector('.message__content');
  if (!contentEl) return;

  // On re-parse et on injecte le HTML
  contentEl.innerHTML = renderMarkdown(fullContent);
  
  // Auto-scroll adaptatif (ne scroll pas si l'utilisateur a remonté la page)
  if (shouldAutoScroll()) {
    scrollToBottom();
  }
}

/**
 * Termine l'animation de streaming pour un message.
 * Retire le curseur clignotant et exécute les rendus lourds post-génération (Mermaid).
 *
 * @param {string} msgId
 */
export function finishMessageStream(msgId) {
  const article = document.getElementById(`msg-${msgId}`);
  if (!article) return;

  article.classList.remove('message--streaming');
  
  const contentEl = article.querySelector('.message__content');
  if (contentEl) {
    contentEl.classList.remove('streaming-cursor');
  }

  // Le streaming est fini, on peut faire le rendu des diagrammes Mermaid
  requestAnimationFrame(() => renderMermaidDiagrams());
  scrollToBottom();
}

/**
 * Force le scroll de la vue de chat vers le bas.
 */
export function scrollToBottom() {
  const container = document.getElementById('chat-container');
  if (container) {
    container.scrollTo({
      top: container.scrollHeight,
      behavior: 'smooth'
    });
  }
}

/**
 * Heuristique d'auto-scroll : 
 * Retourne vrai si l'utilisateur est déjà presque tout en bas.
 * S'il a scrollé vers le haut pour lire, on retourne faux pour ne pas le déranger.
 */
function shouldAutoScroll() {
  if (!getStateValue('settings.autoScroll')) return false;

  const container = document.getElementById('chat-container');
  if (!container) return false;

  // Marge de tolérance de 100px
  const threshold = 100;
  const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < threshold;
  
  return isNearBottom;
}
