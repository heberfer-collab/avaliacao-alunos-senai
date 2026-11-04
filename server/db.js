/**
 * Módulo de Banco de Dados Híbrido (MySQL + SQLite Fallback)
 * Sistema Integrado de Gestão e Avaliação SENAI
 */

require('dotenv').config();
const path = require('path');
const fs = require('fs');
const os = require('os');

const ROOT_DIR = path.resolve(__dirname, '..');
const DB_PATH = path.join(ROOT_DIR, 'database.sqlite');

const DB_TYPE = (process.env.DB_TYPE || (process.env.DB_HOST ? 'mysql' : 'sqlite')).toLowerCase();

let mysqlPool = null;
let sqliteDb = null;
let activeEngine = 'none';

// Inicialização do Pool MySQL
async function initMySQL() {
  const mysql = require('mysql2/promise');
  const host = process.env.DB_HOST || 'localhost';
  const port = parseInt(process.env.DB_PORT || '3306', 10);
  const user = process.env.DB_USER || 'root';
  const password = process.env.DB_PASSWORD || '';
  const database = process.env.DB_NAME || 'avaliacao_senai';

  try {
    // 1. Conexão administrativa para garantir que o banco de dados existe
    const adminConn = await mysql.createConnection({
      host,
      port,
      user,
      password,
      connectTimeout: 5000
    });
    await adminConn.query(`
      CREATE DATABASE IF NOT EXISTS \`${database}\`
      CHARACTER SET utf8mb4
      COLLATE utf8mb4_unicode_ci
    `);
    await adminConn.end();

    // 2. Criação do Pool de Conexões da aplicação
    mysqlPool = mysql.createPool({
      host,
      port,
      user,
      password,
      database,
      waitForConnections: true,
      connectionLimit: 15,
      queueLimit: 0,
      enableKeepAlive: true,
      keepAliveInitialDelay: 10000,
      timezone: '-03:00'
    });

    // Testar conexão
    const [rows] = await mysqlPool.query('SELECT 1 as connected');
    activeEngine = 'mysql';
    console.log(`[DATABASE] Conectado com sucesso ao MySQL em ${host}:${port}/${database}`);

    // Criar tabelas se não existirem
    await createMySQLTables();
    return true;
  } catch (err) {
    console.error(`[DATABASE] Falha ao conectar ao MySQL (${host}:${port}): ${err.message}`);
    return false;
  }
}

