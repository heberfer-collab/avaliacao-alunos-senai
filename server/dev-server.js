const http = require('http');
const fs = require('fs');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');
const os = require('os');

const PORT = process.env.PORT || 3000;
const ROOT_DIR = path.resolve(__dirname, '..');
const DB_PATH = path.join(ROOT_DIR, 'database.sqlite');

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

// Inicialização do Banco de Dados SQLite Nativo no diretório raiz do projeto
let db = null;
try {
  db = new DatabaseSync(DB_PATH);
  try { db.exec('PRAGMA journal_mode = WAL;'); } catch (e) { }
} catch (err) {
  try {
    const tmpPath = path.join(os.tmpdir(), 'database.sqlite');
    if (fs.existsSync(DB_PATH) && !fs.existsSync(tmpPath)) {
      try { fs.copyFileSync(DB_PATH, tmpPath); } catch (e) { }
    }
    db = new DatabaseSync(tmpPath);
  } catch (e2) {
    try { db = new DatabaseSync(':memory:'); } catch (e3) { db = null; }
  }
}

// Configuração de tabelas no SQLite
if (db) {
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

    CREATE TABLE IF NOT EXISTS cursos (
      id TEXT PRIMARY KEY,
      nome TEXT NOT NULL,
      tipo TEXT NOT NULL,
      carga_horaria INT DEFAULT 0,
      descricao TEXT,
      ucs_padrao TEXT DEFAULT '[]',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS atividades (
      id TEXT PRIMARY KEY,
      titulo TEXT NOT NULL,
      id_turma TEXT NOT NULL,
      id_uc TEXT,
      descricao TEXT,
      estrategia_desafiadora TEXT DEFAULT 'Situação-Problema',
      estrategia_ensino TEXT DEFAULT 'Atividade Prática',
      contextualizacao TEXT,
      desafio TEXT,
      resultados_esperados TEXT,
      data_entrega TEXT,
      pontuacao_total NUMERIC DEFAULT 100,
      tem_criterios INTEGER DEFAULT 1,
      criterios TEXT DEFAULT '[]',
      modo_distribuicao TEXT DEFAULT 'HIBRIDO',
      status TEXT DEFAULT 'Aberta',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS entregas (
      id TEXT PRIMARY KEY,
      id_atividade TEXT NOT NULL,
      id_turma TEXT NOT NULL,
      id_aluno TEXT NOT NULL,
      nome_aluno TEXT,
      re_aluno TEXT,
      data_entrega TEXT,
      link_evidencia TEXT,
      texto_resposta TEXT,
      autoavaliacao TEXT DEFAULT '{}',
      avaliacao_docente TEXT DEFAULT '{}',
      nota_final NUMERIC DEFAULT 0,
      criticos_atingidos INTEGER DEFAULT 0,
      status TEXT DEFAULT 'Pendente',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS cronogramas (
      id TEXT PRIMARY KEY,
      id_turma TEXT NOT NULL,
      id_uc TEXT,
      semestre TEXT,
      docente_titular TEXT,
      dias_semana TEXT,
      data_inicio TEXT,
      data_fim TEXT,
      qa_total INT DEFAULT 60,
      matriz_aulas TEXT DEFAULT '{}',
      niveis_desempenho TEXT DEFAULT '[]',
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);
}

// Rotina de Migração e Sincronização de Dados
function migrateLegacyData() {
  if (!db) return;

  // 1. Migrar Usuários a partir de users_data.json
  const usersFile = path.join(ROOT_DIR, 'users_data.json');
  if (fs.existsSync(usersFile)) {
    try {
      const users = JSON.parse(fs.readFileSync(usersFile, 'utf8'));
      const insertUser = db.prepare(`
        INSERT INTO users (id, name, cpf, role) VALUES (?, ?, ?, ?)
        ON CONFLICT(cpf) DO UPDATE SET name = excluded.name, role = excluded.role
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
    insertUser.run('1', 'Heber Roberto Ferreira', '1080133', 'TEACHER');
    insertUser.run('2', 'Rafael Forti Scalfi', '222.222.222-22', 'TEACHER');
    insertUser.run('3', 'Coordenador Pedagógico', '000.000.000-00', 'ADMIN');
  }

  // 3. Atualizar NIF do professor Heber se estiver com legado 111.111.111-11
  try {
    db.exec(`UPDATE users SET cpf = '1080133' WHERE (name LIKE '%Heber%' OR id = '1') AND cpf = '111.111.111-11'`);
  } catch (e) { }

  // 4. Migrar Projetos a partir de projetos_data.json
  const projFile = path.join(ROOT_DIR, 'projetos_data.json');
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

  // 5. Migrar Timesheets a partir de timesheet_data.json
  const tsFile = path.join(ROOT_DIR, 'timesheet_data.json');
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

  // 6. Carga inicial e migração de Cursos SENAI (FIC, Técnico e CAI)
  try {
    const countCursos = db.prepare('SELECT count(*) as total FROM cursos').get();
    if (countCursos && countCursos.total === 0) {
      const cursosIniciais = [
        {
          id: 'cai-mecanico-usinagem',
          nome: 'Mecânico de Usinagem',
          tipo: 'CAI',
          carga_horaria: 1600,
          descricao: 'Curso de Aprendizagem Industrial voltado a processos de usinagem convencional e CNC, metrologia e leitura de desenho técnico mecânico.',
          ucs_padrao: JSON.stringify([
            { id: 'cai-mu-01', nome: 'Processos de Usinagem Convencional (320h)' },
            { id: 'cai-mu-02', nome: 'Tecnologia Mecânica e Ajustagem (280h)' },
            { id: 'cai-mu-03', nome: 'Programação e Operação CNC (400h)' }
          ])
        },
        {
          id: 'cai-eletricista-manutencao',
          nome: 'Eletricista de Manutenção Eletroeletrônica',
          tipo: 'CAI',
          carga_horaria: 1600,
          descricao: 'Curso de Aprendizagem Industrial voltado a instalações elétricas industriais, comandos elétricos, PLC e instrumentação.',
          ucs_padrao: JSON.stringify([
            { id: 'cai-em-01', nome: 'Instalações Elétricas Industriais (320h)' },
            { id: 'cai-em-02', nome: 'Comandos Elétricos e Acionamentos (360h)' },
            { id: 'cai-em-03', nome: 'Controladores Lógicos Programáveis - CLP (320h)' }
          ])
        },
        {
          id: 'cai-assistente-administrativo',
          nome: 'Assistente Administrativo',
          tipo: 'CAI',
          carga_horaria: 800,
          descricao: 'Curso de Aprendizagem Industrial focado em rotinas administrativas industriais, logística básica e processos operacionais.',
          ucs_padrao: JSON.stringify([
            { id: 'cai-adm-01', nome: 'Rotinas Administrativas e Organização Industrial (200h)' },
            { id: 'cai-adm-02', nome: 'Comunicação e Redação Empresarial (200h)' }
          ])
        },
        {
          id: 'tec-desenvolvimento-sistemas',
          nome: 'Técnico em Desenvolvimento de Sistemas',
          tipo: 'TECNICO',
          carga_horaria: 1200,
          descricao: 'Habilitação Técnica para desenvolvimento de softwares web, mobile e desktop, banco de dados e engenharia de requisitos.',
          ucs_padrao: JSON.stringify([
            { id: 'tec-ds-01', nome: 'Lógica de Programação e Algoritmos (100h)' },
            { id: 'tec-ds-02', nome: 'Desenvolvimento de Sistemas Web (200h)' },
            { id: 'tec-ds-03', nome: 'Modelagem e Implementação de Banco de Dados (120h)' },
            { id: 'tec-ds-04', nome: 'Fundamentos de Design Digital (375h)' }
          ])
        },
        {
          id: 'tec-mecatronica',
          nome: 'Técnico em Mecatrônica',
          tipo: 'TECNICO',
          carga_horaria: 1200,
          descricao: 'Habilitação Técnica integrando mecânica, eletrônica, robótica e controle automatizado de sistemas fabris.',
          ucs_padrao: JSON.stringify([
            { id: 'tec-meca-01', nome: 'Sistemas Eletropneumáticos e Eletro-hidráulicos (150h)' },
            { id: 'tec-meca-02', nome: 'Automação Industrial e Robótica (250h)' }
          ])
        },
        {
          id: 'tec-eletrotecnica',
          nome: 'Técnico em Eletrotécnica',
          tipo: 'TECNICO',
          carga_horaria: 1200,
          descricao: 'Habilitação Técnica para projetos elétricos, subestações, geração e distribuição de energia e manutenção industrial.',
          ucs_padrao: JSON.stringify([
            { id: 'tec-elt-01', nome: 'Projetos Elétricos Prediais e Industriais (200h)' },
            { id: 'tec-elt-02', nome: 'Máquinas Elétricas e Acionamentos (220h)' }
          ])
        },
        {
          id: 'fic-eletricista-instalador',
          nome: 'Eletricista Instalador Residencial',
          tipo: 'FIC',
          carga_horaria: 160,
          descricao: 'Formação Inicial e Continuada para dimensionamento e execução de instalações elétricas prediais conforme NBR 5410.',
          ucs_padrao: JSON.stringify([
            { id: 'fic-el-01', nome: 'Práticas de Instalações Elétricas Residenciais (160h)' }
          ])
        },
        {
          id: 'fic-torneiro-mecanico',
          nome: 'Torneiro Mecânico',
          tipo: 'FIC',
          carga_horaria: 240,
          descricao: 'Formação Inicial e Continuada voltada a usinagem de peças cilíndricas em torno convencional e afiação de ferramentas.',
          ucs_padrao: JSON.stringify([
            { id: 'fic-tm-01', nome: 'Operação de Torno Mecânico Universal (240h)' }
          ])
        },
        {
          id: 'fic-programador-web',
          nome: 'Programador Web Front-End',
          tipo: 'FIC',
          carga_horaria: 200,
          descricao: 'Formação Inicial e Continuada para construção de interfaces modernas responsivas com HTML5, CSS3, JavaScript e APIs.',
          ucs_padrao: JSON.stringify([
            { id: 'fic-pw-01', nome: 'Desenvolvimento Front-End Responsivo (200h)' }
          ])
        },
        {
          id: 'fic-soldador-mag',
          nome: 'Soldador no Processo MIG/MAG',
          tipo: 'FIC',
          carga_horaria: 180,
          descricao: 'Formação Inicial e Continuada para união de metais ferrosos e não ferrosos com gás inerte e ativo.',
          ucs_padrao: JSON.stringify([
            { id: 'fic-sol-01', nome: 'Soldagem MIG/MAG em Aço Carbono (180h)' }
          ])
        }
      ];

      const insertCurso = db.prepare(`
        INSERT INTO cursos (id, nome, tipo, carga_horaria, descricao, ucs_padrao)
        VALUES (?, ?, ?, ?, ?, ?)
      `);
      cursosIniciais.forEach(c => {
        insertCurso.run(c.id, c.nome, c.tipo, c.carga_horaria, c.descricao, c.ucs_padrao);
      });
      syncJsonFile('cursos_data.json', cursosIniciais);
    }
  } catch (e) {
    console.error('Erro ao inicializar cursos:', e);
  }

  // 7. Migrar Atividades e Entregas se arquivos JSON existirem
  const ativFile = path.join(ROOT_DIR, 'atividades_data.json');
  if (fs.existsSync(ativFile)) {
    try {
      const ativs = JSON.parse(fs.readFileSync(ativFile, 'utf8'));
      const insertAtiv = db.prepare(`
        INSERT OR IGNORE INTO atividades (id, titulo, id_turma, id_uc, descricao, data_entrega, pontuacao_total, tem_criterios, criterios, modo_distribuicao, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      ativs.forEach(a => {
        if (a.id) {
          insertAtiv.run(String(a.id), a.titulo || '', String(a.id_turma || ''), String(a.id_uc || ''), a.descricao || '', a.data_entrega || '', a.pontuacao_total || 100, a.tem_criterios ? 1 : 0, typeof a.criterios === 'string' ? a.criterios : JSON.stringify(a.criterios || []), a.modo_distribuicao || 'HIBRIDO', a.status || 'Aberta');
        }
      });
    } catch (e) { console.error('Erro ao migrar atividades_data.json:', e); }
  }

  const entFile = path.join(ROOT_DIR, 'entregas_data.json');
  if (fs.existsSync(entFile)) {
    try {
      const ents = JSON.parse(fs.readFileSync(entFile, 'utf8'));
      const insertEnt = db.prepare(`
        INSERT OR IGNORE INTO entregas (id, id_atividade, id_turma, id_aluno, nome_aluno, re_aluno, data_entrega, link_evidencia, texto_resposta, autoavaliacao, avaliacao_docente, nota_final, criticos_atingidos, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      ents.forEach(en => {
        if (en.id) {
          insertEnt.run(String(en.id), String(en.id_atividade), String(en.id_turma), String(en.id_aluno), en.nome_aluno || '', en.re_aluno || '', en.data_entrega || '', en.link_evidencia || '', en.texto_resposta || '', typeof en.autoavaliacao === 'string' ? en.autoavaliacao : JSON.stringify(en.autoavaliacao || {}), typeof en.avaliacao_docente === 'string' ? en.avaliacao_docente : JSON.stringify(en.avaliacao_docente || {}), en.nota_final || 0, en.criticos_atingidos ? 1 : 0, en.status || 'Pendente');
        }
      });
    } catch (e) { console.error('Erro ao migrar entregas_data.json:', e); }
  }

  // 8. Migrações estruturais MSEP (Situações de Aprendizagem e Avaliações)
  try {
    db.exec("ALTER TABLE atividades ADD COLUMN estrategia_desafiadora TEXT DEFAULT 'Situação-Problema'");
  } catch (e) { }
  try {
    db.exec("ALTER TABLE atividades ADD COLUMN estrategia_ensino TEXT DEFAULT 'Atividade Prática'");
  } catch (e) { }
  try {
    db.exec("ALTER TABLE atividades ADD COLUMN contextualizacao TEXT");
  } catch (e) { }
  try {
    db.exec("ALTER TABLE atividades ADD COLUMN desafio TEXT");
  } catch (e) { }
  try {
    db.exec("ALTER TABLE atividades ADD COLUMN resultados_esperados TEXT");
  } catch (e) { }
  try {
    db.exec("ALTER TABLE entregas ADD COLUMN parecer_reflexivo TEXT");
  } catch (e) { }
}

migrateLegacyData();

// Sincroniza arquivos JSON com os dados do SQLite
function syncJsonFile(filename, rows) {
  try {
    fs.writeFileSync(path.join(ROOT_DIR, filename), JSON.stringify(rows, null, 2), 'utf8');
  } catch (e) {
    console.error(`Erro ao sincronizar ${filename}:`, e.message);
  }
}

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

          // Sincronizar users_data.json
          const allUsers = db.prepare('SELECT id, name, cpf, role, created_at FROM users ORDER BY created_at ASC').all();
          syncJsonFile('users_data.json', allUsers);

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

        const allUsers = db.prepare('SELECT id, name, cpf, role, created_at FROM users ORDER BY created_at ASC').all();
        syncJsonFile('users_data.json', allUsers);

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

          const allProj = db.prepare('SELECT * FROM projetos ORDER BY created_at ASC').all();
          syncJsonFile('projetos_data.json', allProj);

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

        const allProj = db.prepare('SELECT * FROM projetos ORDER BY created_at ASC').all();
        syncJsonFile('projetos_data.json', allProj);

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

          const allTs = db.prepare('SELECT * FROM timesheet ORDER BY data DESC, created_at DESC').all();
          syncJsonFile('timesheet_data.json', allTs);

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

    // --- API: CURSOS SENAI (FIC, Técnico, CAI) ---
    if (req.url === '/api/cursos' && req.method === 'GET') {
      try {
        const rows = db.prepare('SELECT * FROM cursos ORDER BY tipo ASC, nome ASC').all();
        const formatted = rows.map(r => ({
          ...r,
          ucs_padrao: typeof r.ucs_padrao === 'string' ? JSON.parse(r.ucs_padrao || '[]') : r.ucs_padrao
        }));
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(formatted));
      } catch (e) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Erro ao consultar cursos', details: e.message }));
      }
      return;
    }

    if (req.url === '/api/cursos' && req.method === 'POST') {
      let body = '';
      req.on('data', chunk => body += chunk.toString());
      req.on('end', () => {
        try {
          const c = JSON.parse(body);
          c.id = c.id || `curso-${Date.now()}`;
          const ucsStr = typeof c.ucs_padrao === 'string' ? c.ucs_padrao : JSON.stringify(c.ucs_padrao || []);
          const stmt = db.prepare(`
            INSERT OR REPLACE INTO cursos (id, nome, tipo, carga_horaria, descricao, ucs_padrao)
            VALUES (?, ?, ?, ?, ?, ?)
          `);
          stmt.run(c.id, c.nome, c.tipo || 'FIC', c.carga_horaria || 0, c.descricao || '', ucsStr);

          const allCursos = db.prepare('SELECT * FROM cursos ORDER BY tipo ASC, nome ASC').all();
          syncJsonFile('cursos_data.json', allCursos);

          res.writeHead(201, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(c));
        } catch (e) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Erro ao salvar curso', details: e.message }));
        }
      });
      return;
    }

    if (req.url.startsWith('/api/cursos/') && req.method === 'DELETE') {
      const id = req.url.split('/')[3];
      try {
        db.prepare('DELETE FROM cursos WHERE id = ?').run(id);
        const allCursos = db.prepare('SELECT * FROM cursos ORDER BY tipo ASC, nome ASC').all();
        syncJsonFile('cursos_data.json', allCursos);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true }));
      } catch (e) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Erro ao excluir curso', details: e.message }));
      }
      return;
    }

    // --- API: ATIVIDADES PEDAGÓGICAS ---
    if (req.url === '/api/atividades' && req.method === 'GET') {
      try {
        const rows = db.prepare('SELECT * FROM atividades ORDER BY created_at DESC').all();
        const formatted = rows.map(r => ({
          ...r,
          tem_criterios: Boolean(r.tem_criterios),
          criterios: typeof r.criterios === 'string' ? JSON.parse(r.criterios || '[]') : r.criterios
        }));
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(formatted));
      } catch (e) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Erro ao consultar atividades', details: e.message }));
      }
      return;
    }

    if (req.url === '/api/atividades' && req.method === 'POST') {
      let body = '';
      req.on('data', chunk => body += chunk.toString());
      req.on('end', () => {
        try {
          const a = JSON.parse(body);
          a.id = a.id || `ativ-${Date.now()}`;
          const critStr = typeof a.criterios === 'string' ? a.criterios : JSON.stringify(a.criterios || []);
          const stmt = db.prepare(`
            INSERT OR REPLACE INTO atividades (
              id, titulo, id_turma, id_uc, descricao,
              estrategia_desafiadora, estrategia_ensino, contextualizacao, desafio, resultados_esperados,
              data_entrega, pontuacao_total, tem_criterios, criterios, modo_distribuicao, status
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `);
          stmt.run(
            a.id,
            a.titulo,
            String(a.id_turma || ''),
            String(a.id_uc || ''),
            a.descricao || '',
            a.estrategia_desafiadora || 'Situação-Problema',
            a.estrategia_ensino || 'Atividade Prática',
            a.contextualizacao || '',
            a.desafio || '',
            a.resultados_esperados || '',
            a.data_entrega || '',
            Number(a.pontuacao_total) || 100,
            a.tem_criterios ? 1 : 0,
            critStr,
            a.modo_distribuicao || 'HIBRIDO',
            a.status || 'Aberta'
          );

          const allAtiv = db.prepare('SELECT * FROM atividades ORDER BY created_at DESC').all();
          syncJsonFile('atividades_data.json', allAtiv);

          res.writeHead(201, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(a));
        } catch (e) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Erro ao salvar atividade', details: e.message }));
        }
      });
      return;
    }

    if (req.url.startsWith('/api/atividades/') && req.method === 'DELETE') {
      const id = req.url.split('/')[3];
      try {
        db.prepare('DELETE FROM atividades WHERE id = ?').run(id);
        const allAtiv = db.prepare('SELECT * FROM atividades ORDER BY created_at DESC').all();
        syncJsonFile('atividades_data.json', allAtiv);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true }));
      } catch (e) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Erro ao excluir atividade', details: e.message }));
      }
      return;
    }

    // --- API: ENTREGAS & AUTOAVALIAÇÃO ---
    if (req.url === '/api/entregas' && req.method === 'GET') {
      try {
        const rows = db.prepare('SELECT * FROM entregas ORDER BY created_at DESC').all();
        const formatted = rows.map(r => ({
          ...r,
          autoavaliacao: typeof r.autoavaliacao === 'string' ? JSON.parse(r.autoavaliacao || '{}') : r.autoavaliacao,
          avaliacao_docente: typeof r.avaliacao_docente === 'string' ? JSON.parse(r.avaliacao_docente || '{}') : r.avaliacao_docente,
          criticos_atingidos: Boolean(r.criticos_atingidos)
        }));
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(formatted));
      } catch (e) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Erro ao consultar entregas', details: e.message }));
      }
      return;
    }

    if (req.url === '/api/entregas' && req.method === 'POST') {
      let body = '';
      req.on('data', chunk => body += chunk.toString());
      req.on('end', () => {
        try {
          const en = JSON.parse(body);
          en.id = en.id || `ent-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
          const autoStr = typeof en.autoavaliacao === 'string' ? en.autoavaliacao : JSON.stringify(en.autoavaliacao || {});
          const docStr = typeof en.avaliacao_docente === 'string' ? en.avaliacao_docente : JSON.stringify(en.avaliacao_docente || {});

          const stmt = db.prepare(`
            INSERT OR REPLACE INTO entregas (id, id_atividade, id_turma, id_aluno, nome_aluno, re_aluno, data_entrega, link_evidencia, texto_resposta, autoavaliacao, avaliacao_docente, nota_final, criticos_atingidos, status)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `);
          stmt.run(
            en.id,
            String(en.id_atividade),
            String(en.id_turma || ''),
            String(en.id_aluno),
            en.nome_aluno || '',
            en.re_aluno || '',
            en.data_entrega || new Date().toISOString(),
            en.link_evidencia || '',
            en.texto_resposta || '',
            autoStr,
            docStr,
            Number(en.nota_final) || 0,
            en.criticos_atingidos ? 1 : 0,
            en.status || 'Pendente'
          );

          const allEnt = db.prepare('SELECT * FROM entregas ORDER BY created_at DESC').all();
          syncJsonFile('entregas_data.json', allEnt);

          res.writeHead(201, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(en));
        } catch (e) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Erro ao salvar entrega', details: e.message }));
        }
      });
      return;
    }

    if (req.url.startsWith('/api/entregas/') && req.method === 'DELETE') {
      const id = req.url.split('/')[3];
      try {
        db.prepare('DELETE FROM entregas WHERE id = ?').run(id);
        const allEnt = db.prepare('SELECT * FROM entregas ORDER BY created_at DESC').all();
        syncJsonFile('entregas_data.json', allEnt);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true }));
      } catch (e) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Erro ao excluir entrega', details: e.message }));
      }
      return;
    }

    // --- API: CRONOGRAMA MSEP (8.50 FR 93) & NÍVEIS DE DESEMPENHO ---
    if (req.url.startsWith('/api/cronogramas') && req.method === 'GET') {
      try {
        const urlObj = new URL(req.url, `http://localhost:${PORT}`);
        const turmaId = urlObj.searchParams.get('turma');
        let query;
        if (turmaId) {
          query = db.prepare('SELECT * FROM cronogramas WHERE id_turma = ?').all(turmaId);
        } else {
          query = db.prepare('SELECT * FROM cronogramas ORDER BY updated_at DESC').all();
        }
        const formatted = query.map(r => ({
          ...r,
          matriz_aulas: typeof r.matriz_aulas === 'string' ? JSON.parse(r.matriz_aulas || '{}') : r.matriz_aulas,
          niveis_desempenho: typeof r.niveis_desempenho === 'string' ? JSON.parse(r.niveis_desempenho || '[]') : r.niveis_desempenho
        }));
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(formatted));
      } catch (e) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Erro ao consultar cronogramas', details: e.message }));
      }
      return;
    }

    if (req.url === '/api/cronogramas' && req.method === 'POST') {
      let body = '';
      req.on('data', chunk => body += chunk.toString());
      req.on('end', () => {
        try {
          const c = JSON.parse(body);
          c.id = c.id || `crono-${c.id_turma || Date.now()}`;
          const matrizStr = typeof c.matriz_aulas === 'string' ? c.matriz_aulas : JSON.stringify(c.matriz_aulas || {});
          const niveisStr = typeof c.niveis_desempenho === 'string' ? c.niveis_desempenho : JSON.stringify(c.niveis_desempenho || []);

          const stmt = db.prepare(`
            INSERT OR REPLACE INTO cronogramas (id, id_turma, id_uc, semestre, docente_titular, dias_semana, data_inicio, data_fim, qa_total, matriz_aulas, niveis_desempenho, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
          `);
          stmt.run(
            c.id,
            String(c.id_turma),
            c.id_uc || '',
            c.semestre || '1º Semestre / 2026',
            c.docente_titular || '',
            c.dias_semana || '4ª Feiras',
            c.data_inicio || '',
            c.data_fim || '',
            Number(c.qa_total) || 60,
            matrizStr,
            niveisStr
          );

          const allCrono = db.prepare('SELECT * FROM cronogramas ORDER BY updated_at DESC').all();
          syncJsonFile('cronogramas_data.json', allCrono);

          res.writeHead(201, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(c));
        } catch (e) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Erro ao salvar cronograma', details: e.message }));
        }
      });
      return;
    }

    if (req.url.startsWith('/api/cronogramas/') && req.method === 'DELETE') {
      const id = req.url.split('/')[3];
      try {
        db.prepare('DELETE FROM cronogramas WHERE id = ?').run(id);
        const allCrono = db.prepare('SELECT * FROM cronogramas ORDER BY updated_at DESC').all();
        syncJsonFile('cronogramas_data.json', allCrono);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true }));
      } catch (e) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Erro ao excluir cronograma', details: e.message }));
      }
      return;
    }

    // Fallback para API não encontrada
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'API Endpoint not found' }));
    return;
  }

  // =========================================================================
  // ROTEAMENTO FRONTEND (Servindo Arquivos Estáticos a partir do ROOT_DIR)
  // =========================================================================
  let safePath = req.url.split('?')[0];
  if (safePath === '/') safePath = '/index.html';
  let filePath = path.join(ROOT_DIR, safePath);
  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';

  fs.readFile(filePath, (err, content) => {
    if (err) {
      if (err.code === 'ENOENT') {
        fs.readFile(path.join(ROOT_DIR, 'index.html'), (err2, fallbackContent) => {
          if (err2) {
            res.writeHead(500, { 'Content-Type': 'text/plain; charset=UTF-8' });
            res.end('Erro interno do servidor: index.html não encontrado');
          } else {
            res.writeHead(200, { 'Content-Type': 'text/html; charset=UTF-8' });
            res.end(fallbackContent);
          }
        });
      } else {
        res.writeHead(500, { 'Content-Type': 'text/plain; charset=UTF-8' });
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
