/**
 * ============================================================
 * IndraChat — toast.js
 * Système de Notifications Non Intrusives
 *
 * Affiche des messages temporaires (toasts) en bas à droite de l'écran.
 * Gère l'empilement, l'auto-disparition, et l'animation de sortie.
 *
 * Imports : aucun
 * Exports : showToast, toastInfo, toastSuccess, toastWarning, toastError
 * ============================================================
 */

/**
 * Types de toasts supportés (liés aux classes CSS modal.css).
 * @enum {string}
 */
const ToastType = {
  INFO: 'info',
  SUCCESS: 'success',
  WARNING: 'warning',
  ERROR: 'error'
};

/**
 * Icônes SVG par type de toast.
 */
const Icons = {
  [ToastType.INFO]: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>`,
  [ToastType.SUCCESS]: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>`,
  [ToastType.WARNING]: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>`,
  [ToastType.ERROR]: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>`
};

/**
 * Affiche une notification toast.
 *
 * @param {Object} options
 * @param {string} options.title - Titre court en gras
 * @param {string} [options.message] - Description détaillée optionnelle
 * @param {ToastType|string} [options.type='info'] - Type de toast
 * @param {number} [options.duration=4000] - Durée d'affichage en ms (0 = infini)
 */
export function showToast({ title, message = '', type = ToastType.INFO, duration = 4000 }) {
  const container = document.getElementById('toast-container');
  if (!container) {
    console.error('[Toast] Conteneur introuvable');
    return;
  }

  // Création de l'élément racine
  const toast = document.createElement('div');
  toast.className = `toast toast--${type}`;
  toast.setAttribute('role', type === 'error' ? 'alert' : 'status');

  // Construction du HTML interne
  const msgHtml = message ? `<div class="toast__message">${escapeHTML(message)}</div>` : '';
  const progressHtml = duration > 0 
    ? `<div class="toast__progress" style="animation: toastProgress ${duration}ms linear forwards;"></div>` 
    : '';

  toast.innerHTML = `
    <div class="toast__icon" aria-hidden="true">${Icons[type]}</div>
    <div class="toast__body">
      <div class="toast__title">${escapeHTML(title)}</div>
      ${msgHtml}
    </div>
    <button class="toast__close" aria-label="Fermer">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
    </button>
    ${progressHtml}
  `;

  // Ajout au DOM
  container.appendChild(toast);

  // Gestion de la fermeture
  let removalTimeout;

  const removeToast = () => {
    // Si déjà en cours de fermeture, on ignore
    if (toast.classList.contains('is-leaving')) return;
    
    toast.classList.add('is-leaving');
    
    // Attendre la fin de l'animation CSS (var(--duration-slow) = 400ms) avant suppression
    setTimeout(() => {
      if (toast.parentNode === container) {
        container.removeChild(toast);
      }
    }, 450);
  };

  // Fermeture manuelle (clic bouton X)
  toast.querySelector('.toast__close').addEventListener('click', () => {
    if (removalTimeout) clearTimeout(removalTimeout);
    removeToast();
  });

  // Fermeture automatique (timer)
  if (duration > 0) {
    removalTimeout = setTimeout(() => {
      removeToast();
    }, duration);
  }
}

/**
 * Utilitaires rapides
 */
export const toastInfo    = (title, message, duration) => showToast({ title, message, type: ToastType.INFO, duration });
export const toastSuccess = (title, message, duration) => showToast({ title, message, type: ToastType.SUCCESS, duration });
export const toastWarning = (title, message, duration) => showToast({ title, message, type: ToastType.WARNING, duration });
export const toastError   = (title, message, duration) => showToast({ title, message, type: ToastType.ERROR, duration: duration ?? 6000 }); // Les erreurs restent plus longtemps


/**
 * Échappement basique interne pour éviter l'injection via les paramètres
 */
function escapeHTML(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
