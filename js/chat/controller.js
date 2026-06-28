/**
 * ============================================================
 * IndraChat — chat/controller.js
 * Contrôleur Principal du Chat
 *
 * Chef d'orchestre :
 * - Écoute l'input de l'utilisateur
 * - Appelle l'orchestrateur API (api/index.js)
 * - Pilote le moteur de rendu (renderer.js)
 * - Sauvegarde en base de données (database.js)
 *
 * Imports : api/index.js, chat/renderer.js, storage/database.js, etc.
 * Exports : initChat, sendMessage, stopGeneration
 * ============================================================
 */

import { chatCompletion } from '../api/index.js';
import { appendMessage, updateMessageChunk, finishMessageStream, clearChatUI, scrollToBottom } from './renderer.js';
import { saveConversation, saveMessage, getMessagesForConversation } from '../storage/database.js';
import { generateId, generateMessageId, generateConversationId } from '../utils/ids.js';
import { dispatch, getStateValue } from '../state.js';
import { toastError } from '../ui/toast.js';

// Stockage en mémoire vive de la conversation courante
let currentMessages = [];
// Permet d'annuler une requête en cours
let abortController = null;

/**
 * Initialise le contrôleur (attache les événements de la vue).
 */
export function initChat() {
  const btnSend = document.getElementById('btn-send');
  const btnStop = document.getElementById('btn-stop');
  const input = document.getElementById('message-input');
  const btnNew = document.getElementById('btn-new-chat');

  if (btnSend && input) {
    btnSend.addEventListener('click', handleSendClick);
  }

  if (btnStop) {
    btnStop.addEventListener('click', stopGeneration);
  }

  if (btnNew) {
    btnNew.addEventListener('click', startNewConversation);
  }
}

/**
 * Commence une nouvelle conversation vide.
 */
export async function startNewConversation() {
  stopGeneration();
  currentMessages = [];
  dispatch('chat.activeConversationId', null);
  
  clearChatUI();
  document.getElementById('welcome-screen')?.classList.remove('hidden');
  document.getElementById('generation-stats')?.classList.add('hidden');
  document.getElementById('conversation-title').textContent = 'Nouvelle conversation';
  
  const input = document.getElementById('message-input');
  if (input) {
    input.value = '';
    input.style.height = 'auto';
    input.focus();
  }
}

/**
 * Charge une conversation depuis la base de données.
 * @param {string} convId 
 * @param {string} [title] 
 */
export async function loadConversation(convId, title = 'Conversation') {
  stopGeneration();
  clearChatUI();
  
  document.getElementById('welcome-screen')?.classList.add('hidden');
  document.getElementById('conversation-title').textContent = title;
  
  try {
    const msgs = await getMessagesForConversation(convId);
    currentMessages = msgs;
    dispatch('chat.activeConversationId', convId);

    // Rendu de tous les messages historiques
    for (const msg of currentMessages) {
      appendMessage(msg, false); // false = pas de streaming
    }
    
    // Le renderer s'occupera du scroll et de Mermaid
    setTimeout(scrollToBottom, 50);

  } catch (err) {
    console.error('Erreur chargement conversation:', err);
    toastError('Erreur', 'Impossible de charger cette conversation.');
  }
}

/**
 * Gère le clic sur "Envoyer".
 */
async function handleSendClick() {
  const input = document.getElementById('message-input');
  if (!input) return;

  const content = input.value.trim();
  if (!content) return;

  if (getStateValue('ai.isGenerating')) return;

  // Réinitialiser l'input
  input.value = '';
  input.style.height = 'auto';
  document.getElementById('btn-send').disabled = true;

  await sendMessage(content);
}

/**
 * Envoie un message, l'ajoute à l'UI, et déclenche la réponse de l'IA.
 * 
 * @param {string} textContent - Le texte tapé par l'utilisateur
 */
