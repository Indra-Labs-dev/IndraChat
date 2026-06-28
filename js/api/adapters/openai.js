/**
 * ============================================================
 * IndraChat — api/adapters/openai.js
 * Adaptateur Compatible OpenAI
 *
 * Gère la communication avec l'API standardisée d'OpenAI.
 * Cet adaptateur est réutilisé pour d'autres serveurs compatibles
 * (LM Studio, vLLM, OpenRouter, etc.).
 *
 * Exports : fetchModels, chatCompletion
 * ============================================================
 */

/**
 * Récupère les modèles disponibles via l'endpoint /v1/models.
 * @param {Object} config 
 * @returns {Promise<Array>} Liste formatée
 */
export async function fetchModels(config) {
  const url = `${config.baseUrl}${config.provider.modelsPath}`;
  const headers = {
    'Content-Type': 'application/json'
  };
  
  if (config.apiKey) {
    headers['Authorization'] = `Bearer ${config.apiKey}`;
  }
  
  // Specific header for OpenRouter
  if (config.provider.id === 'openrouter') {
    headers['HTTP-Referer'] = window.location.origin;
    headers['X-Title'] = 'IndraChat';
  }

  const response = await fetch(url, { headers });
  
  if (!response.ok) {
    throw new Error(`Erreur API (${response.status}): ${response.statusText}`);
  }

  const data = await response.json();
  
  if (!data.data || !Array.isArray(data.data)) {
    return [];
  }

  // Filtrer et formater
  return data.data.map(model => ({
    id: model.id,
    name: model.id // La plupart des providers OpenAI-like n'ont pas de "friendly name"
  }));
}

/**
 * Envoie une requête de chat /v1/chat/completions.
 * Gère le streaming SSE de manière robuste via la spécification Server-Sent Events.
 */
export async function chatCompletion(messages, config, callbacks, signal) {
  const url = `${config.baseUrl}${config.provider.chatPath}`;
  
  const headers = {
    'Content-Type': 'application/json'
  };
  if (config.apiKey) headers['Authorization'] = `Bearer ${config.apiKey}`;
  if (config.provider.id === 'openrouter') {
    headers['HTTP-Referer'] = window.location.origin;
    headers['X-Title'] = 'IndraChat';
  }

  // Formatage du body
  const body = {
    model: config.model,
    messages: messages,
    temperature: config.temperature,
    top_p: config.top_p,
    stream: config.stream
  };

  // Ignorer max_tokens et autres options avancées si elles sont aux valeurs par défaut
  if (config.max_tokens < 8192) body.max_tokens = config.max_tokens;
  
  // OpenRouter ou providers spécifiques peuvent casser avec des paramètres inattendus (ex: top_k)
  if (config.provider.id !== 'openrouter' && config.top_k !== 40) {
    // OpenAI natif n'utilise pas officiellement top_k, mais LM Studio oui.
    // On le laisse passer de manière prudente.
    body.top_k = config.top_k;
  }

  if (config.seed > -1) {
    body.seed = config.seed;
  }

  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
    signal
  });

  if (!response.ok) {
    let errorMsg = `Erreur HTTP: ${response.status}`;
    try {
      const errJson = await response.json();
      errorMsg = errJson.error?.message || errJson.message || errorMsg;
    } catch { /* parse error fallback */ }
    throw new Error(errorMsg);
  }

  if (!config.stream) {
    // Mode classique (non stream)
    const data = await response.json();
    const text = data.choices[0]?.message?.content || '';
    if (callbacks.onChunk) callbacks.onChunk(text);
    if (callbacks.onDone) callbacks.onDone();
    return;
  }

  // Mode Streaming (Server-Sent Events)
  const reader = response.body.getReader();
  const decoder = new TextDecoder('utf-8');
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      
      // On garde la dernière ligne incomplète dans le buffer
      buffer = lines.pop();

      for (const line of lines) {
        const trimmedLine = line.trim();
        
        // Ignorer les lignes vides ou de heartbeat
        if (!trimmedLine || trimmedLine === 'data: [DONE]') continue;
        
        if (trimmedLine.startsWith('data: ')) {
          const dataStr = trimmedLine.slice(6);
          try {
            const parsed = JSON.parse(dataStr);
            const content = parsed.choices[0]?.delta?.content;
            if (content && callbacks.onChunk) {
              callbacks.onChunk(content);
            }
          } catch (e) {
            console.warn('[OpenAI Adapter] JSON Parse error chunk:', dataStr);
          }
        }
      }
    }
    
    // Vider le reste du buffer si applicable
    if (buffer.trim() && buffer.trim().startsWith('data: ') && buffer.trim() !== 'data: [DONE]') {
        try {
            const parsed = JSON.parse(buffer.trim().slice(6));
            const content = parsed.choices[0]?.delta?.content;
            if (content && callbacks.onChunk) callbacks.onChunk(content);
        } catch { /* ignore */ }
    }

    if (callbacks.onDone) callbacks.onDone();
    
  } catch (err) {
    // Si l'utilisateur a cliqué sur Stop, reader.read() va throw un AbortError
    if (err.name === 'AbortError') throw err; // Laisser l'orchestrateur s'en charger
    console.error('[OpenAI Adapter] Stream error:', err);
    throw err;
  }
}
