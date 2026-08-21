let appState = {};

module.exports = (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method === 'GET') {
    return res.status(200).json(appState);
  }

  if (req.method === 'POST') {
    const body = req.body || {};
    if (body.key) appState[body.key] = body.value;
    return res.status(200).json({ success: true });
  }

  return res.status(200).json(appState);
};