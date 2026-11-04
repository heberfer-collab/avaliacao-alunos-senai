/**
 * Servidor HTTP de Produção / Desenvolvimento
 * Suporta MySQL nativo e fallback automático para SQLite
 * Sistema de Gestão e Avaliação SENAI (MSEP)
 */

require('dotenv').config();
const http = require('http');
const https = require('https');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const db = require('./db');

const PORT = process.env.PORT || 3000;
const ROOT_DIR = path.resolve(__dirname, '..');
const MIGAE_SECRET = process.env.N8N_WEBHOOK_SECRET || 'migae_senai_heber_2026_secret';

// =============================================================================
// MOTOR CIENTÍFICO MIGAE (FERREIRA, 2026)
// 1ª Dimensão: Sanitização Anti-XSS/SQLi & Integridade Criptográfica (Robredo, 2003)
// 2ª Dimensão: Conversão Informação Latente -> Manifesta (Borko, 1968; Ladeira, 2010)
// 3ª Dimensão: Governança Ético-Regulatória e Trilha de Auditoria (O'Neil, 2016)
// =============================================================================
function sanitizeInputMIGAE(str) {
  if (typeof str !== 'string') return '';
  return str
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '[XSS_BLOCKED]')
    .replace(/javascript:/gi, '[JS_PROTOCOL_BLOCKED]')
    .replace(/on\w+\s*=/gi, '[EVENT_HANDLER_BLOCKED]')
    .trim();
}

function generateHashMIGAE(payload) {
  const raw = typeof payload === 'string' ? payload : JSON.stringify(payload);
  return crypto.createHash('sha256').update(raw + MIGAE_SECRET).digest('hex').substring(0, 16).toUpperCase();
}

function classifyLatentToManifest(link, texto, autoObj, docObj) {
  const urlLower = (link || '').toLowerCase();
  let tipoArtefato = 'Relatório Técnico / Resposta Textual';
  if (urlLower.includes('github.com') || urlLower.includes('gitlab.com')) {
    tipoArtefato = 'Repositório de Código-Fonte (Git)';
  } else if (urlLower.includes('figma.com') || urlLower.includes('canva.com') || urlLower.includes('behance.net')) {
    tipoArtefato = 'Protótipo de Interface / Design Multimídia';
  } else if (urlLower.includes('youtube.com') || urlLower.includes('youtu.be') || urlLower.includes('vimeo.com')) {
    tipoArtefato = 'Produção Audiovisual / Vídeo Digital';
  } else if (urlLower.includes('drive.google.com') || urlLower.includes('docs.google.com') || urlLower.includes('onedrive')) {
    tipoArtefato = 'Artefato em Nuvem Estruturada';
  } else if (urlLower.startsWith('http')) {
    tipoArtefato = 'Artefato Web / Deploy Externo';
  }

  // Cálculo de convergência Autoavaliação vs Docente
  const autoKeys = Object.keys(autoObj || {});
  let matches = 0;
  let compared = 0;
  autoKeys.forEach(k => {
    if (docObj && docObj[k]) {
      compared++;
      if (autoObj[k] === docObj[k]) matches++;
    }
  });
  const convergencia = compared > 0 ? Math.round((matches / compared) * 100) : null;

  return {
    tipo_artefato: tipoArtefato,
    protocolo_seguro_https: urlLower.startsWith('https://'),
    densidade_textual_chars: (texto || '').length,
    criterios_autoavaliados: autoKeys.length,
    indice_convergencia_docente: convergencia !== null ? `${convergencia}%` : 'Aguardando Avaliação Docente',
    referencia_teorica: 'Borko (1968) - Conversão Latente -> Manifesta'
  };
}

