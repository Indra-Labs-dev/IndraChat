/**
 * ============================================================
 * IndraChat — topbar.js
 * Gestion de la Barre Supérieure (Sélecteur de modèles)
 *
 * Charge les modèles disponibles via l'API sélectionnée,
 * gère le dropdown, la recherche de modèles et la sélection.
 *
 * Imports : api/index.js, state.js, config.js
 * ============================================================
 */

import { fetchModels } from '../api/index.js';
import { subscribe, dispatch, getStateValue } from '../state.js';
import { PROVIDERS_MAP } from '../config.js';

let availableModelsCache = [];
let isDropdownOpen = false;

export function initTopbar() {
  // 1. Abonnement aux changements (Provider ou URL/Clé) -> recharger les modèles
  subscribe('settings.provider', async (newProvider) => {
    dispatch('ai.activeProviderId', newProvider);
    updateProviderUI(newProvider);
    await reloadModelsList();
  });

  // On recharge aussi si l'URL ou la clé API change (car ça débloque l'accès)
  subscribe('settings.apiUrl', () => reloadModelsList());
  subscribe('settings.apiKey', () => reloadModelsList());

  // 2. Recherche dans le dropdown des modèles
  const searchInput = document.getElementById('model-search-input');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      renderModelsDropdown(e.target.value.trim().toLowerCase());
    });
  }

  // 3. Initialisation Visuelle
  const initProvider = getStateValue('ai.activeProviderId') || getStateValue('settings.provider') || 'ollama';
  updateProviderUI(initProvider);

  // 4. Gestion de l'ouverture/fermeture du dropdown (bouton sélecteur de modèle)
  const btnSelector = document.getElementById('btn-model-selector');
  const dropdown = document.querySelector('.model-dropdown');

  if (btnSelector && dropdown) {
    btnSelector.addEventListener('click', (e) => {
      e.stopPropagation();
      isDropdownOpen = !isDropdownOpen;
      dropdown.classList.toggle('hidden', !isDropdownOpen);
      btnSelector.classList.toggle('is-open', isDropdownOpen);
      if (isDropdownOpen) {
        document.getElementById('model-search-input')?.focus();
      }
    });
  }

  // Bouton Actualiser
  document.getElementById('btn-refresh-models')?.addEventListener('click', () => reloadModelsList());

  // 5. Premier chargement (silencieux si le serveur est absent)
  reloadModelsList().catch(() => {});
}

/**
 * Ferme le dropdown de modèles.
 * Appelé depuis app.js lors d'un clic en dehors.
 */
export function closeModelDropdown() {
  isDropdownOpen = false;
  document.querySelector('.model-dropdown')?.classList.add('hidden');
  document.getElementById('btn-model-selector')?.classList.remove('is-open');
}

/**
 * Met à jour l'affichage du provider actif dans le bouton du sélecteur.
 * L'HTML utilise : #current-provider-name et #provider-status-dot
 */
function updateProviderUI(providerId) {
  const provider = PROVIDERS_MAP.get(providerId);
  if (!provider) return;

  // Mise à jour du nom affiché
  const nameEl = document.getElementById('current-provider-name');
  if (nameEl) nameEl.textContent = provider.name;
}

/**
 * Met à jour le nom du modèle sélectionné dans le bouton.
 * L'HTML utilise : #current-model-name
 */
function updateModelUI(modelId) {
  const modelNameEl = document.getElementById('current-model-name');
  if (modelNameEl) {
    modelNameEl.textContent = modelId || 'Sélectionner un modèle';
  }

  // Mettre à jour aussi le point de statut (vert = connecté)
  const statusDot = document.getElementById('provider-status-dot');
  if (statusDot) {
    if (modelId && modelId !== 'Erreur de connexion') {
      statusDot.className = 'provider-dot provider-dot--online';
    } else {
      statusDot.className = 'provider-dot provider-dot--offline';
    }
  }
}

/**
 * Charge la liste des modèles depuis l'API et met à jour le DOM.
 */
async function reloadModelsList() {
  const container = document.getElementById('models-list');
  if (!container) return;

  // Afficher un loader
  container.innerHTML = `
    <div class="models-list__loading">
      <div class="spinner anim-spin" aria-hidden="true"></div>
      <span>Chargement des modèles...</span>
    </div>
  `;

  try {
    const models = await fetchModels();
    availableModelsCache = models;
    dispatch('ai.availableModels', models);

    // Vérifier si le modèle actif (sauvegardé) existe dans cette nouvelle liste
    let activeModel = getStateValue('settings.model') || '';
    const modelExists = models.some(m => m.id === activeModel);

    if (!modelExists && models.length > 0) {
      // Si le modèle n'existe pas ou qu'on vient de changer de provider,
      // on prend le premier de la liste par défaut
      activeModel = models[0].id;
      dispatch('settings.model', activeModel);
    }

    dispatch('ai.activeModelId', activeModel);
    updateModelUI(activeModel);

    // Rendu de la liste
    renderModelsDropdown('');

  } catch (error) {
    console.error('[Topbar] Impossible de charger les modèles:', error);
    container.innerHTML = `
      <div style="padding: var(--space-4); text-align: center; color: #ef4444; font-size: var(--text-sm);">
        Impossible de charger les modèles.<br>
        <span style="font-size: 11px; opacity: 0.8;">Vérifiez l'URL, la clé API ou que le serveur local tourne.</span>
      </div>
    `;
    updateModelUI('');
  }
}

/**
 * Filtre et génère le HTML pour les items du menu déroulant.
 */
function renderModelsDropdown(searchQuery) {
  const container = document.getElementById('models-list');
  if (!container) return;

  const filtered = searchQuery
    ? availableModelsCache.filter(m =>
        m.id.toLowerCase().includes(searchQuery) ||
        (m.name && m.name.toLowerCase().includes(searchQuery))
      )
    : availableModelsCache;

  if (filtered.length === 0) {
    container.innerHTML = `
      <div style="padding: var(--space-4); text-align: center; color: var(--color-text-muted); font-size: var(--text-sm);">
        ${searchQuery ? 'Aucun résultat.' : 'Aucun modèle trouvé.'}
      </div>
    `;
    return;
  }

  const activeModelId = getStateValue('ai.activeModelId');
  let html = '';

  for (const model of filtered) {
    const isActive = model.id === activeModelId;
    const isActiveClass = isActive ? 'is-active' : '';

    html += `
      <div class="dropdown-item ${isActiveClass}" data-id="${model.id}">
        <div class="dropdown-item__icon">
          ${isActive ? `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>` : ''}
        </div>
        <div class="dropdown-item__content">
          <div class="dropdown-item__title">${model.name || model.id}</div>
          ${model.name && model.name !== model.id ? `<div class="dropdown-item__desc">${model.id}</div>` : ''}
        </div>
      </div>
    `;
  }

  container.innerHTML = html;

  // Attacher les événements de clic
  container.querySelectorAll('.dropdown-item').forEach(item => {
    item.addEventListener('click', () => {
      const selectedId = item.getAttribute('data-id');

      // Update state (qui trigger la sauvegarde locale automatiquement)
      dispatch('settings.model', selectedId);
      dispatch('ai.activeModelId', selectedId);
      updateModelUI(selectedId);

      // Fermer le dropdown
      closeModelDropdown();
    });
  });
}
