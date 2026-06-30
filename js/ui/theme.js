/**
 * ============================================================
 * IndraChat — theme.js
 * Gestion de l'Apparence (Dark/Light + Couleurs d'Accent)
 *
 * Ce module s'abonne aux changements d'état (state.js)
 * pour appliquer dynamiquement les classes et variables CSS
 * au document racine (<html>).
 *
 * Imports : state (subscribe, dispatch, getStateValue)
 * Exports : initTheme
 * ============================================================
 */

import { subscribe, dispatch, getStateValue } from '../state.js';

/**
 * Initialise le gestionnaire de thème.
 * Doit être appelé lors du démarrage complet de l'application.
 */
export function initTheme() {
  const currentTheme = getStateValue('settings.theme');
  const currentAccent = getStateValue('settings.accentColor');

  // Appliquer les paramètres initiaux (déjà partiellement faits par app.js
  // de manière asynchrone, mais ici on le refait "proprement" avec le State résolu)
  applyTheme(currentTheme);
  applyAccent(currentAccent);

  // S'abonner aux changements de paramètres
  subscribe('settings.theme', (newTheme) => {
    applyTheme(newTheme);
  });

  subscribe('settings.accentColor', (newAccent) => {
    applyAccent(newAccent);
  });

  // Écouter les changements système (prefers-color-scheme)
  // uniquement si le paramètre est réglé sur 'system'
  const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
  mediaQuery.addEventListener('change', (e) => {
    const activeTheme = getStateValue('settings.theme');
    if (activeTheme === 'system') {
      applyTheme('system', e.matches);
    }
  });

  console.log('[UI] Thème initialisé');
}

/**
 * Applique le thème (light/dark) au document.
 * Ajoute temporairement une classe de transition pour éviter les coupures brutes.
 *
 * @param {string} theme - 'light', 'dark', ou 'system'
 * @param {boolean} [systemIsDark] - Optionnel, force l'évaluation système
 */
function applyTheme(theme, systemIsDark) {
  const html = document.documentElement;

  // Calcul du thème réel
  let resolvedTheme = theme;
  if (theme === 'system') {
    resolvedTheme = systemIsDark !== undefined
      ? (systemIsDark ? 'dark' : 'light')
      : (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  }

  // Toujours mettre à jour l'icône (état peut diverger si HTML a une valeur par défaut figée)
  updateThemeIcon(resolvedTheme);

  // Si le thème n'a pas changé, on évite l'animation et la mise à jour du DOM
  if (html.getAttribute('data-theme') === resolvedTheme) return;

  // Animation douce
  html.classList.add('theme-transition');

  // Application
  html.setAttribute('data-theme', resolvedTheme);

  // Mise à jour de la couleur de thème mobile pour PWA
  const metaThemeColor = document.querySelector('meta[name="theme-color"]');
  if (metaThemeColor) {
    metaThemeColor.setAttribute('content', resolvedTheme === 'dark' ? '#0a0f1a' : '#f9fafb');
  }

  // Nettoyage de la classe de transition
  setTimeout(() => {
    html.classList.remove('theme-transition');
  }, 500);
}

/**
 * Applique la couleur d'accent au document.
 *
 * @param {string} accent - 'blue', 'violet', 'green', 'orange'
 */
function applyAccent(accent) {
  document.documentElement.setAttribute('data-accent', accent);
}

/**
 * Met à jour l'icône du bouton de la topbar (soleil / lune).
 *
 * @param {string} resolvedTheme - 'dark' ou 'light'
 */
function updateThemeIcon(resolvedTheme) {
  const sunIcon  = document.getElementById('icon-sun');
  const moonIcon = document.getElementById('icon-moon');
  if (!sunIcon || !moonIcon) return;

  if (resolvedTheme === 'dark') {
    sunIcon.classList.add('hidden');
    moonIcon.classList.remove('hidden');
  } else {
    sunIcon.classList.remove('hidden');
    moonIcon.classList.add('hidden');
  }
}
