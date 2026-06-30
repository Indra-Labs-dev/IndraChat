/**
 * ============================================================
 * IndraChat — settings.js
 * Gestion de l'Interface des Paramètres
 *
 * Ce module fait le pont entre le DOM de la modale "Paramètres"
 * et le store réactif (state.js). Il gère la navigation par onglets
 * et lie les inputs aux valeurs de l'état.
 *
 * Imports : state (subscribe, dispatch, getStateValue)
 * ============================================================
 */

import { subscribe, dispatch, getStateValue } from '../state.js';

/**
 * Initialise l'interface de la modale des paramètres.
 * Attache les listeners sur les tabs et les inputs.
 */
export function initSettingsUI() {
  const settingsModal = document.getElementById('modal-settings');
  if (!settingsModal) return;

  // 1. Navigation entre les onglets
  const navItems = settingsModal.querySelectorAll('.settings-nav__item');
  const panels = settingsModal.querySelectorAll('.settings-panel');

  navItems.forEach(item => {
    item.addEventListener('click', () => {
      const targetPanel = item.getAttribute('data-tab');

      // Mise à jour de la nav
      navItems.forEach(n => n.classList.remove('is-active'));
      item.classList.add('is-active');

      // Mise à jour des panels
      panels.forEach(p => {
        if (p.id === `settings-${targetPanel}`) {
          p.classList.add('is-active');
        } else {
          p.classList.remove('is-active');
        }
      });
    });
  });

  // 2. Synchronisation bidirectionnelle État <-> DOM
  bindInputToState('input-sys-prompt', 'settings.systemPrompt');
  bindInputToState('toggle-auto-title', 'settings.autoTitle');
  bindInputToState('toggle-code-hl', 'settings.codeHighlighting');
  bindInputToState('toggle-markdown', 'settings.renderMarkdown');
  bindInputToState('toggle-latex', 'settings.renderLatex');
  bindInputToState('toggle-send-enter', 'settings.sendOnEnter');
  
  // Apparence
  bindSelectToState('select-theme', 'settings.theme');
  bindSelectToState('select-font', 'settings.fontFamily');
  bindSelectToState('select-width', 'settings.messageWidth');
  bindToggleToState('toggle-animations', 'settings.animations');

  // Gestion spécifique pour les puces de couleurs (Accent)
  initAccentChips();

  // IA Avancée
  bindSliderToState('slider-temp', 'val-temp', 'settings.temperature');
  bindSliderToState('slider-top-p', 'val-top-p', 'settings.top_p');
  bindSliderToState('slider-top-k', 'val-top-k', 'settings.top_k');
  bindInputToState('input-max-tokens', 'settings.max_tokens');
  bindToggleToState('toggle-stream', 'settings.stream');

  // Connexion
  bindSelectToState('select-provider-setting', 'settings.provider');
  bindInputToState('input-api-url', 'settings.apiUrl');
  bindInputToState('input-api-key', 'settings.apiKey');

  // Bouton test connexion
  const btnTest = document.getElementById('btn-test-connection');
  const testResult = document.getElementById('connection-test-result');
  if (btnTest && testResult) {
    btnTest.addEventListener('click', async () => {
      btnTest.disabled = true;
      testResult.textContent = 'Test en cours...';
      testResult.style.color = 'var(--color-text-muted)';
      try {
        const { fetchModels } = await import('../api/index.js');
        const models = await fetchModels();
        testResult.textContent = `✅ Connecté ! ${models.length} modèle(s) disponible(s).`;
        testResult.style.color = '#22c55e';
      } catch (e) {
        testResult.textContent = `❌ Échec : ${e.message}`;
        testResult.style.color = '#ef4444';
      } finally {
        btnTest.disabled = false;
      }
    });
  }

  console.log('[UI] Paramètres initialisés');
}

/**
 * Lie un <input> texte ou checkbox à une clé du store.
 * @param {string} elementId 
 * @param {string} statePath 
 */
function bindInputToState(elementId, statePath) {
  const el = document.getElementById(elementId);
  if (!el) return;

  const isCheckbox = el.type === 'checkbox';

  // State -> DOM
  subscribe(statePath, (newVal) => {
    if (isCheckbox) el.checked = newVal;
    else el.value = newVal;
  });

  // DOM -> State
  el.addEventListener('change', (e) => {
    dispatch(statePath, isCheckbox ? e.target.checked : e.target.value);
  });
  
  // Pour les textareas/inputs textes, on peut aussi écouter 'input' avec debounce,
  // mais 'change' (au blur) est plus sûr pour éviter trop d'écritures.

  // Init value
  const initVal = getStateValue(statePath);
  if (isCheckbox) el.checked = initVal;
  else el.value = initVal;
}

/**
 * Lie un <select> à une clé du store.
 */
function bindSelectToState(elementId, statePath) {
  bindInputToState(elementId, statePath); // Identique
}

/**
 * Lie un checkbox (toggle switch) à une clé.
 */
function bindToggleToState(elementId, statePath) {
  bindInputToState(elementId, statePath); // Identique
}

/**
 * Lie un <input type="range"> (slider) à une clé, 
 * et met à jour le label affichant sa valeur.
 * 
 * @param {string} sliderId 
 * @param {string} labelId 
 * @param {string} statePath 
 */
function bindSliderToState(sliderId, labelId, statePath) {
  const slider = document.getElementById(sliderId);
  const label = document.getElementById(labelId);
  if (!slider) return;

  // State -> DOM
  subscribe(statePath, (newVal) => {
    slider.value = newVal;
    if (label) label.textContent = newVal;
  });

  // DOM -> State (immédiat au drag)
  slider.addEventListener('input', (e) => {
    const val = parseFloat(e.target.value);
    if (label) label.textContent = val;
    dispatch(statePath, val);
  });

  // Init
  const initVal = getStateValue(statePath);
  slider.value = initVal;
  if (label) label.textContent = initVal;
}

/**
 * Initialise la grille des pastilles de couleur d'accent.
 */
function initAccentChips() {
  const chips = document.querySelectorAll('.accent-chip');
  if (!chips.length) return;

  // State -> DOM
  subscribe('settings.accentColor', (newColor) => {
    chips.forEach(chip => {
      if (chip.dataset.color === newColor) {
        chip.classList.add('is-active');
      } else {
        chip.classList.remove('is-active');
      }
    });
  });

  // DOM -> State
  chips.forEach(chip => {
    chip.addEventListener('click', () => {
      dispatch('settings.accentColor', chip.dataset.color);
    });
  });

  // Init
  const initColor = getStateValue('settings.accentColor');
  chips.forEach(chip => {
    if (chip.dataset.color === initColor) chip.classList.add('is-active');
  });
}
