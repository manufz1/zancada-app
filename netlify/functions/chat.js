exports.handler = async function (event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: { message: 'Falta configurar GEMINI_API_KEY en las variables de entorno de Netlify.' } })
    };
  }

  try {
    const { system, tools, messages } = JSON.parse(event.body || '{}');

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

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: system }] },
        contents,
        tools: functionDeclarations.length ? [{ functionDeclarations }] : undefined
      })
    });
    const data = await res.json();

    if (data.error) {
      return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ error: data.error }) };
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

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content })
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: { message: err.message } })
    };
  }
};
