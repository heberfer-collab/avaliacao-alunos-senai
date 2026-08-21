let projetos = [];

module.exports = (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method === 'GET') {
    return res.status(200).json(projetos);
  }

  if (req.method === 'POST') {
    const body = req.body || {};
    const novo = { ...body, id: body.id || String(Date.now()) };
    projetos.push(novo);
    return res.status(201).json(novo);
  }

  return res.status(200).json(projetos);
};