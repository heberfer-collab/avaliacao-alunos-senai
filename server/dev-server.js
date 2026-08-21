const http = require('http');
const fs = require('fs');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');

const PORT = 3000;
const DB_PATH = path.join(__dirname, 'database.sqlite');

const MIME_TYPES = {
  '.html': 'text/html; charset=UTF-8',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

// Inicialização do Banco de Dados SQLite Nativo
const os = require('os');
let db = null;
try {
  db = new DatabaseSync(DB_PATH);
  try { db.exec('PRAGMA journal_mode = WAL;'); } catch(e){}
} catch(err) {
  try {
    const tmpPath = path.join(os.tmpdir(), 'database.sqlite');
    if(fs.existsSync(DB_PATH) && !fs.existsSync(tmpPath)) { try { fs.copyFileSync(DB_PATH, tmpPath); } catch(e){} }
    db = new DatabaseSync(tmpPath);
  } catch(e2) {
    try { db = new DatabaseSync(':memory:'); } catch(e3){ db = null; }
  }
}

// Configuração de modo WAL para máxima concorrência e performance
db.exec(`
  PRAGMA journal_mode = WAL;

  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    cpf TEXT UNIQUE NOT NULL,
    role TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS projetos (
    id TEXT PRIMARY KEY,
    titulo TEXT NOT NULL,
    id_uc TEXT,
    id_turma TEXT,
    tipo_formacao TEXT,
    data_inicio TEXT,
    data_fim TEXT,
    descricao TEXT,
    status TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS timesheet (
    id TEXT PRIMARY KEY,
    id_aluno TEXT NOT NULL,
    nome_aluno TEXT NOT NULL,
    id_projeto TEXT NOT NULL,
    nome_projeto TEXT,
    data TEXT NOT NULL,
    hora_inicio TEXT,
    hora_fim TEXT,
    horas_totais TEXT,
    descricao_atividade TEXT,
    link_evidencia TEXT,
    status_entrega TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS app_state (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

// Rotina de Migração de Dados Legados (.json -> SQLite)
function migrateLegacyData() {
  // 1. Migrar Usuários
  const usersFile = path.join(__dirname, 'users_data.json');
  if (fs.existsSync(usersFile)) {
    try {
      const users = JSON.parse(fs.readFileSync(usersFile, 'utf8'));
      const insertUser = db.prepare(`
        INSERT OR IGNORE INTO users (id, name, cpf, role) VALUES (?, ?, ?, ?)
      `);
      users.forEach(u => {
        if (u.id && u.name && u.cpf) {
          insertUser.run(String(u.id), u.name, u.cpf, u.role || 'TEACHER');
        }
      });
    } catch (e) {
      console.error('Erro ao migrar users_data.json:', e);
    }
  }

  // 2. Garantir usuários padrão se tabela estiver vazia
  const countUsers = db.prepare('SELECT COUNT(*) as count FROM users').get();
  if (countUsers.count === 0) {
    const insertUser = db.prepare(`
      INSERT OR IGNORE INTO users (id, name, cpf, role) VALUES (?, ?, ?, ?)
    `);
    insertUser.run('1', 'Heber Roberto Ferreira', '111.111.111-11', 'TEACHER');
    insertUser.run('2', 'Rafael Forti Scalfi', '222.222.222-22', 'TEACHER');
    insertUser.run('3', 'Coordenador Pedagógico', '000.000.000-00', 'ADMIN');
  }

  // 3. Migrar Projetos
  const projFile = path.join(__dirname, 'projetos_data.json');
  if (fs.existsSync(projFile)) {
    try {
      const projetos = JSON.parse(fs.readFileSync(projFile, 'utf8'));
      const insertProj = db.prepare(`
        INSERT OR IGNORE INTO projetos (id, titulo, id_uc, id_turma, tipo_formacao, data_inicio, data_fim, descricao, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      projetos.forEach(p => {
        if (p.id && p.titulo) {
          insertProj.run(String(p.id), p.titulo, p.id_uc || '', p.id_turma || '', p.tipo_formacao || 'Individual', p.data_inicio || '', p.data_fim || '', p.descricao || '', p.status || 'Planejado');
        }
      });
    } catch (e) {
      console.error('Erro ao migrar projetos_data.json:', e);
    }
  }

  // 4. Migrar Timesheets
  const tsFile = path.join(__dirname, 'timesheet_data.json');
  if (fs.existsSync(tsFile)) {
    try {
      const timesheets = JSON.parse(fs.readFileSync(tsFile, 'utf8'));
      const insertTs = db.prepare(`
        INSERT OR IGNORE INTO timesheet (id, id_aluno, nome_aluno, id_projeto, nome_projeto, data, hora_inicio, hora_fim, horas_totais, descricao_atividade, link_evidencia, status_entrega)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      timesheets.forEach(t => {
        if (t.id && t.id_aluno) {
          insertTs.run(String(t.id), String(t.id_aluno), t.nome_aluno || '', String(t.id_projeto || ''), t.nome_projeto || '', t.data || '', t.hora_inicio || '', t.hora_fim || '', t.horas_totais || '', t.descricao_atividade || '', t.link_evidencia || '', t.status_entrega || 'Concluído');
        }
      });
    } catch (e) {
      console.error('Erro ao migrar timesheet_data.json:', e);
    }
  }
}

migrateLegacyData();

// Servidor HTTP
const server = http.createServer((req, res) => {
  // Configuração de CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, DELETE');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // =========================================================================
  // ROTAS DA API RESTful (SQLite)
  // =========================================================================
  if (req.url.startsWith('/api/')) {
    
    // --- API: USUÁRIOS ---
    if (req.url === '/api/users' && req.method === 'GET') {
      try {
        const query = db.prepare('SELECT id, name, cpf, role, created_at FROM users ORDER BY created_at ASC');
        const rows = query.all();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(rows));
      } catch (e) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Erro ao consultar banco SQLite', details: e.message }));
      }
      return;
    }

    if (req.url === '/api/users' && req.method === 'POST') {
      let body = '';
      req.on('data', chunk => body += chunk.toString());
      req.on('end', () => {
        try {
          const user = JSON.parse(body);
          user.id = user.id || Date.now().toString();
          const stmt = db.prepare(`
            INSERT INTO users (id, name, cpf, role)
            VALUES (?, ?, ?, ?)
            ON CONFLICT(cpf) DO UPDATE SET name = excluded.name, role = excluded.role
          `);
          stmt.run(user.id, user.name, user.cpf, user.role || 'TEACHER');
          res.writeHead(201, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(user));
        } catch (e) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Erro ao inserir usuário no SQLite', details: e.message }));
        }
      });
      return;
    }

    if (req.url.startsWith('/api/users/') && req.method === 'DELETE') {
      const id = req.url.split('/')[3];
      try {
        const stmt = db.prepare('DELETE FROM users WHERE id = ?');
        stmt.run(id);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true }));
      } catch (e) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Erro ao remover usuário do SQLite', details: e.message }));
      }
      return;
    }

    // --- API: PROJETOS ---
    if (req.url === '/api/projetos' && req.method === 'GET') {
      try {
        const query = db.prepare('SELECT * FROM projetos ORDER BY created_at ASC');
        const rows = query.all();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(rows));
      } catch (e) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Erro ao consultar projetos', details: e.message }));
      }
      return;
    }

    if (req.url === '/api/projetos' && req.method === 'POST') {
      let body = '';
      req.on('data', chunk => body += chunk.toString());
      req.on('end', () => {
        try {
          const p = JSON.parse(body);
          p.id = p.id || Date.now().toString();
          const stmt = db.prepare(`
            INSERT OR REPLACE INTO projetos (id, titulo, id_uc, id_turma, tipo_formacao, data_inicio, data_fim, descricao, status)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          `);
          stmt.run(p.id, p.titulo, p.id_uc || '', p.id_turma || '', p.tipo_formacao || 'Individual', p.data_inicio || '', p.data_fim || '', p.descricao || '', p.status || 'Em Andamento');
          res.writeHead(201, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(p));
        } catch (e) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Erro ao salvar projeto no SQLite', details: e.message }));
        }
      });
      return;
    }

    if (req.url.startsWith('/api/projetos/') && req.method === 'DELETE') {
      const id = req.url.split('/')[3];
      try {
        const stmt = db.prepare('DELETE FROM projetos WHERE id = ?');
        stmt.run(id);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true }));
      } catch (e) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Erro ao remover projeto', details: e.message }));
      }
      return;
    }

    // --- API: TIMESHEET ---
    if (req.url === '/api/timesheet' && req.method === 'GET') {
      try {
        const query = db.prepare('SELECT * FROM timesheet ORDER BY data DESC, created_at DESC');
        const rows = query.all();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(rows));
      } catch (e) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Erro ao consultar timesheet', details: e.message }));
      }
      return;
    }

    if (req.url === '/api/timesheet' && req.method === 'POST') {
      let body = '';
      req.on('data', chunk => body += chunk.toString());
      req.on('end', () => {
        try {
          const t = JSON.parse(body);
          t.id = t.id || Date.now().toString();
          const stmt = db.prepare(`
            INSERT OR REPLACE INTO timesheet (id, id_aluno, nome_aluno, id_projeto, nome_projeto, data, hora_inicio, hora_fim, horas_totais, descricao_atividade, link_evidencia, status_entrega)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `);
          stmt.run(t.id, String(t.id_aluno), t.nome_aluno, String(t.id_projeto), t.nome_projeto || '', t.data, t.hora_inicio || '', t.hora_fim || '', t.horas_totais || '', t.descricao_atividade || '', t.link_evidencia || '', t.status_entrega || 'Concluído');
          res.writeHead(201, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(t));
        } catch (e) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Erro ao salvar timesheet no SQLite', details: e.message }));
        }
      });
      return;
    }

    // --- API: APP STATE (Backup / Sincronização Geral) ---
    if (req.url === '/api/app-state' && req.method === 'GET') {
      try {
        const row = db.prepare("SELECT value FROM app_state WHERE key = 'main'").get();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(row ? row.value : JSON.stringify({}));
      } catch (e) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Erro ao obter app_state' }));
      }
      return;
    }

    if (req.url === '/api/app-state' && req.method === 'POST') {
      let body = '';
      req.on('data', chunk => body += chunk.toString());
      req.on('end', () => {
        try {
          const stmt = db.prepare(`
            INSERT OR REPLACE INTO app_state (key, value, updated_at)
            VALUES ('main', ?, CURRENT_TIMESTAMP)
          `);
          stmt.run(body);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true }));
        } catch (e) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Erro ao gravar app_state no SQLite' }));
        }
      });
      return;
    }

    // Fallback para API não encontrada
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'API Endpoint not found' }));
    return;
  }

  // =========================================================================
  // ROTEAMENTO FRONTEND (Servindo Arquivos Estáticos)
  // =========================================================================
  let filePath = path.join(__dirname, req.url === '/' ? 'index.html' : req.url);
  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';

  fs.readFile(filePath, (err, content) => {
    if (err) {
      if (err.code === 'ENOENT') {
        fs.readFile(path.join(__dirname, 'index.html'), (err2, fallbackContent) => {
          if (err2) {
            res.writeHead(500);
            res.end('Erro interno do servidor');
          } else {
            res.writeHead(200, { 'Content-Type': 'text/html; charset=UTF-8' });
            res.end(fallbackContent);
          }
        });
      } else {
        res.writeHead(500);
        res.end(`Erro no servidor: ${err.code}`);
      }
    } else {
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content);
    }
  });
});

server.listen(PORT, () => {
  console.log(`[SQLITE] Servidor rodando com SQLite em http://localhost:${PORT}`);
});