async function dispatchN8nWebhookMIGAE(webhookUrl, eventName, dataPayload) {
  if (!webhookUrl || !webhookUrl.startsWith('http')) return 'LOCAL_MYSQL_ONLY';
  return new Promise((resolve) => {
    try {
      const bodyStr = JSON.stringify({
        framework: 'MIGAE - Heber Roberto Ferreira (2026)',
        event: eventName,
        timestamp: new Date().toISOString(),
        hash_sha256: generateHashMIGAE(dataPayload),
        data: dataPayload
      });
      const signature = crypto.createHmac('sha256', MIGAE_SECRET).update(bodyStr).digest('hex');
      const parsedUrl = new URL(webhookUrl);
      const client = parsedUrl.protocol === 'https:' ? https : http;

      const req = client.request(parsedUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(bodyStr),
          'X-MIGAE-Signature': signature,
          'X-MIGAE-Author': 'Heber-Roberto-Ferreira-2026'
        },
        timeout: 4000
      }, (res) => {
        resolve(`N8N_HTTP_${res.statusCode}`);
      });
      req.on('error', (err) => resolve(`N8N_OFFLINE (${err.code || 'ERR'})`));
      req.on('timeout', () => { req.destroy(); resolve('N8N_TIMEOUT'); });
      req.write(bodyStr);
      req.end();
    } catch (e) {
      resolve('N8N_URL_INVALIDA');
    }
  });
}

const MIME_TYPES = {
  '.html': 'text/html; charset=UTF-8',
  '.js': 'text/javascript; charset=UTF-8',
  '.css': 'text/css; charset=UTF-8',
  '.json': 'application/json; charset=UTF-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf'
};

// Sincronização auxiliar com arquivos JSON locais (se existirem)
function syncJsonFile(filename, rows) {
  try {
    const fullPath = path.join(ROOT_DIR, filename);
    fs.writeFileSync(fullPath, JSON.stringify(rows, null, 2), 'utf8');
  } catch (e) {
    // Silencioso em containers onde o fs pode ser restrito
  }
}

// Carga inicial de Cursos e Usuários caso o banco esteja novo/vazio
async function ensureInitialSeed() {
  try {
    const usersCount = await db.query('SELECT COUNT(*) as total FROM users');
    const totalUsers = usersCount[0]?.total || usersCount[0]?.['COUNT(*)'] || 0;
    if (totalUsers === 0) {
      console.log('[SEED] Inserindo usuários padrão do sistema...');
      await db.execute('REPLACE INTO users (id, name, cpf, role) VALUES (?, ?, ?, ?)', ['1', 'Heber Roberto Ferreira', '1080133', 'TEACHER']);
      await db.execute('REPLACE INTO users (id, name, cpf, role) VALUES (?, ?, ?, ?)', ['2', 'Rafael Forti Scalfi', '222.222.222-22', 'TEACHER']);
      await db.execute('REPLACE INTO users (id, name, cpf, role) VALUES (?, ?, ?, ?)', ['3', 'Coordenador Pedagógico', '000.000.000-00', 'ADMIN']);
    }

    const cursosCount = await db.query('SELECT COUNT(*) as total FROM cursos');
    const totalCursos = cursosCount[0]?.total || cursosCount[0]?.['COUNT(*)'] || 0;
    if (totalCursos === 0) {
      console.log('[SEED] Inserindo catálogo padrão de Cursos SENAI...');
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
          id: 'fic-programador-web',
          nome: 'Programador Web Front-End',
          tipo: 'FIC',
          carga_horaria: 200,
          descricao: 'Formação Inicial e Continuada para construção de interfaces modernas responsivas com HTML5, CSS3, JavaScript e APIs.',
          ucs_padrao: JSON.stringify([
            { id: 'fic-pw-01', nome: 'Desenvolvimento Front-End Responsivo (200h)' }
          ])
        }
      ];

      for (const c of cursosIniciais) {
        await db.execute(
          'REPLACE INTO cursos (id, nome, tipo, carga_horaria, descricao, ucs_padrao) VALUES (?, ?, ?, ?, ?, ?)',
          [c.id, c.nome, c.tipo, c.carga_horaria, c.descricao, c.ucs_padrao]
        );
      }
    }
  } catch (err) {
    console.error('[SEED] Erro ao verificar dados iniciais:', err.message);
  }
}

