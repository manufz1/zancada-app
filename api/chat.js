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
        if (b.type === 'text') return { text: b.text };
        if (b.type === 'tool_use') return { functionCall: { name: b.name, args: b.input || {} } };
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

    const model = 'gemini-2.5-flash';
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    const geminiRes = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: system }] },
        contents,
        tools: functionDeclarations.length ? [{ functionDeclarations }] : undefined
      })
    });
    const data = await geminiRes.json();

    if (data.error) {
      res.status(200).json({ error: data.error });
      return;
    }

    const parts = (data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts) || [];
    let fcCounter = 0;
    const content = parts.map(p => {
      if (p.text) return { type: 'text', text: p.text };
      if (p.functionCall) {
        fcCounter++;
        return { type: 'tool_use', id: 'call_' + Date.now() + '_' + fcCounter, name: p.functionCall.name, input: p.functionCall.args || {} };
      }
      return null;
    }).filter(Boolean);

    res.status(200).json({ content });
  } catch (err) {
    res.status(500).json({ error: { message: err.message } });
  }
};