export async function sendMessage(textContent) {
  // 1. Gérer l'état de la conversation (créer si nouvelle)
  let convId = getStateValue('chat.activeConversationId');
  let isNewConv = false;
  
  if (!convId) {
    convId = generateConversationId();
    isNewConv = true;
    dispatch('chat.activeConversationId', convId);
    
    // Si c'est le 1er message, on masque l'écran d'accueil
    document.getElementById('welcome-screen')?.classList.add('hidden');
    
    // Titre temporaire (le système auto-title pourra le modifier après)
    const title = getStateValue('settings.autoTitle') 
      ? textContent.substring(0, 30) + '...'
      : 'Nouvelle conversation';
      
    document.getElementById('conversation-title').textContent = title;

    await saveConversation({
      id: convId,
      title: title,
      folderId: null,
      createdAt: Date.now(),
      updatedAt: Date.now()
    });
  } else {
    // Mettre à jour l'horodatage de la conversation
    await saveConversation({
      id: convId,
      title: document.getElementById('conversation-title').textContent,
      updatedAt: Date.now()
    });
  }

  // 2. Créer et stocker le message de l'utilisateur
  const userMsg = {
    id: generateMessageId(),
    conversationId: convId,
    role: 'user',
    content: textContent,
    createdAt: Date.now()
  };

  currentMessages.push(userMsg);
  appendMessage(userMsg, false);
  await saveMessage(userMsg);

  // 3. Préparer le message vide de l'assistant dans l'UI
  const assistantMsgId = generateMessageId();
  const assistantMsg = {
    id: assistantMsgId,
    conversationId: convId,
    role: 'assistant',
    content: '',
    model: getStateValue('ai.activeModelId'),
    createdAt: Date.now()
  };

  // On l'ajoute en mode streaming (curseur clignotant)
  appendMessage(assistantMsg, true);

  // 4. Mettre à jour l'interface (mode génération)
  dispatch('ai.isGenerating', true);
  document.getElementById('btn-send')?.classList.add('hidden');
  document.getElementById('btn-stop')?.classList.remove('hidden');
  
  // Formatage du contexte pour l'API (on exclut les métadonnées internes)
  const apiMessages = currentMessages.map(m => ({
    role: m.role,
    content: m.content
  }));

  // 5. Appeler l'API via l'orchestrateur
  abortController = new AbortController();
  
  const startTime = performance.now();
  let firstChunkTime = null;

  try {
    await chatCompletion(
      apiMessages,
      {
        onChunk: (chunk) => {
          if (!firstChunkTime) firstChunkTime = performance.now();
          assistantMsg.content += chunk;
          updateMessageChunk(assistantMsgId, assistantMsg.content);
        },
        onDone: async (result) => {
          if (result?.aborted) {
            assistantMsg.content += '\n\n*(Génération interrompue)*';
            updateMessageChunk(assistantMsgId, assistantMsg.content);
          }
          
          // Fin du streaming visuel
          finishMessageStream(assistantMsgId);
          
          // Sauvegarde en DB
          currentMessages.push(assistantMsg);
          await saveMessage(assistantMsg);
          
          updateUIOnFinish(startTime, firstChunkTime, assistantMsg.content.length);
        },
        onError: (err) => {
          console.error('Erreur API:', err);
          toastError('Erreur de communication', err.message);
          
          assistantMsg.content += `\n\n**Erreur :** ${err.message}`;
          updateMessageChunk(assistantMsgId, assistantMsg.content);
          finishMessageStream(assistantMsgId);
          
          updateUIOnFinish(startTime, firstChunkTime, 0);
        }
      },
      abortController.signal
    );
    
  } catch (e) {
    // Catch global de secours
    updateUIOnFinish(startTime, null, 0);
  }
}

/**
 * Interrompt la génération en cours.
 */
export function stopGeneration() {
  if (abortController) {
    abortController.abort();
    abortController = null;
  }
}

/**
 * Remet l'UI dans son état d'attente après génération et calcule les stats.
 */
function updateUIOnFinish(startTime, firstChunkTime, charsCount) {
  dispatch('ai.isGenerating', false);
  
  document.getElementById('btn-stop')?.classList.add('hidden');
  document.getElementById('btn-send')?.classList.remove('hidden');
  document.getElementById('message-input')?.focus();

  // Mise à jour de la barre de statistiques
  const statsBar = document.getElementById('generation-stats');
  if (statsBar && startTime) {
    statsBar.classList.remove('hidden');
    
    const endTime = performance.now();
    const totalTimeMs = endTime - startTime;
    const ttftMs = firstChunkTime ? (firstChunkTime - startTime) : totalTimeMs;
    
    // Approximation tokens via helpers.js
    // Une implémentation réelle utiliserait le tokenizer ici
    const estTokens = Math.max(1, Math.ceil(charsCount / 4));
    const tokensPerSec = (estTokens / (totalTimeMs / 1000)).toFixed(1);

    document.getElementById('stat-time').textContent = `${(totalTimeMs / 1000).toFixed(2)}s`;
    document.getElementById('stat-speed').textContent = `${tokensPerSec} t/s`;
    
    const statTtft = document.getElementById('stat-ttft');
    if (statTtft) {
        statTtft.textContent = `${(ttftMs).toFixed(0)}ms`;
    }
  }
  
  abortController = null;
}
