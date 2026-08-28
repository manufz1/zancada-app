// api/chat.js — función serverless de Vercel.
module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: { message: 'Method Not Allowed' } });
    return;
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: { message: 'Falta configurar GEMINI_API_KEY en las variables de entorno de Vercel.' } });
    return;
  }

  try {
    const { system, tools, messages } = req.body || {};

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

    for (let attempt = 0; attempt <= delays.length; attempt++) {
      const geminiRes = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body
      });
      data = await geminiRes.json();

      const isQuotaError = data.error && (data.error.code === 429 || /quota|RESOURCE_EXHAUSTED/i.test(data.error.status || data.error.message || ''));
      if (!isQuotaError) break;

      lastError = data.error;
      if (attempt < delays.length) await sleep(delays[attempt]);
    }

    if (data.error) {
      const isQuotaError = /quota|RESOURCE_EXHAUSTED/i.test((lastError || data.error).status || (lastError || data.error).message || '');
      const friendlyMessage = isQuotaError
        ? 'El coach está muy solicitado ahora mismo (varias personas escribiendo a la vez). Probá de nuevo en un minuto.'
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
