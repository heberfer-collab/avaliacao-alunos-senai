/**
 * Script de Migração Automatizada: SQLite / JSONs -> MySQL
 * Sistema de Avaliação SENAI
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

const ROOT_DIR = path.resolve(__dirname, '..');
const DB_PATH = path.join(ROOT_DIR, 'database.sqlite');

async function runMigration() {
  console.log('=====================================================');
  console.log('🚀 INICIANDO MIGRAÇÃO DE DADOS PARA MYSQL (SENAI MSEP)');
  console.log('=====================================================');

  const host = process.env.DB_HOST || 'localhost';
  const port = parseInt(process.env.DB_PORT || '3306', 10);
  const user = process.env.DB_USER || 'root';
  const password = process.env.DB_PASSWORD || '';
  const database = process.env.DB_NAME || 'avaliacao_senai';

  console.log(`📡 Conectando ao MySQL em ${host}:${port}...`);

  let conn;
  try {
    // Garantir que a base de dados exista
    conn = await mysql.createConnection({ host, port, user, password });
    await conn.query(`CREATE DATABASE IF NOT EXISTS \`${database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
    await conn.query(`USE \`${database}\``);
    console.log(`✅ Base de dados '${database}' pronta no MySQL.`);
  } catch (err) {
    console.error(`❌ Erro fatal ao conectar ao MySQL: ${err.message}`);
    process.exit(1);
  }

  // Executar schema DDL
  const schemaPath = path.join(ROOT_DIR, 'server', 'schema-mysql.sql');
  if (fs.existsSync(schemaPath)) {
    const ddl = fs.readFileSync(schemaPath, 'utf8');
    const statements = ddl.split(';').map(s => s.trim()).filter(s => s.length > 0);
    for (const stmt of statements) {
      try {
        await conn.query(stmt);
      } catch (e) {
        // Ignora erros menores de comentário ou use
      }
    }
    console.log('✅ Tabelas MySQL criadas/verificadas com sucesso.');
  }

  // Tentar abrir SQLite
  let sqliteDb = null;
  try {
    const { DatabaseSync } = require('node:sqlite');
    if (fs.existsSync(DB_PATH)) {
      sqliteDb = new DatabaseSync(DB_PATH);
      console.log('📂 Banco SQLite local localizado e aberto.');
    }
  } catch (e) {
    console.log('ℹ️ SQLite nativo não disponível, lendo fontes JSON diretamente.');
  }

  function readJson(filename) {
    const fullPath = path.join(ROOT_DIR, filename);
    if (fs.existsSync(fullPath)) {
      try {
        return JSON.parse(fs.readFileSync(fullPath, 'utf8'));
      } catch (e) {
        return [];
      }
    }
    return [];
  }

  // 1. Migração de Users
  let users = [];
  if (sqliteDb) {
    try { users = sqliteDb.prepare('SELECT * FROM users').all(); } catch (e) {}
  }
  if (!users.length) users = readJson('users_data.json');
  console.log(`\n👤 Migrando Usuários (${users.length} registros)...`);
  for (const u of users) {
    await conn.execute(
      `REPLACE INTO \`users\` (id, name, cpf, role, created_at) VALUES (?, ?, ?, ?, ?)`,
      [String(u.id), u.name, u.cpf, u.role || 'TEACHER', u.created_at || new Date()]
    );
  }
  console.log(`   ✔️ ${users.length} usuários migrados.`);

  // 2. Migração de Projetos
  let projetos = [];
  if (sqliteDb) {
    try { projetos = sqliteDb.prepare('SELECT * FROM projetos').all(); } catch (e) {}
  }
  if (!projetos.length) projetos = readJson('projetos_data.json');
  console.log(`\n📁 Migrando Projetos (${projetos.length} registros)...`);
  for (const p of projetos) {
    await conn.execute(
      `REPLACE INTO \`projetos\` (id, titulo, id_uc, id_turma, tipo_formacao, data_inicio, data_fim, descricao, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [String(p.id), p.titulo, p.id_uc || '', p.id_turma || '', p.tipo_formacao || 'Individual', p.data_inicio || '', p.data_fim || '', p.descricao || '', p.status || 'Planejado', p.created_at || new Date()]
    );
  }
  console.log(`   ✔️ ${projetos.length} projetos migrados.`);

  // 3. Migração de Timesheet
  let timesheet = [];
  if (sqliteDb) {
    try { timesheet = sqliteDb.prepare('SELECT * FROM timesheet').all(); } catch (e) {}
  }
  if (!timesheet.length) timesheet = readJson('timesheet_data.json');
  console.log(`\n⏱️ Migrando Timesheet (${timesheet.length} registros)...`);
  for (const t of timesheet) {
    await conn.execute(
      `REPLACE INTO \`timesheet\` (id, id_aluno, nome_aluno, id_projeto, nome_projeto, data, hora_inicio, hora_fim, horas_totais, descricao_atividade, link_evidencia, status_entrega, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [String(t.id), String(t.id_aluno), t.nome_aluno, String(t.id_projeto), t.nome_projeto || '', t.data, t.hora_inicio || '', t.hora_fim || '', t.horas_totais || '', t.descricao_atividade || '', t.link_evidencia || '', t.status_entrega || 'Concluído', t.created_at || new Date()]
    );
  }
  console.log(`   ✔️ ${timesheet.length} lançamentos de timesheet migrados.`);

  // 4. Migração de Cursos
  let cursos = [];
  if (sqliteDb) {
    try { cursos = sqliteDb.prepare('SELECT * FROM cursos').all(); } catch (e) {}
  }
  if (!cursos.length) cursos = readJson('cursos_data.json');
  console.log(`\n📚 Migrando Cursos SENAI (${cursos.length} registros)...`);
  for (const c of cursos) {
    const ucsStr = typeof c.ucs_padrao === 'string' ? c.ucs_padrao : JSON.stringify(c.ucs_padrao || []);
    await conn.execute(
      `REPLACE INTO \`cursos\` (id, nome, tipo, carga_horaria, descricao, ucs_padrao, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [String(c.id), c.nome, c.tipo || 'FIC', Number(c.carga_horaria) || 0, c.descricao || '', ucsStr, c.created_at || new Date()]
    );
  }
  console.log(`   ✔️ ${cursos.length} cursos migrados.`);

  // 5. Migração de Atividades
  let atividades = [];
  if (sqliteDb) {
    try { atividades = sqliteDb.prepare('SELECT * FROM atividades').all(); } catch (e) {}
  }
  if (!atividades.length) atividades = readJson('atividades_data.json');
  console.log(`\n📋 Migrando Atividades Pedagógicas (${atividades.length} registros)...`);
  for (const a of atividades) {
    const critStr = typeof a.criterios === 'string' ? a.criterios : JSON.stringify(a.criterios || []);
    await conn.execute(
      `REPLACE INTO \`atividades\` (
        id, titulo, id_turma, id_uc, descricao,
        tipo_avaliacao, instrumento_avaliacao, peso, exige_criticos,
        estrategia_desafiadora, estrategia_ensino, contextualizacao, desafio, resultados_esperados,
        data_entrega, pontuacao_total, tem_criterios, criterios, modo_distribuicao, status, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        String(a.id),
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
        a.status || 'Aberta',
        a.created_at || new Date()
      ]
    );
  }
  console.log(`   ✔️ ${atividades.length} atividades migradas.`);

  // 6. Migração de Entregas
  let entregas = [];
  if (sqliteDb) {
    try { entregas = sqliteDb.prepare('SELECT * FROM entregas').all(); } catch (e) {}
  }
  if (!entregas.length) entregas = readJson('entregas_data.json');
  console.log(`\n📝 Migrando Entregas & Avaliações (${entregas.length} registros)...`);
  for (const en of entregas) {
    const autoStr = typeof en.autoavaliacao === 'string' ? en.autoavaliacao : JSON.stringify(en.autoavaliacao || {});
    const docStr = typeof en.avaliacao_docente === 'string' ? en.avaliacao_docente : JSON.stringify(en.avaliacao_docente || {});
    await conn.execute(
      `REPLACE INTO \`entregas\` (
        id, id_atividade, id_turma, id_aluno, nome_aluno, re_aluno, data_entrega,
        link_evidencia, texto_resposta, autoavaliacao, avaliacao_docente, parecer_reflexivo,
        nota_final, criticos_atingidos, status, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        String(en.id),
        String(en.id_atividade),
        String(en.id_turma || ''),
        String(en.id_aluno),
        en.nome_aluno || '',
        en.re_aluno || '',
        en.data_entrega || '',
        en.link_evidencia || '',
        en.texto_resposta || '',
        autoStr,
        docStr,
        en.parecer_reflexivo || '',
        Number(en.nota_final) || 0,
        en.criticos_atingidos ? 1 : 0,
        en.status || 'Pendente',
        en.created_at || new Date()
      ]
    );
  }
  console.log(`   ✔️ ${entregas.length} entregas migradas.`);

  // 7. Migração de Cronogramas
  let cronogramas = [];
  if (sqliteDb) {
    try { cronogramas = sqliteDb.prepare('SELECT * FROM cronogramas').all(); } catch (e) {}
  }
  if (!cronogramas.length) cronogramas = readJson('cronogramas_data.json');
  console.log(`\n📅 Migrando Cronogramas MSEP (${cronogramas.length} registros)...`);
  for (const c of cronogramas) {
    const matrizStr = typeof c.matriz_aulas === 'string' ? c.matriz_aulas : JSON.stringify(c.matriz_aulas || {});
    const niveisStr = typeof c.niveis_desempenho === 'string' ? c.niveis_desempenho : JSON.stringify(c.niveis_desempenho || []);
    await conn.execute(
      `REPLACE INTO \`cronogramas\` (
        id, id_turma, id_uc, semestre, docente_titular, dias_semana, data_inicio, data_fim, qa_total, matriz_aulas, niveis_desempenho
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        String(c.id),
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
  }
  console.log(`   ✔️ ${cronogramas.length} cronogramas migrados.`);

  // 8. Migração de App State
  if (sqliteDb) {
    try {
      const appState = sqliteDb.prepare('SELECT * FROM app_state').all();
      for (const s of appState) {
        await conn.execute(
          `REPLACE INTO \`app_state\` (\`key\`, \`value\`) VALUES (?, ?)`,
          [s.key, s.value]
        );
      }
      console.log(`\n💾 Estado geral da aplicação migrado.`);
    } catch (e) {}
  }

  await conn.end();
  console.log('\n=====================================================');
  console.log('🎉 MIGRAÇÃO CONCLUÍDA COM SUCESSO NO MYSQL!');
  console.log('=====================================================');
}

runMigration().catch(err => {
  console.error('Falha na migração:', err);
  process.exit(1);
});