// Criação do Schema no MySQL
async function createMySQLTables() {
  if (!mysqlPool) return;

  const queries = [
    `CREATE TABLE IF NOT EXISTS \`users\` (
      \`id\` VARCHAR(64) NOT NULL,
      \`name\` VARCHAR(255) NOT NULL,
      \`cpf\` VARCHAR(64) NOT NULL,
      \`role\` VARCHAR(32) NOT NULL DEFAULT 'TEACHER',
      \`created_at\` DATETIME DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (\`id\`),
      UNIQUE KEY \`uk_users_cpf\` (\`cpf\`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

    `CREATE TABLE IF NOT EXISTS \`projetos\` (
      \`id\` VARCHAR(64) NOT NULL,
      \`titulo\` VARCHAR(255) NOT NULL,
      \`id_uc\` VARCHAR(64) DEFAULT NULL,
      \`id_turma\` VARCHAR(64) DEFAULT NULL,
      \`tipo_formacao\` VARCHAR(64) DEFAULT 'Individual',
      \`data_inicio\` VARCHAR(32) DEFAULT NULL,
      \`data_fim\` VARCHAR(32) DEFAULT NULL,
      \`descricao\` TEXT DEFAULT NULL,
      \`status\` VARCHAR(64) DEFAULT 'Planejado',
      \`created_at\` DATETIME DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (\`id\`),
      KEY \`idx_projetos_turma\` (\`id_turma\`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

    `CREATE TABLE IF NOT EXISTS \`timesheet\` (
      \`id\` VARCHAR(64) NOT NULL,
      \`id_aluno\` VARCHAR(64) NOT NULL,
      \`nome_aluno\` VARCHAR(255) NOT NULL,
      \`id_projeto\` VARCHAR(64) NOT NULL,
      \`nome_projeto\` VARCHAR(255) DEFAULT NULL,
      \`data\` VARCHAR(32) NOT NULL,
      \`hora_inicio\` VARCHAR(16) DEFAULT NULL,
      \`hora_fim\` VARCHAR(16) DEFAULT NULL,
      \`horas_totais\` VARCHAR(16) DEFAULT NULL,
      \`descricao_atividade\` TEXT DEFAULT NULL,
      \`link_evidencia\` TEXT DEFAULT NULL,
      \`status_entrega\` VARCHAR(64) DEFAULT 'Concluído',
      \`created_at\` DATETIME DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (\`id\`),
      KEY \`idx_timesheet_aluno\` (\`id_aluno\`),
      KEY \`idx_timesheet_projeto\` (\`id_projeto\`),
      KEY \`idx_timesheet_data\` (\`data\`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

    `CREATE TABLE IF NOT EXISTS \`app_state\` (
      \`key\` VARCHAR(64) NOT NULL,
      \`value\` LONGTEXT NOT NULL,
      \`updated_at\` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (\`key\`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

    `CREATE TABLE IF NOT EXISTS \`cursos\` (
      \`id\` VARCHAR(64) NOT NULL,
      \`nome\` VARCHAR(255) NOT NULL,
      \`tipo\` VARCHAR(64) NOT NULL DEFAULT 'FIC',
      \`carga_horaria\` INT DEFAULT 0,
      \`descricao\` TEXT DEFAULT NULL,
      \`ucs_padrao\` LONGTEXT DEFAULT NULL,
      \`created_at\` DATETIME DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (\`id\`),
      KEY \`idx_cursos_tipo\` (\`tipo\`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

    `CREATE TABLE IF NOT EXISTS \`atividades\` (
      \`id\` VARCHAR(64) NOT NULL,
      \`titulo\` VARCHAR(255) NOT NULL,
      \`id_turma\` VARCHAR(64) NOT NULL,
      \`id_uc\` VARCHAR(64) DEFAULT NULL,
      \`descricao\` LONGTEXT DEFAULT NULL,
      \`tipo_avaliacao\` VARCHAR(64) DEFAULT 'FORMATIVA',
      \`instrumento_avaliacao\` VARCHAR(64) DEFAULT 'RUBRICA_MSEP',
      \`peso\` DECIMAL(6,2) DEFAULT 1.00,
      \`exige_criticos\` TINYINT(1) DEFAULT 1,
      \`estrategia_desafiadora\` VARCHAR(128) DEFAULT 'Situação-Problema',
      \`estrategia_ensino\` VARCHAR(128) DEFAULT 'Atividade Prática',
      \`contextualizacao\` LONGTEXT DEFAULT NULL,
      \`desafio\` LONGTEXT DEFAULT NULL,
      \`resultados_esperados\` LONGTEXT DEFAULT NULL,
      \`data_entrega\` VARCHAR(64) DEFAULT NULL,
      \`pontuacao_total\` DECIMAL(6,2) DEFAULT 100.00,
      \`tem_criterios\` TINYINT(1) DEFAULT 1,
      \`criterios\` LONGTEXT DEFAULT NULL,
      \`modo_distribuicao\` VARCHAR(64) DEFAULT 'HIBRIDO',
      \`status\` VARCHAR(64) DEFAULT 'Aberta',
      \`created_at\` DATETIME DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (\`id\`),
      KEY \`idx_atividades_turma\` (\`id_turma\`),
      KEY \`idx_atividades_uc\` (\`id_uc\`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

    `CREATE TABLE IF NOT EXISTS \`entregas\` (
      \`id\` VARCHAR(64) NOT NULL,
      \`id_atividade\` VARCHAR(64) NOT NULL,
      \`id_turma\` VARCHAR(64) NOT NULL,
      \`id_aluno\` VARCHAR(64) NOT NULL,
      \`nome_aluno\` VARCHAR(255) DEFAULT NULL,
      \`re_aluno\` VARCHAR(64) DEFAULT NULL,
      \`data_entrega\` VARCHAR(64) DEFAULT NULL,
      \`link_evidencia\` TEXT DEFAULT NULL,
      \`texto_resposta\` LONGTEXT DEFAULT NULL,
      \`autoavaliacao\` LONGTEXT DEFAULT NULL,
      \`avaliacao_docente\` LONGTEXT DEFAULT NULL,
      \`parecer_reflexivo\` LONGTEXT DEFAULT NULL,
      \`nota_final\` DECIMAL(6,2) DEFAULT 0.00,
      \`criticos_atingidos\` TINYINT(1) DEFAULT 0,
      \`status\` VARCHAR(64) DEFAULT 'Pendente',
      \`created_at\` DATETIME DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (\`id\`),
      KEY \`idx_entregas_ativ\` (\`id_atividade\`),
      KEY \`idx_entregas_turma\` (\`id_turma\`),
      KEY \`idx_entregas_aluno\` (\`id_aluno\`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

    `CREATE TABLE IF NOT EXISTS \`cronogramas\` (
      \`id\` VARCHAR(64) NOT NULL,
      \`id_turma\` VARCHAR(64) NOT NULL,
      \`id_uc\` VARCHAR(64) DEFAULT NULL,
      \`semestre\` VARCHAR(64) DEFAULT NULL,
      \`docente_titular\` VARCHAR(255) DEFAULT NULL,
      \`dias_semana\` VARCHAR(128) DEFAULT NULL,
      \`data_inicio\` VARCHAR(32) DEFAULT NULL,
      \`data_fim\` VARCHAR(32) DEFAULT NULL,
      \`qa_total\` INT DEFAULT 60,
      \`matriz_aulas\` LONGTEXT DEFAULT NULL,
      \`niveis_desempenho\` LONGTEXT DEFAULT NULL,
      \`updated_at\` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (\`id\`),
      KEY \`idx_cronogramas_turma\` (\`id_turma\`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

    `CREATE TABLE IF NOT EXISTS \`user_passwords\` (
      \`user_key\` VARCHAR(128) NOT NULL,
      \`password\` VARCHAR(255) NOT NULL,
      \`updated_at\` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (\`user_key\`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`
  ];

  for (const q of queries) {
    try {
      await mysqlPool.query(q);
    } catch (e) {
      console.error('[DATABASE] Erro ao criar tabela MySQL:', e.message);
    }
  }
}

