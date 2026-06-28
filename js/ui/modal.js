/**
 * ============================================================
 * IndraChat — modal.js
 * Gestionnaire Central des Fenêtres Modales
 *
 * Gère l'ouverture, la fermeture, et le verrouillage du scroll.
 * Une seule modale peut être ouverte à la fois.
 *
 * Imports : state (dispatch, getStateValue)
 * Exports : openModal, closeModal, initModals
 * ============================================================
 */

import { dispatch, getStateValue } from '../state.js';

let isAnimating = false;

/**
 * Initialise le système de modales (attache les listeners globaux).
 */
export function initModals() {
  const root = document.getElementById('modal-root');
  if (!root) return;

  // Clic sur le fond assombri (backdrop) pour fermer la modale
  root.addEventListener('click', (e) => {
    // On ferme uniquement si on clique exactement sur le backdrop, pas sur le contenu
    if (e.target.classList.contains('modal-backdrop')) {
      closeModal();
    }
  });

  // Touche Echap gérée dans app.js, mais on pourrait aussi l'attacher ici
  
  // Boutons génériques "data-close-modal"
  document.addEventListener('click', (e) => {
    const closeBtn = e.target.closest('[data-close-modal]');
    if (closeBtn) {
      closeModal();
    }
  });

  // Listener pour les boutons qui ouvrent une modale (ex: data-open-modal="settings")
  document.addEventListener('click', (e) => {
    const openBtn = e.target.closest('[data-open-modal]');
    if (openBtn) {
      const modalId = openBtn.getAttribute('data-open-modal');
      openModal(modalId);
    }
  });

  console.log('[UI] Modales initialisées');
}

/**
 * Ouvre une fenêtre modale par son ID.
 *
 * @param {string} modalId - L'ID de l'élément HTML modale
 */
export function openModal(modalId) {
  if (isAnimating) return;
  const root = document.getElementById('modal-root');
  const targetModal = document.getElementById(`modal-${modalId}`);

  if (!root || !targetModal) {
    console.error(`[Modal] Modale introuvable: modal-${modalId}`);
    return;
  }

  // Fermer la modale actuelle si nécessaire (sans délai)
  const currentActive = getStateValue('ui.activeModal');
  if (currentActive && currentActive !== modalId) {
    const currentEl = document.getElementById(`modal-${currentActive}`);
    if (currentEl) currentEl.classList.add('hidden');
  }

  isAnimating = true;

  // Préparation
  root.classList.remove('hidden');
  targetModal.classList.remove('hidden');

  // Animation d'entrée
  root.classList.add('is-entering');
  targetModal.classList.add('is-entering');

  // Verrouiller le scroll du body
  document.body.style.overflow = 'hidden';

  // Mise à jour de l'état
  dispatch('ui.activeModal', modalId);
  if (modalId === 'settings') dispatch('ui.settingsModalOpen', true);

  // Fin de l'animation
  setTimeout(() => {
    root.classList.remove('is-entering');
    targetModal.classList.remove('is-entering');
    isAnimating = false;
    
    // Focus sur le premier input ou bouton fermer (Accessibilité)
    const firstInput = targetModal.querySelector('input, button:not(.modal__close-btn)');
    if (firstInput) firstInput.focus();
    else targetModal.querySelector('.modal__close-btn')?.focus();
    
  }, 300); // 300ms correspond à var(--duration-normal)
}

/**
 * Ferme la fenêtre modale actuellement ouverte.
 */
export function closeModal() {
  if (isAnimating) return;
  const currentActive = getStateValue('ui.activeModal');
  if (!currentActive) return;

  const root = document.getElementById('modal-root');
  const targetModal = document.getElementById(`modal-${currentActive}`);

  if (!root || !targetModal) return;

  isAnimating = true;

  // Animation de sortie
  root.classList.add('is-leaving');
  targetModal.classList.add('is-leaving');

  // Fin de l'animation
  setTimeout(() => {
    root.classList.remove('is-leaving');
    targetModal.classList.remove('is-leaving');
    
    root.classList.add('hidden');
    targetModal.classList.add('hidden');

    // Déverrouiller le scroll du body
    document.body.style.overflow = '';

    // Mise à jour de l'état
    dispatch('ui.activeModal', null);
    if (currentActive === 'settings') dispatch('ui.settingsModalOpen', false);

    isAnimating = false;
  }, 200); // 200ms correspond à var(--duration-fast)
}
