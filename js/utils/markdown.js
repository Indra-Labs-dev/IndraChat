/**
 * ============================================================
 * IndraChat — markdown.js
 * Parseur et Moteur de Rendu Markdown Sécurisé
 *
 * Combine les bibliothèques :
 * - marked.js : pour le parsing Markdown vers HTML
 * - DOMPurify : pour nettoyer le HTML et éviter les failles XSS
 * - Highlight.js : pour la coloration syntaxique des blocs de code
 * - KaTeX : pour le rendu des mathématiques (LaTeX)
 * - Mermaid.js : pour les diagrammes (optionnel)
 *
 * Imports : getStateValue
 * Exports : renderMarkdown
 * ============================================================
 */

import { getStateValue } from '../state.js';

/**
 * Indique si le renderer Marked a déjà été configuré.
 * FIX: Les scripts CDN sont chargés avec 'defer', donc ils ne sont pas disponibles
 * lors de l'évaluation du module. On utilise une initialisation paresseuse (lazy).
 */
let markedInitialized = false;

/**
 * Configure Marked.js et son renderer personnalisé.
 * Appelé lors du premier rendu (lazy init).
 */
function initMarked() {
  if (markedInitialized || typeof marked === 'undefined') return;
  markedInitialized = true;

  marked.setOptions({
    gfm: true,
    breaks: true, // Les sauts de ligne simples créent des <br>
  });

  // Custom renderer pour structurer nos blocs de code avec header + bouton copie
  const renderer = new marked.Renderer();

  renderer.code = function({ text, lang, escaped }) {
    // Si c'est du math (block)
    if (lang === 'math' || lang === 'latex') {
      return renderMath(text, true);
    }

    // Si c'est un diagramme Mermaid
    if (lang === 'mermaid' && getStateValue('settings.renderMermaid')) {
      return `<div class="mermaid-block"><pre class="mermaid">${escapeHtml(text)}</pre></div>`;
    }

    const language = (lang || 'text').toLowerCase();

    // Highlight syntax
    let highlightedCode = escapeHtml(text);
    if (typeof hljs !== 'undefined' && getStateValue('settings.codeHighlighting')) {
      const validLang = hljs.getLanguage(language) ? language : 'plaintext';
      try {
        highlightedCode = hljs.highlight(text, { language: validLang }).value;
      } catch (e) {
        highlightedCode = escapeHtml(text);
      }
    }

    return `
      <div class="code-block">
        <div class="code-block__header">
          <span class="code-block__lang">${language}</span>
          <button class="code-block__copy-btn" data-action="copy-code" aria-label="Copier le code">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
            <span>Copier</span>
          </button>
        </div>
        <pre><code class="hljs language-${language}">${highlightedCode}</code></pre>
      </div>
    `;
  };

  // Traitement inline pour les maths $ ... $
  const originalCodespan = renderer.codespan.bind(renderer);
  renderer.codespan = function({ text }) {
    if (text.startsWith('$') && text.endsWith('$')) {
      const math = text.slice(1, -1);
      return renderMath(math, false);
    }
    return originalCodespan({ text });
  };

  marked.use({ renderer });
}

/**
 * Configure DOMPurify pour autoriser les classes générées par Highlight.js,
 * KaTeX et notre propre structure (code-block, etc.).
 */
function purifyHTML(dirtyHtml) {
  if (typeof DOMPurify === 'undefined') return dirtyHtml; // Fallback dangeureux mais nécessaire si CDN mort
  
  return DOMPurify.sanitize(dirtyHtml, {
    ALLOWED_TAGS: [
      'h1','h2','h3','h4','h5','h6','blockquote','p','a','ul','ol',
      'nl','li','b','i','strong','em','strike','code','hr','br','div',
      'table','thead','caption','tbody','tr','th','td','pre','img',
      'span','button','svg','rect','path','circle','line','polyline','polygon' // SVG autorisé pour les icônes
    ],
    ALLOWED_ATTR: [
      'href','name','target','class','id','src','alt','title',
      'data-action','aria-label','viewBox','fill','stroke','stroke-width',
      'stroke-linecap','stroke-linejoin','x','y','width','height','rx','ry',
      'cx','cy','r','x1','y1','x2','y2','points','d'
    ],
    // Configuration spécifique pour autoriser KaTeX (classes commençant par katex-)
    // et Highlight.js (classes hljs-)
    FORBID_TAGS: ['script', 'style', 'iframe', 'object', 'embed'],
    FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover']
  });
}

/**
 * Rend du LaTeX via KaTeX.
 * @param {string} text - Le code LaTeX
 * @param {boolean} displayMode - true pour un bloc, false pour inline
 */
function renderMath(text, displayMode) {
  if (typeof katex !== 'undefined' && getStateValue('settings.renderLatex')) {
    try {
      return katex.renderToString(text, {
        displayMode: displayMode,
        throwOnError: false,
        output: 'html' // Ne pas générer MathML pour éviter les conflits DOMPurify
      });
    } catch (e) {
      console.error('[KaTeX] Erreur de rendu:', e);
      return `<span class="math-error">${escapeHtml(text)}</span>`;
    }
  }
  // Fallback brut
  return `<code class="math-raw">${escapeHtml(text)}</code>`;
}

/**
 * Fonction principale : convertit du Markdown en HTML propre et stylisé.
 *
 * @param {string} markdownText - Le texte brut de l'IA
 * @returns {string} Le HTML sécurisé prêt à être injecté
 */
export function renderMarkdown(markdownText) {
  if (!markdownText) return '';

  // Initialisation paresseuse de Marked (les CDN scripts sont defer)
  initMarked();

  // Si le rendu MD est désactivé dans les settings
  if (!getStateValue('settings.renderMarkdown')) {
    return `<div class="prose whitespace-pre-wrap">${escapeHtml(markdownText)}</div>`;
  }

  // 1. Prétraitement personnalisé
  // On gère les blocs LaTeX \[ ... \] et inline \( ... \) qui sont courants
  let processedText = markdownText
    .replace(/\\\[([\s\S]*?)\\\]/g, '```math\n$1\n```')
    .replace(/\\\((.*?)\\\)/g, '`$$1$`');

  // 2. Parsing Markdown -> HTML
  let rawHtml = '';
  if (typeof marked !== 'undefined') {
    rawHtml = marked.parse(processedText);
  } else {
    // Fallback basique si marked n'est pas encore chargé
    rawHtml = `<p>${escapeHtml(processedText)}</p>`;
  }

  // 3. Nettoyage anti-XSS
  const cleanHtml = purifyHTML(rawHtml);

  return `<div class="prose">${cleanHtml}</div>`;
}

/**
 * Echappe manuellement les entités (utilisé en interne par le renderer custom).
 */
function escapeHtml(text) {
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return String(text).replace(/[&<>"']/g, function(m) { return map[m]; });
}

/**
 * Déclenche le rendu Mermaid sur le DOM après injection.
 * À appeler côté UI après avoir inséré le HTML généré.
 */
export async function renderMermaidDiagrams() {
  if (typeof mermaid === 'undefined' || !getStateValue('settings.renderMermaid')) return;
  
  try {
    mermaid.initialize({
      startOnLoad: false,
      theme: getStateValue('settings.theme') === 'dark' ? 'dark' : 'default',
      securityLevel: 'loose', // On a déjà purifié
    });
    
    await mermaid.run({
      querySelector: '.mermaid'
    });
  } catch (err) {
    console.error('[Mermaid] Erreur de rendu:', err);
  }
}
