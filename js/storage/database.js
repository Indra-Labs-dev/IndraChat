/**
 * ============================================================
 * IndraChat — database.js
 * Base de Données Locale (IndexedDB)
 *
 * Utilise l'API native IndexedDB avec des Promesses pour stocker
 * les conversations et les messages.
 * 
 * Schéma :
 * - Store 'conversations' : { id, title, folderId, createdAt, updatedAt, ... }
 * - Store 'messages' : { id, conversationId, role, content, createdAt, ... }
 * - Store 'folders' : { id, name, color, createdAt, order }
 *
 * Imports : aucun
 * Exports : DB operations (initDB, getConversation, saveMessage, etc.)
 * ============================================================
 */

const DB_NAME = 'IndraChatDB';
const DB_VERSION = 1;

let dbInstance = null;

/**
 * Initialise ou upgrade la base de données IndexedDB.
 * @returns {Promise<IDBDatabase>}
 */
export function initDB() {
  return new Promise((resolve, reject) => {
    if (dbInstance) {
      return resolve(dbInstance);
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = (event) => {
      console.error('[DB] Erreur d\'ouverture IndexedDB:', event.target.error);
      reject(event.target.error);
    };

    request.onsuccess = (event) => {
      dbInstance = event.target.result;
      console.log('[DB] Connecté à IndexedDB');
      resolve(dbInstance);
    };

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      console.log('[DB] Création/Upgrade du schéma...');

      // 1. Table des Dossiers
      if (!db.objectStoreNames.contains('folders')) {
        db.createObjectStore('folders', { keyPath: 'id' });
      }

      // 2. Table des Conversations
      if (!db.objectStoreNames.contains('conversations')) {
        const convStore = db.createObjectStore('conversations', { keyPath: 'id' });
        convStore.createIndex('updatedAt', 'updatedAt', { unique: false });
        convStore.createIndex('folderId', 'folderId', { unique: false });
      }

      // 3. Table des Messages
      if (!db.objectStoreNames.contains('messages')) {
        const msgStore = db.createObjectStore('messages', { keyPath: 'id' });
        // Index crucial pour récupérer tous les messages d'une conversation triés par date
        msgStore.createIndex('conversationId_createdAt', ['conversationId', 'createdAt'], { unique: false });
        msgStore.createIndex('conversationId', 'conversationId', { unique: false });
      }
    };
  });
}

/**
 * Wrapper utilitaire pour exécuter une transaction en mode Promesse.
 * @param {string} storeName 
 * @param {string} mode - 'readonly' | 'readwrite'
 * @param {Function} operation - (store) => IDBRequest
 * @returns {Promise<any>}
 */
function runTransaction(storeName, mode, operation) {
  return new Promise(async (resolve, reject) => {
    try {
      const db = await initDB();
      const transaction = db.transaction(storeName, mode);
      const store = transaction.objectStore(storeName);
      
      let req;
      try {
        req = operation(store);
      } catch (e) {
        return reject(e);
      }

      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
      
    } catch (error) {
      reject(error);
    }
  });
}


/* ============================================================
   CONVERSATIONS
   ============================================================ */

export function saveConversation(conversation) {
  // Garantir l'existence des dates
  const convToSave = {
    ...conversation,
    updatedAt: conversation.updatedAt || Date.now(),
    createdAt: conversation.createdAt || Date.now()
  };
  return runTransaction('conversations', 'readwrite', (store) => store.put(convToSave));
}

export function getConversation(id) {
  return runTransaction('conversations', 'readonly', (store) => store.get(id));
}

export function getAllConversations() {
  return new Promise(async (resolve, reject) => {
    try {
      const db = await initDB();
      const transaction = db.transaction('conversations', 'readonly');
      const store = transaction.objectStore('conversations');
      const index = store.index('updatedAt');
      
      // Récupérer trié par date de mise à jour (le plus récent en premier via cursor prev)
      const request = index.openCursor(null, 'prev');
      const results = [];

      request.onsuccess = (event) => {
        const cursor = event.target.result;
        if (cursor) {
          results.push(cursor.value);
          cursor.continue();
        } else {
          resolve(results);
        }
      };
      request.onerror = () => reject(request.error);
    } catch (e) {
      reject(e);
    }
  });
}

export async function deleteConversation(id) {
  const db = await initDB();
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['conversations', 'messages'], 'readwrite');
    const convStore = transaction.objectStore('conversations');
    const msgStore = transaction.objectStore('messages');
    
    // 1. Supprimer la conversation
    convStore.delete(id);
    
    // 2. Supprimer tous les messages associés
    const index = msgStore.index('conversationId');
    const request = index.openCursor(IDBKeyRange.only(id));
    
    request.onsuccess = (event) => {
      const cursor = event.target.result;
      if (cursor) {
        cursor.delete();
        cursor.continue();
      }
    };
    
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
}


/* ============================================================
   MESSAGES
   ============================================================ */

export function saveMessage(message) {
  const msgToSave = {
    ...message,
    createdAt: message.createdAt || Date.now()
  };
  return runTransaction('messages', 'readwrite', (store) => store.put(msgToSave));
}

export function getMessagesForConversation(conversationId) {
  return new Promise(async (resolve, reject) => {
    try {
      const db = await initDB();
      const transaction = db.transaction('messages', 'readonly');
      const store = transaction.objectStore('messages');
      const index = store.index('conversationId_createdAt');
      
      // Clé composite : [conversationId, -Infinity] jusqu'à [conversationId, +Infinity]
      const range = IDBKeyRange.bound(
        [conversationId, 0],
        [conversationId, Date.now() + 100000]
      );
      
      const request = index.getAll(range);
      
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    } catch (e) {
      reject(e);
    }
  });
}

export function deleteMessage(messageId) {
  return runTransaction('messages', 'readwrite', (store) => store.delete(messageId));
}


/* ============================================================
   DOSSIERS (FOLDERS)
   ============================================================ */

export function saveFolder(folder) {
  return runTransaction('folders', 'readwrite', (store) => store.put({
    ...folder,
    createdAt: folder.createdAt || Date.now()
  }));
}

export function getAllFolders() {
  return new Promise(async (resolve, reject) => {
    try {
      const db = await initDB();
      const transaction = db.transaction('folders', 'readonly');
      const store = transaction.objectStore('folders');
      const request = store.getAll();
      
      request.onsuccess = () => {
        // Tri par ordre personnalisé, puis par date de création
        const folders = request.result || [];
        folders.sort((a, b) => (a.order || 0) - (b.order || 0));
        resolve(folders);
      };
      request.onerror = () => reject(request.error);
    } catch (e) {
      reject(e);
    }
  });
}

export function deleteFolder(id) {
  return runTransaction('folders', 'readwrite', (store) => store.delete(id));
}
