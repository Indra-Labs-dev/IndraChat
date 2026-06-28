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

export function initTopbar() {
  // 1. Abonnement aux changements (Provider ou URL/Clé) -> recharger les modèles
  subscribe('settings.provider', async (newProvider) => {
    dispatch('ai.activeProviderId', newProvider);
    updateProviderUI(newProvider);
    await reloadModelsList();
  });

  // On recharge aussi si l'URL ou la clé API change (car ça débloque l'accès)
  subscribe('settings.apiUrl', reloadModelsList);
  subscribe('settings.apiKey', reloadModelsList);

  // 2. Recherche dans le dropdown des modèles
  const searchInput = document.getElementById('model-search-input');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      renderModelsDropdown(e.target.value.trim().toLowerCase());
    });
  }

  // 3. Initialisation Visuelle
  const initProvider = getStateValue('ai.activeProviderId');
  updateProviderUI(initProvider);
  
  // 4. Premier chargement
  reloadModelsList().catch(() => {
    // Échec silencieux au démarrage, l'utilisateur le verra en ouvrant le dropdown
  });
}

/**
 * Met à jour le logo et le nom du provider dans le bouton central.
 */
function updateProviderUI(providerId) {
  const provider = PROVIDERS_MAP.get(providerId);
  if (!provider) return;

  const btnIcon = document.getElementById('active-provider-icon');
  const btnName = document.getElementById('active-provider-name');

  if (btnIcon) btnIcon.textContent = provider.icon;
  if (btnName) btnName.textContent = provider.name;
}

/**
 * Met à jour le nom du modèle sélectionné dans le bouton.
 */
function updateModelUI(modelId) {
  const modelNameEl = document.getElementById('active-model-name');
  if (modelNameEl) {
    modelNameEl.textContent = modelId || 'Sélectionner un modèle';
  }
}

/**
 * Charge la liste des modèles depuis l'API et met à jour le DOM.
 */
async function reloadModelsList() {
  const providerId = getStateValue('ai.activeProviderId');
  const provider = PROVIDERS_MAP.get(providerId);
  const container = document.getElementById('model-list-container');
  
  if (!container) return;

  // Afficher un loader
  container.innerHTML = `
    <div style="padding: var(--space-4); text-align: center; color: var(--color-text-muted);">
      Chargement des modèles...
    </div>
  `;

  try {
    const models = await fetchModels();
    availableModelsCache = models;
    dispatch('ai.availableModels', models);

    // Vérifier si le modèle actif (sauvegardé) existe dans cette nouvelle liste
    let activeModel = getStateValue('settings.model');
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
      <div style="padding: var(--space-4); text-align: center; color: var(--primitive-red-500); font-size: var(--text-sm);">
        Impossible de charger les modèles.<br>
        <span style="font-size: 11px; opacity: 0.8;">Vérifiez l'URL, la clé API ou que le serveur local tourne.</span>
      </div>
    `;
    updateModelUI('Erreur de connexion');
  }
}

/**
 * Filtre et génère le HTML pour les items du menu déroulant.
 */
function renderModelsDropdown(searchQuery) {
  const container = document.getElementById('model-list-container');
  if (!container) return;

  const filtered = searchQuery 
    ? availableModelsCache.filter(m => m.id.toLowerCase().includes(searchQuery) || (m.name && m.name.toLowerCase().includes(searchQuery)))
    : availableModelsCache;

  if (filtered.length === 0) {
    container.innerHTML = `
      <div style="padding: var(--space-4); text-align: center; color: var(--color-text-muted); font-size: var(--text-sm);">
        Aucun modèle trouvé.
      </div>
    `;
    return;
  }

  const activeModelId = getStateValue('ai.activeModelId');
  let html = '';

  for (const model of filtered) {
    const isActive = model.id === activeModelId ? 'is-active' : '';
    
    html += `
      <div class="dropdown-item ${isActive}" data-id="${model.id}">
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
      document.getElementById('model-dropdown')?.classList.add('hidden');
      document.getElementById('btn-model-selector')?.classList.remove('is-open');
    });
  });
}
