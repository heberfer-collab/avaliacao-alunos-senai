const fs = require('fs');
const path = require('path');

let defaultUsers = [
  { id: '1', name: 'Heber Roberto Ferreira', cpf: '1080133', role: 'TEACHER', created_at: new Date().toISOString() },
  { id: '2', name: 'Rafael Forti Scalfi', cpf: '222.222.222-22', role: 'TEACHER', created_at: new Date().toISOString() },
  { id: '3', name: 'Coordenador Pedagogico', cpf: '000.000.000-00', role: 'ADMIN', created_at: new Date().toISOString() }
];

let defaultProjetos = [];
let defaultTimesheets = [];
let defaultAppState = {};

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const url = req.url || '/';

  const getBody = () => {
    return new Promise((resolve) => {
      if (req.body) return resolve(req.body);
      let body = '';
      req.on('data', chunk => { body += chunk; });
      req.on('end', () => {
        try { resolve(JSON.parse(body || '{}')); }
        catch (e) { resolve({}); }
      });
    });
  };

  try {
    if (url.startsWith('/api/users')) {
      if (req.method === 'GET') {
        return res.status(200).json(defaultUsers);
      }

      if (req.method === 'POST') {
        const body = await getBody();
        const novoId = body.id || String(Date.now());
        const novoUser = {
          id: String(novoId),
          name: body.name || 'Sem Nome',
          cpf: body.cpf || body.nif || '000.000.000-00',
          role: body.role || 'TEACHER',
          created_at: new Date().toISOString()
        };
        const existingIdx = defaultUsers.findIndex(u => (u.cpf || '').replace(/\D/g, '') === novoUser.cpf.replace(/\D/g, ''));
        if (existingIdx >= 0) {
          defaultUsers[existingIdx] = novoUser;
        } else {
          defaultUsers.push(novoUser);
        }
        return res.status(201).json(novoUser);
      }

      if (req.method === 'DELETE') {
        const idToDelete = url.replace('/api/users/', '').split('?')[0];
        defaultUsers = defaultUsers.filter(u => String(u.id) !== String(idToDelete));
        return res.status(200).json({ success: true });
      }
    }

    if (url.startsWith('/api/projetos')) {
      if (req.method === 'GET') {
        return res.status(200).json(defaultProjetos);
      }
      if (req.method === 'POST') {
        const body = await getBody();
        const novoProj = { ...body, id: body.id || String(Date.now()) };
        defaultProjetos.push(novoProj);
        return res.status(201).json(novoProj);
      }
    }

    if (url.startsWith('/api/timesheet')) {
      if (req.method === 'GET') {
        return res.status(200).json(defaultTimesheets);
      }
      if (req.method === 'POST') {
        const body = await getBody();
        const novoTs = { ...body, id: body.id || String(Date.now()) };
        defaultTimesheets.push(novoTs);
        return res.status(201).json(novoTs);
      }
    }

    if (url.startsWith('/api/app-state')) {
      if (req.method === 'GET') {
        return res.status(200).json(defaultAppState);
      }
      if (req.method === 'POST') {
        const body = await getBody();
        if (body.key) {
          defaultAppState[body.key] = body.value;
        }
        return res.status(200).json({ success: true });
      }
    }

    return res.status(200).json({ status: "API SENAI Online", env: "Vercel Serverless" });

  } catch (error) {
    console.error("Vercel Serverless Function Error:", error);
    return res.status(500).json({ error: error.message });
  }
};