// Inicialização do SQLite (Fallback / Desenvolvimento Local)
function initSQLite() {
  const { DatabaseSync } = require('node:sqlite');
  try {
    sqliteDb = new DatabaseSync(DB_PATH);
    try { sqliteDb.exec('PRAGMA journal_mode = WAL;'); } catch (e) { }
  } catch (err) {
    try {
      const tmpPath = path.join(os.tmpdir(), 'database.sqlite');
      if (fs.existsSync(DB_PATH) && !fs.existsSync(tmpPath)) {
        try { fs.copyFileSync(DB_PATH, tmpPath); } catch (e) { }
      }
      sqliteDb = new DatabaseSync(tmpPath);
    } catch (e2) {
      try { sqliteDb = new DatabaseSync(':memory:'); } catch (e3) { sqliteDb = null; }
    }
  }

  if (sqliteDb) {
    sqliteDb.exec(`
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
        tipo_avaliacao TEXT DEFAULT 'FORMATIVA',
        instrumento_avaliacao TEXT DEFAULT 'RUBRICA_MSEP',
        peso NUMERIC DEFAULT 1,
        exige_criticos INTEGER DEFAULT 1,
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
        parecer_reflexivo TEXT,
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
      CREATE TABLE IF NOT EXISTS user_passwords (
        user_key TEXT PRIMARY KEY,
        password TEXT NOT NULL,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);
    activeEngine = 'sqlite';
    console.log('[DATABASE] SQLite nativo carregado com sucesso.');
  }
}

// Inicializador Principal
async function initDatabase() {
  if (DB_TYPE === 'mysql') {
    const success = await initMySQL();
    if (!success) {
      console.warn('[DATABASE] Fallback para SQLite devido à falha de conexão com MySQL...');
      initSQLite();
    }
  } else {
    initSQLite();
    if (!sqliteDb && process.env.DB_HOST) {
      console.warn('[DATABASE] SQLite indisponível, tentando conectar ao MySQL...');
      await initMySQL();
    }
  }

  return activeEngine;
}

// Interface Unificada de Consulta (SELECT)
async function query(sql, params = []) {
  if (activeEngine === 'mysql' && mysqlPool) {
    const [rows] = await mysqlPool.execute(sql, params);
    return rows;
  }

  if (activeEngine === 'sqlite' && sqliteDb) {
    const stmt = sqliteDb.prepare(sql);
    if (params && params.length > 0) {
      return stmt.all(...params);
    }
    return stmt.all();
  }

  throw new Error('Nenhum mecanismo de banco de dados ativo.');
}

// Interface Unificada de Execução (INSERT, UPDATE, DELETE, REPLACE)
async function execute(sql, params = []) {
  if (activeEngine === 'mysql' && mysqlPool) {
    const [result] = await mysqlPool.execute(sql, params);
    return {
      affectedRows: result.affectedRows,
      insertId: result.insertId
    };
  }

  if (activeEngine === 'sqlite' && sqliteDb) {
    const stmt = sqliteDb.prepare(sql);
    let result;
    if (params && params.length > 0) {
      result = stmt.run(...params);
    } else {
      result = stmt.run();
    }
    return {
      affectedRows: result ? result.changes : 0,
      insertId: result ? result.lastInsertRowid : null
    };
  }

  throw new Error('Nenhum mecanismo de banco de dados ativo.');
}

// Obter uma única linha
async function queryOne(sql, params = []) {
  const rows = await query(sql, params);
  return rows && rows.length > 0 ? rows[0] : null;
}

module.exports = {
  initDatabase,
  query,
  execute,
  queryOne,
  getEngine: () => activeEngine,
  getMySQLPool: () => mysqlPool,
  getSQLiteDb: () => sqliteDb
};

