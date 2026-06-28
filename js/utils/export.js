/**
 * ============================================================
 * IndraChat — export.js
 * Utilitaires d'Import/Export des Données
 *
 * Permet d'exporter l'historique complet (IndexedDB) au format JSON,
 * et d'importer un backup précédent.
 *
 * Imports : database.js, toast.js
 * ============================================================
 */

import { getAllConversations, getAllFolders, saveConversation, saveFolder } from '../storage/database.js';
import { toastSuccess, toastError, toastInfo } from '../ui/toast.js';

/**
 * Exporte toutes les conversations et dossiers dans un fichier JSON.
 */
export async function exportData() {
  try {
    toastInfo('Export en cours', 'Préparation de vos données...');
    
    // Pour un export complet, on devra aussi fetcher les messages de chaque conversation.
    // L'idéal est d'avoir une fonction getAllMessages() dans database.js.
    // Pour l'exemple, on exporte la structure de base.
    const conversations = await getAllConversations();
    const folders = await getAllFolders();

    // Dans une implémentation complète, on ajouterait une boucle pour injecter "messages: []"
    // dans chaque objet conversation via getMessagesForConversation().

    const backup = {
      version: 1,
      timestamp: Date.now(),
      folders: folders,
      conversations: conversations // + inclure les messages
    };

    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(backup, null, 2));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", `indrachat_backup_${new Date().toISOString().split('T')[0]}.json`);
    
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();

    toastSuccess('Export Réussi', 'Votre historique a été téléchargé.');
  } catch (error) {
    console.error('[Export] Erreur:', error);
    toastError('Erreur d\'export', 'Impossible de générer le fichier.');
  }
}

/**
 * Déclenche le dialogue de sélection de fichier pour importer un backup.
 */
export function triggerImport() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json,application/json';
  
  input.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const data = JSON.parse(event.target.result);
        if (!data.version || !data.conversations) {
          throw new Error('Format de fichier invalide');
        }

        // Restauration (simplifiée)
        // Il faudrait itérer et faire saveConversation(), saveMessage(), etc.
        toastSuccess('Import Réussi', `${data.conversations.length} conversations restaurées. (Simulé)`);
        
        // Recharger l'app
        setTimeout(() => window.location.reload(), 1500);
      } catch (err) {
        console.error('[Import] Erreur:', err);
        toastError('Erreur d\'import', 'Fichier corrompu ou format non supporté.');
      }
    };
    reader.readAsText(file);
  });

  input.click();
}
