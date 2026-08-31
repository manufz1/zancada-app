// api/chat.js — función serverless de Vercel.
const verifyUser = require('./_lib/verify-user');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: { message: 'Method Not Allowed' } });
    return;
  }

  // Verificamos que quien llama esté realmente logueado en la app, antes de
  // gastar la cuota de Gemini en el pedido. Sin esto, cualquiera en internet
  // podía pegarle directo a esta URL (sin pasar por la app ni tener cuenta)
  // con su propio "system" y "messages", y la respuesta la pagábamos
  // nosotros — un uso gratis e ilimitado de la API a costa nuestra.
  const auth = await verifyUser(req);
  if (!auth.ok) {
    res.status(auth.status).json({ error: { message: auth.error } });
    return;
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: { message: 'Falta configurar GEMINI_API_KEY en las variables de entorno de Vercel.' } });
    return;
  }

  try {
    const { system, tools, messages, lang } = req.body || {};

    const BUSY_MSG = {
      es: 'El coach está muy solicitado ahora mismo. Probá de nuevo en un minuto.',
      en: 'The coach is very busy right now. Try again in a minute.',
      pt: 'O coach está muito solicitado agora. Tente de novo em um minuto.',
      fr: 'Le coach est très sollicité en ce moment. Réessaie dans une minute.',
      it: 'Il coach è molto richiesto in questo momento. Riprova tra un minuto.',
      de: 'Der Coach ist gerade sehr gefragt. Versuch es in einer Minute noch mal.'
    };
    const busyMessage = BUSY_MSG[lang] || BUSY_MSG.es;

    const idToName = {};
    (messages || []).forEach(m => {
      if (Array.isArray(m.content)) {
        m.content.forEach(b => { if (b.type === 'tool_use') idToName[b.id] = b.name; });
      }
    });

    const contents = (messages || []).map(m => {
      const role = m.role === 'assistant' ? 'model' : 'user';
      if (typeof m.content === 'string') return { role, parts: [{ text: m.content }] };
      const parts = (m.content || []).map(b => {
        if (b.type === 'text') {
          const part = { text: b.text };
          if (b._ts) part.thoughtSignature = b._ts;
          return part;
        }
        if (b.type === 'tool_use') {
          const part = { functionCall: { name: b.name, args: b.input || {} } };
          if (b._ts) part.thoughtSignature = b._ts;
          return part;
        }
        if (b.type === 'tool_result') {
          const name = idToName[b.tool_use_id] || 'resultado';
          return { functionResponse: { name, response: { content: String(b.content) } } };
        }
        return { text: '' };
      });
      return { role, parts };
    });

    const functionDeclarations = (tools || []).map(t => ({
      name: t.name,
      description: t.description,
      parameters: t.input_schema
    }));

    const model = 'gemini-3.6-flash';
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
    const body = JSON.stringify({
      system_instruction: { parts: [{ text: system }] },
      contents,
      tools: functionDeclarations.length ? [{ functionDeclarations }] : undefined
    });

    const sleep = (ms) => new Promise(r => setTimeout(r, ms));
    let data, lastError;
    const delays = [4000, 8000]; // reintenta a los 4s y a los 8s si está saturado

    const isRetryable = (err) => {
      if (!err) return false;
      const text = `${err.status || ''} ${err.message || ''}`;
      return err.code === 429 || err.code === 503 || /quota|RESOURCE_EXHAUSTED|UNAVAILABLE|overloaded|high demand/i.test(text);
    };

    for (let attempt = 0; attempt <= delays.length; attempt++) {
      const geminiRes = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body
      });
      data = await geminiRes.json();

      if (!isRetryable(data.error)) break;

      lastError = data.error;
      if (attempt < delays.length) await sleep(delays[attempt]);
    }

    if (data.error) {
      const friendlyMessage = isRetryable(lastError || data.error)
        ? busyMessage
        : data.error.message;
      res.status(200).json({ error: { message: friendlyMessage } });
      return;
    }

    const parts = (data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts) || [];
    let fcCounter = 0;
    const content = parts.map(p => {
      if (p.functionCall) {
        fcCounter++;
        const block = { type: 'tool_use', id: 'call_' + Date.now() + '_' + fcCounter, name: p.functionCall.name, input: p.functionCall.args || {} };
        if (p.thoughtSignature) block._ts = p.thoughtSignature;
        return block;
      }
      if (p.text) {
        const block = { type: 'text', text: p.text };
        if (p.thoughtSignature) block._ts = p.thoughtSignature;
        return block;
      }
      return null;
    }).filter(Boolean);

    res.status(200).json({ content });
  } catch (err) {
    res.status(500).json({ error: { message: err.message } });
  }
};