// Servidor Principal
const server = http.createServer(async (req, res) => {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, DELETE');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const urlPath = req.url.split('?')[0];

  // Helper para ler corpo de requisição JSON
  function getJsonBody() {
    return new Promise((resolve, reject) => {
      let body = '';
      req.on('data', chunk => { body += chunk.toString(); });
      req.on('end', () => {
        try {
          resolve(body ? JSON.parse(body) : {});
        } catch (e) {
          reject(new Error('JSON inválido no corpo da requisição'));
        }
      });
      req.on('error', reject);
    });
  }

  // =========================================================================
  // ROTAS DA API RESTful
  // =========================================================================
  if (req.url.startsWith('/api/')) {
    // --- HEALTH CHECK ---
    if (urlPath === '/api/health' || urlPath === '/api/status') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        status: 'ok',
        databaseEngine: db.getEngine(),
        timestamp: new Date().toISOString(),
        uptime: Math.floor(process.uptime()),
        version: '2.0.0-senai-mysql'
      }));
      return;
    }

    // --- SENHAS PERSONALIZADAS DOS USUÁRIOS (ADMIN, DOCENTES, ALUNOS) ---
    if (urlPath === '/api/passwords') {
      if (req.method === 'GET') {
        try {
          const rows = await db.query('SELECT user_key, password FROM user_passwords');
          const map = {};
          rows.forEach(r => { map[r.user_key] = r.password; });
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(map));
        } catch (e) {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({}));
        }
        return;
      }

      if (req.method === 'POST') {
        try {
          const body = await getJsonBody();
          if (!body.user_key || !body.password) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'user_key e password são obrigatórios' }));
            return;
          }
          await db.execute(
            'REPLACE INTO user_passwords (user_key, password) VALUES (?, ?)',
            [String(body.user_key), String(body.password)]
          );
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true }));
        } catch (e) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Erro ao atualizar senha no banco', details: e.message }));
        }
        return;
      }
    }

    // --- USUÁRIOS ---
    if (urlPath === '/api/users') {
      if (req.method === 'GET') {
        try {
          const rows = await db.query('SELECT id, name, cpf, role, created_at FROM users ORDER BY created_at ASC');
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(rows));
        } catch (e) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Erro ao consultar usuários', details: e.message }));
        }
        return;
      }

      if (req.method === 'POST') {
        try {
          const user = await getJsonBody();
          user.id = user.id || Date.now().toString();
          await db.execute(
            'REPLACE INTO users (id, name, cpf, role) VALUES (?, ?, ?, ?)',
            [user.id, user.name, user.cpf, user.role || 'TEACHER']
          );

          const allUsers = await db.query('SELECT id, name, cpf, role, created_at FROM users ORDER BY created_at ASC');
          syncJsonFile('users_data.json', allUsers);

          res.writeHead(201, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(user));
        } catch (e) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Erro ao gravar usuário', details: e.message }));
        }
        return;
      }
    }

    if (urlPath.startsWith('/api/users/') && req.method === 'DELETE') {
      const id = urlPath.split('/')[3];
      try {
        await db.execute('DELETE FROM users WHERE id = ?', [id]);
        const allUsers = await db.query('SELECT id, name, cpf, role, created_at FROM users ORDER BY created_at ASC');
        syncJsonFile('users_data.json', allUsers);

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true }));
      } catch (e) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Erro ao remover usuário', details: e.message }));
      }
      return;
    }

    // --- PROJETOS ---
    if (urlPath === '/api/projetos') {
      if (req.method === 'GET') {
        try {
          const rows = await db.query('SELECT * FROM projetos ORDER BY created_at ASC');
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(rows));
        } catch (e) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Erro ao consultar projetos', details: e.message }));
        }
        return;
      }

      if (req.method === 'POST') {
        try {
          const p = await getJsonBody();
          p.id = p.id || Date.now().toString();
          await db.execute(
            `REPLACE INTO projetos (id, titulo, id_uc, id_turma, tipo_formacao, data_inicio, data_fim, descricao, status)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [p.id, p.titulo, p.id_uc || '', p.id_turma || '', p.tipo_formacao || 'Individual', p.data_inicio || '', p.data_fim || '', p.descricao || '', p.status || 'Em Andamento']
          );

          const allProj = await db.query('SELECT * FROM projetos ORDER BY created_at ASC');
          syncJsonFile('projetos_data.json', allProj);

          res.writeHead(201, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(p));
        } catch (e) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Erro ao salvar projeto', details: e.message }));
        }
        return;
      }
    }

    if (urlPath.startsWith('/api/projetos/') && req.method === 'DELETE') {
      const id = urlPath.split('/')[3];
      try {
        await db.execute('DELETE FROM projetos WHERE id = ?', [id]);
        const allProj = await db.query('SELECT * FROM projetos ORDER BY created_at ASC');
        syncJsonFile('projetos_data.json', allProj);

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true }));
      } catch (e) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Erro ao remover projeto', details: e.message }));
      }
      return;
    }

    // --- TIMESHEET ---
    if (urlPath === '/api/timesheet') {
      if (req.method === 'GET') {
        try {
          const rows = await db.query('SELECT * FROM timesheet ORDER BY data DESC, created_at DESC');
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(rows));
        } catch (e) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Erro ao consultar timesheet', details: e.message }));
        }
        return;
      }

      if (req.method === 'POST') {
        try {
          const t = await getJsonBody();
          t.id = t.id || Date.now().toString();
          await db.execute(
            `REPLACE INTO timesheet (id, id_aluno, nome_aluno, id_projeto, nome_projeto, data, hora_inicio, hora_fim, horas_totais, descricao_atividade, link_evidencia, status_entrega)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [t.id, String(t.id_aluno), t.nome_aluno, String(t.id_projeto), t.nome_projeto || '', t.data, t.hora_inicio || '', t.hora_fim || '', t.horas_totais || '', t.descricao_atividade || '', t.link_evidencia || '', t.status_entrega || 'Concluído']
          );

          const allTs = await db.query('SELECT * FROM timesheet ORDER BY data DESC, created_at DESC');
          syncJsonFile('timesheet_data.json', allTs);

          res.writeHead(201, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(t));
        } catch (e) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Erro ao salvar timesheet', details: e.message }));
        }
        return;
      }
    }

    // --- APP STATE (Backup / Sincronização Geral) ---
    if (urlPath === '/api/app-state') {
      if (req.method === 'GET') {
        try {
          const row = await db.queryOne("SELECT value FROM app_state WHERE `key` = 'main'");
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(row ? row.value : JSON.stringify({}));
        } catch (e) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Erro ao obter app_state', details: e.message }));
        }
        return;
      }

      if (req.method === 'POST') {
        let body = '';
        req.on('data', chunk => { body += chunk.toString(); });
        req.on('end', async () => {
          try {
            await db.execute("REPLACE INTO app_state (`key`, `value`) VALUES ('main', ?)", [body]);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: true }));
          } catch (e) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Erro ao gravar app_state', details: e.message }));
          }
        });
        return;
      }
    }

    // --- CURSOS SENAI ---
    if (urlPath === '/api/cursos') {
      if (req.method === 'GET') {
        try {
          const rows = await db.query('SELECT * FROM cursos ORDER BY tipo ASC, nome ASC');
          const formatted = rows.map(r => ({
            ...r,
            ucs_padrao: typeof r.ucs_padrao === 'string' ? JSON.parse(r.ucs_padrao || '[]') : (r.ucs_padrao || [])
          }));
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(formatted));
        } catch (e) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Erro ao consultar cursos', details: e.message }));
        }
        return;
      }

      if (req.method === 'POST') {
        try {
          const c = await getJsonBody();
          c.id = c.id || `curso-${Date.now()}`;
          const ucsStr = typeof c.ucs_padrao === 'string' ? c.ucs_padrao : JSON.stringify(c.ucs_padrao || []);
          await db.execute(
            'REPLACE INTO cursos (id, nome, tipo, carga_horaria, descricao, ucs_padrao) VALUES (?, ?, ?, ?, ?, ?)',
            [c.id, c.nome, c.tipo || 'FIC', c.carga_horaria || 0, c.descricao || '', ucsStr]
          );

          const allCursos = await db.query('SELECT * FROM cursos ORDER BY tipo ASC, nome ASC');
          syncJsonFile('cursos_data.json', allCursos);

          res.writeHead(201, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(c));
        } catch (e) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Erro ao salvar curso', details: e.message }));
        }
        return;
      }
    }

    if (urlPath.startsWith('/api/cursos/') && req.method === 'DELETE') {
      const id = urlPath.split('/')[3];
      try {
        await db.execute('DELETE FROM cursos WHERE id = ?', [id]);
        const allCursos = await db.query('SELECT * FROM cursos ORDER BY tipo ASC, nome ASC');
        syncJsonFile('cursos_data.json', allCursos);

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true }));
      } catch (e) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Erro ao excluir curso', details: e.message }));
      }
      return;
    }

    // --- ATIVIDADES PEDAGÓGICAS ---
    if (urlPath === '/api/atividades') {
      if (req.method === 'GET') {
        try {
          const rows = await db.query('SELECT * FROM atividades ORDER BY created_at DESC');
          const formatted = rows.map(r => ({
            ...r,
            tem_criterios: Boolean(r.tem_criterios),
            criterios: typeof r.criterios === 'string' ? JSON.parse(r.criterios || '[]') : (r.criterios || [])
          }));
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(formatted));
        } catch (e) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Erro ao consultar atividades', details: e.message }));
        }
        return;
      }

      if (req.method === 'POST') {
        try {
          const a = await getJsonBody();
          a.id = a.id || `ativ-${Date.now()}`;
          const critStr = typeof a.criterios === 'string' ? a.criterios : JSON.stringify(a.criterios || []);
          await db.execute(
            `REPLACE INTO atividades (
              id, titulo, id_turma, id_uc, descricao,
              tipo_avaliacao, instrumento_avaliacao, peso, exige_criticos,
              estrategia_desafiadora, estrategia_ensino, contextualizacao, desafio, resultados_esperados,
              data_entrega, pontuacao_total, tem_criterios, criterios, modo_distribuicao, status
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              a.id,
              a.titulo,
              String(a.id_turma || ''),
              String(a.id_uc || ''),
              a.descricao || '',
              a.tipo_avaliacao || 'FORMATIVA',
              a.instrumento_avaliacao || 'RUBRICA_MSEP',
              Number(a.peso) || 1,
              a.exige_criticos ? 1 : 0,
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
            ]
          );

          const allAtiv = await db.query('SELECT * FROM atividades ORDER BY created_at DESC');
          syncJsonFile('atividades_data.json', allAtiv);

          res.writeHead(201, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(a));
        } catch (e) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Erro ao salvar atividade', details: e.message }));
        }
        return;
      }
    }

    if (urlPath.startsWith('/api/atividades/') && req.method === 'DELETE') {
      const id = urlPath.split('/')[3];
      try {
        await db.execute('DELETE FROM atividades WHERE id = ?', [id]);
        const allAtiv = await db.query('SELECT * FROM atividades ORDER BY created_at DESC');
        syncJsonFile('atividades_data.json', allAtiv);

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true }));
      } catch (e) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Erro ao excluir atividade', details: e.message }));
      }
      return;
    }

    // --- ENTREGAS & AUTOAVALIAÇÃO ---
    if (urlPath === '/api/entregas') {
      if (req.method === 'GET') {
        try {
          const rows = await db.query('SELECT * FROM entregas ORDER BY created_at DESC');
          const formatted = rows.map(r => ({
            ...r,
            autoavaliacao: typeof r.autoavaliacao === 'string' ? JSON.parse(r.autoavaliacao || '{}') : (r.autoavaliacao || {}),
            avaliacao_docente: typeof r.avaliacao_docente === 'string' ? JSON.parse(r.avaliacao_docente || '{}') : (r.avaliacao_docente || {}),
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

      if (req.method === 'POST') {
        try {
          const en = await getJsonBody();
          en.id = en.id || `ent-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;

          // 1ª Dimensão MIGAE: Sanitização de Entradas Discentes (Anti-XSS / Anti-SQLi)
          en.link_evidencia = sanitizeInputMIGAE(en.link_evidencia || '');
          en.texto_resposta = sanitizeInputMIGAE(en.texto_resposta || '');
          en.parecer_reflexivo = sanitizeInputMIGAE(en.parecer_reflexivo || '');

          const autoObj = typeof en.autoavaliacao === 'string' ? JSON.parse(en.autoavaliacao || '{}') : (en.autoavaliacao || {});
          const docObj = typeof en.avaliacao_docente === 'string' ? JSON.parse(en.avaliacao_docente || '{}') : (en.avaliacao_docente || {});
          const autoStr = JSON.stringify(autoObj);
          const docStr = JSON.stringify(docObj);

          // 2ª Dimensão MIGAE: Conversão de Informação Latente -> Manifesta (Borko, 1968) + Hash SHA-256
          const hashIntegridade = generateHashMIGAE(en);
          const manifestMeta = classifyLatentToManifest(en.link_evidencia, en.texto_resposta, autoObj);
          en.hash_integridade = hashIntegridade;
          en.metadados_manifestos = manifestMeta;

          await db.execute(
            `REPLACE INTO entregas (
              id, id_atividade, id_turma, id_aluno, nome_aluno, re_aluno, data_entrega,
              link_evidencia, texto_resposta, autoavaliacao, avaliacao_docente, parecer_reflexivo,
              nota_final, criticos_atingidos, status
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
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
              en.parecer_reflexivo || '',
              Number(en.nota_final) || 0,
              en.criticos_atingidos ? 1 : 0,
              en.status || 'Pendente'
            ]
          );

          // 1ª & 3ª Dimensão MIGAE: Disparo Assíncrono n8n + Log Imutável de Auditoria
          let webhookUrl = process.env.N8N_WEBHOOK_URL || '';
          try {
            const stateRows = await db.query('SELECT value FROM app_state WHERE `key` = ?', ['migae_n8n_url']);
            if (stateRows.length > 0 && stateRows[0].value) webhookUrl = stateRows[0].value;
          } catch (_) {}

          const n8nStatus = await dispatchN8nWebhookMIGAE(webhookUrl, {
            evento: en.status === 'Avaliado' ? 'AVALIACAO_DOCENTE_MIGAE' : 'SUBMISSAO_ARTEFATO_DISCENTE',
            id_entrega: en.id,
            id_atividade: en.id_atividade,
            id_turma: en.id_turma,
            ator_pseudonimizado: `ESTUDANTE-${hashIntegridade.substring(0, 6)}`,
            hash_sha256: hashIntegridade,
            metadados_manifestos: manifestMeta,
            status_entrega: en.status || 'Pendente',
            nota_final: Number(en.nota_final) || 0,
            timestamp: new Date().toISOString()
          });

          try {
            await db.execute(
              'INSERT INTO migae_audit_logs (evento, ator, hash_integridade, metadados_manifestos, status_n8n) VALUES (?, ?, ?, ?, ?)',
              [
                en.status === 'Avaliado' ? 'AVALIACAO_DOCENTE_CONSOLIDADA' : 'INGESTAO_EVIDENCIA_SANITIZADA',
                `${en.nome_aluno || 'Estudante'} (${en.re_aluno || en.id_aluno})`,
                hashIntegridade,
                JSON.stringify(manifestMeta),
                n8nStatus
              ]
            );
          } catch (_) {}

          const allEnt = await db.query('SELECT * FROM entregas ORDER BY created_at DESC');
          syncJsonFile('entregas_data.json', allEnt);

          res.writeHead(201, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(en));
        } catch (e) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Erro ao salvar entrega', details: e.message }));
        }
        return;
      }
    }

    if (urlPath.startsWith('/api/entregas/') && req.method === 'DELETE') {
      const id = urlPath.split('/')[3];
      try {
        await db.execute('DELETE FROM entregas WHERE id = ?', [id]);
        const allEnt = await db.query('SELECT * FROM entregas ORDER BY created_at DESC');
        syncJsonFile('entregas_data.json', allEnt);

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true }));
      } catch (e) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Erro ao excluir entrega', details: e.message }));
      }
      return;
    }

    // --- CRONOGRAMAS MSEP (8.50 FR 93) ---
    if (urlPath === '/api/cronogramas') {
      if (req.method === 'GET') {
        try {
          const urlObj = new URL(req.url, `http://localhost:${PORT}`);
          const turmaId = urlObj.searchParams.get('turma');
          let rows;
          if (turmaId) {
            rows = await db.query('SELECT * FROM cronogramas WHERE id_turma = ?', [turmaId]);
          } else {
            rows = await db.query('SELECT * FROM cronogramas ORDER BY updated_at DESC');
          }
          const formatted = rows.map(r => ({
            ...r,
            matriz_aulas: typeof r.matriz_aulas === 'string' ? JSON.parse(r.matriz_aulas || '{}') : (r.matriz_aulas || {}),
            niveis_desempenho: typeof r.niveis_desempenho === 'string' ? JSON.parse(r.niveis_desempenho || '[]') : (r.niveis_desempenho || [])
          }));
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(formatted));
        } catch (e) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Erro ao consultar cronogramas', details: e.message }));
        }
        return;
      }

      if (req.method === 'POST') {
        try {
          const c = await getJsonBody();
          c.id = c.id || `crono-${c.id_turma || Date.now()}`;
          const matrizStr = typeof c.matriz_aulas === 'string' ? c.matriz_aulas : JSON.stringify(c.matriz_aulas || {});
          const niveisStr = typeof c.niveis_desempenho === 'string' ? c.niveis_desempenho : JSON.stringify(c.niveis_desempenho || []);

          await db.execute(
            `REPLACE INTO cronogramas (
              id, id_turma, id_uc, semestre, docente_titular, dias_semana, data_inicio, data_fim, qa_total, matriz_aulas, niveis_desempenho
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
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
            ]
          );

          const allCrono = await db.query('SELECT * FROM cronogramas ORDER BY updated_at DESC');
          syncJsonFile('cronogramas_data.json', allCrono);

          res.writeHead(201, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(c));
        } catch (e) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Erro ao salvar cronograma', details: e.message }));
        }
        return;
      }
    }

    if (urlPath.startsWith('/api/cronogramas/') && req.method === 'DELETE') {
      const id = urlPath.split('/')[3];
      try {
        await db.execute('DELETE FROM cronogramas WHERE id = ?', [id]);
        const allCrono = await db.query('SELECT * FROM cronogramas ORDER BY updated_at DESC');
        syncJsonFile('cronogramas_data.json', allCrono);

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true }));
      } catch (e) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Erro ao excluir cronograma', details: e.message }));
      }
      return;
    }

    // --- GOVERNANÇA ALGORÍTMICA EDUCACIONAL (MIGAE - FERREIRA, 2026) ---
    if (urlPath === '/api/migae/audit' && req.method === 'GET') {
      try {
        const logs = await db.query('SELECT * FROM migae_audit_logs ORDER BY created_at DESC LIMIT 60');
        let webhookUrl = process.env.N8N_WEBHOOK_URL || '';
        try {
          const stateRows = await db.query('SELECT value FROM app_state WHERE `key` = ?', ['migae_n8n_url']);
          if (stateRows.length > 0 && stateRows[0].value) webhookUrl = stateRows[0].value;
        } catch (_) {}

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          framework: 'MIGAE - Modelo Integrado de Governança Algorítmica Educacional (Ferreira, 2026)',
          webhookUrl,
          dbEngine: db.getEngine(),
          logs: logs.map(l => ({
            ...l,
            metadados_manifestos: typeof l.metadados_manifestos === 'string'
              ? JSON.parse(l.metadados_manifestos || '{}')
              : (l.metadados_manifestos || {})
          }))
        }));
      } catch (e) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Erro ao consultar auditoria MIGAE', details: e.message }));
      }
      return;
    }

    if (urlPath === '/api/migae/webhook' && req.method === 'POST') {
      try {
        const body = await getJsonBody();
        const webhookUrl = String(body.webhookUrl || '').trim();
        const testFire = Boolean(body.testFire);

        await db.execute(
          'REPLACE INTO app_state (`key`, value) VALUES (?, ?)',
          ['migae_n8n_url', webhookUrl]
        );

        let statusN8n = 'CONFIGURACAO_SALVA';
        const hashTeste = crypto.createHash('sha256').update(`MIGAE-TEST-${Date.now()}`).digest('hex').substring(0, 16).toUpperCase();

        if (testFire && webhookUrl) {
          statusN8n = await dispatchN8nWebhookMIGAE(webhookUrl, {
            evento: 'TESTE_CONECTIVIDADE_MIGAE_N8N',
            autor_modelo: 'Heber Roberto Ferreira (Faculdade Única / Grupo Prominas, 2026)',
            hash_sha256: hashTeste,
            dimensao: '1ª Dimensão: Automação de Fluxos via Webhooks (Robredo, 2003)',
            timestamp: new Date().toISOString()
          });
        }

        await db.execute(
          'INSERT INTO migae_audit_logs (evento, ator, hash_integridade, metadados_manifestos, status_n8n) VALUES (?, ?, ?, ?, ?)',
          [
            testFire ? 'TESTE_WEBHOOK_N8N_MIGAE' : 'ATUALIZACAO_ENDPOINT_N8N',
            body.ator || 'Docente / Admin',
            hashTeste,
            JSON.stringify({ endpoint: webhookUrl || 'DESATIVADO', protocolo: 'HTTPS/REST JSON' }),
            statusN8n
          ]
        );

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, webhookUrl, statusN8n, hashTeste }));
      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Erro ao configurar Webhook MIGAE', details: e.message }));
      }
      return;
    }

    // Fallback 404 para API
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Endpoint da API não encontrado' }));
    return;
  }

  // =========================================================================
  // SERVINDO ARQUIVOS ESTÁTICOS / SPA (index.html)
  // =========================================================================
  let safePath = urlPath;
  if (safePath === '/') safePath = '/index.html';
  const filePath = path.join(ROOT_DIR, safePath);
  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';

  fs.readFile(filePath, (err, content) => {
    if (err) {
      if (err.code === 'ENOENT') {
        fs.readFile(path.join(ROOT_DIR, 'index.html'), (err2, fallbackContent) => {
          if (err2) {
            res.writeHead(500, { 'Content-Type': 'text/plain; charset=UTF-8' });
            res.end('Erro interno: index.html não localizado.');
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

// Inicialização
async function startServer() {
  const engine = await db.initDatabase();
  await ensureInitialSeed();

  server.listen(PORT, () => {
    console.log(`=======================================================`);
    console.log(`🚀 SERVIDOR SENAI OPERACIONAL`);
    console.log(`🌐 Porta: http://localhost:${PORT}`);
    console.log(`🗄️  Mecanismo Ativo: [${engine.toUpperCase()}]`);
    console.log(`=======================================================`);
  });
}

startServer().catch(err => {
  console.error('Falha crítica ao iniciar servidor:', err);
  process.exit(1);
});

