/**
 * ============================================================
 * IndraChat — api/adapters/ollama.js
 * Adaptateur Natif Ollama
 *
 * Gère la communication avec l'API native d'Ollama (/api/tags, /api/chat).
 * Gère la spécificité du format NDJSON stream de l'API Ollama.
 *
 * Exports : fetchModels, chatCompletion
 * ============================================================
 */

/**
 * Récupère les modèles locaux via /api/tags.
 * @param {Object} config 
 * @returns {Promise<Array>} Liste formatée
 */
export async function fetchModels(config) {
  const url = `${config.baseUrl}${config.provider.modelsPath}`;
  
  const response = await fetch(url, {
    headers: { 'Content-Type': 'application/json' }
  });
  
  if (!response.ok) {
    throw new Error(`Ollama indisponible (${response.status}) - Le serveur tourne-t-il sur ${config.baseUrl}?`);
  }

  const data = await response.json();
  
  if (!data.models || !Array.isArray(data.models)) {
    return [];
  }

  return data.models.map(model => ({
    id: model.name,
    name: model.name.replace(':latest', '') // Nettoyage esthétique
  }));
}

/**
 * Envoie une requête de chat /api/chat.
 * Gère le format JSON par ligne (NDJSON) spécifique à Ollama en mode streaming.
 */
export async function chatCompletion(messages, config, callbacks, signal) {
  const url = `${config.baseUrl}${config.provider.chatPath}`;
  
  // Formatage du body spécifique à Ollama
  // Ollama gère les advanced parameters dans un objet "options"
  const options = {
    temperature: config.temperature,
    top_p: config.top_p,
    top_k: config.top_k,
  };
  
  // N'envoyer le seed que s'il est volontairement défini pour ne pas bloquer le RNG natif
  if (config.seed > -1) options.seed = config.seed;
  if (config.max_tokens < 8192) options.num_predict = config.max_tokens;

  const body = {
    model: config.model,
    messages: messages,
    stream: config.stream,
    options: options
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal
  });

  if (!response.ok) {
    let errorMsg = `Ollama Erreur: ${response.status}`;
    try {
      const errJson = await response.json();
      errorMsg = errJson.error || errorMsg;
    } catch { /* parse error fallback */ }
    throw new Error(errorMsg);
  }

  if (!config.stream) {
    // Mode classique (non stream)
    const data = await response.json();
    const text = data.message?.content || '';
    if (callbacks.onChunk) callbacks.onChunk(text);
    if (callbacks.onDone) callbacks.onDone();
    return;
  }

  // Mode Streaming (NDJSON = Newline Delimited JSON)
  const reader = response.body.getReader();
  const decoder = new TextDecoder('utf-8');
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      
      // On garde la dernière ligne potentiellement incomplète dans le buffer
      buffer = lines.pop();

      for (const line of lines) {
        if (!line.trim()) continue;
        
        try {
          const parsed = JSON.parse(line);
          const content = parsed.message?.content;
          
          if (content && callbacks.onChunk) {
            callbacks.onChunk(content);
          }
          
          if (parsed.done) {
            // L'API Ollama envoie 'done: true' à la fin avec des métadonnées (eval_count, etc.)
            // On pourrait logguer les métadonnées ici si désiré
            break; 
          }
        } catch (e) {
          console.warn('[Ollama Adapter] JSON Parse error chunk:', line);
        }
      }
    }
    
    // Au cas où le dernier objet arriverait sans saut de ligne final
    if (buffer.trim()) {
      try {
        const parsed = JSON.parse(buffer.trim());
        if (parsed.message?.content && callbacks.onChunk) {
          callbacks.onChunk(parsed.message.content);
        }
      } catch { /* ignore */ }
    }

    if (callbacks.onDone) callbacks.onDone();
    
  } catch (err) {
    if (err.name === 'AbortError') throw err; // Laisser remonter
    console.error('[Ollama Adapter] Stream error:', err);
    throw err;
  }
}
