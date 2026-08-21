let users = [
  { id: '1', name: 'Heber Roberto Ferreira', cpf: '1080133', role: 'TEACHER', created_at: new Date().toISOString() },
  { id: '2', name: 'Rafael Forti Scalfi', cpf: '222.222.222-22', role: 'TEACHER', created_at: new Date().toISOString() },
  { id: '3', name: 'Coordenador Pedagogico', cpf: '000.000.000-00', role: 'ADMIN', created_at: new Date().toISOString() }
];

module.exports = (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method === 'GET') {
    return res.status(200).json(users);
  }

  if (req.method === 'POST') {
    const body = req.body || {};
    const novoUser = {
      id: String(body.id || Date.now()),
      name: body.name || 'Sem Nome',
      cpf: body.cpf || body.nif || '000.000.000-00',
      role: body.role || 'TEACHER',
      created_at: new Date().toISOString()
    };
    const idx = users.findIndex(u => (u.cpf || '').replace(/\D/g, '') === novoUser.cpf.replace(/\D/g, ''));
    if (idx >= 0) users[idx] = novoUser;
    else users.push(novoUser);
    return res.status(201).json(novoUser);
  }

  if (req.method === 'DELETE') {
    const id = req.query ? req.query.id : null;
    if (id) users = users.filter(u => String(u.id) !== String(id));
    return res.status(200).json({ success: true });
  }

  return res.status(200).json(users);
};