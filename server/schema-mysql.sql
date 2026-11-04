-- =============================================================================
-- ESQUEMA DO BANCO DE DADOS MYSQL - SISTEMA DE AVALIAÇÃO SENAI
-- Metodologia SENAI de Educação Profissional (MSEP)
-- =============================================================================

CREATE DATABASE IF NOT EXISTS `avaliacao_senai`
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE `avaliacao_senai`;

-- 1. Tabela de Usuários (Docentes, Coordenadores, Alunos)
CREATE TABLE IF NOT EXISTS `users` (
  `id` VARCHAR(64) NOT NULL,
  `name` VARCHAR(255) NOT NULL,
  `cpf` VARCHAR(64) NOT NULL,
  `role` VARCHAR(32) NOT NULL DEFAULT 'TEACHER',
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_users_cpf` (`cpf`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Tabela de Projetos Integradores / Situações de Aprendizagem
CREATE TABLE IF NOT EXISTS `projetos` (
  `id` VARCHAR(64) NOT NULL,
  `titulo` VARCHAR(255) NOT NULL,
  `id_uc` VARCHAR(64) DEFAULT NULL,
  `id_turma` VARCHAR(64) DEFAULT NULL,
  `tipo_formacao` VARCHAR(64) DEFAULT 'Individual',
  `data_inicio` VARCHAR(32) DEFAULT NULL,
  `data_fim` VARCHAR(32) DEFAULT NULL,
  `descricao` TEXT DEFAULT NULL,
  `status` VARCHAR(64) DEFAULT 'Planejado',
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_projetos_turma` (`id_turma`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. Tabela de Timesheet / Acompanhamento de Atividades de Alunos
CREATE TABLE IF NOT EXISTS `timesheet` (
  `id` VARCHAR(64) NOT NULL,
  `id_aluno` VARCHAR(64) NOT NULL,
  `nome_aluno` VARCHAR(255) NOT NULL,
  `id_projeto` VARCHAR(64) NOT NULL,
  `nome_projeto` VARCHAR(255) DEFAULT NULL,
  `data` VARCHAR(32) NOT NULL,
  `hora_inicio` VARCHAR(16) DEFAULT NULL,
  `hora_fim` VARCHAR(16) DEFAULT NULL,
  `horas_totais` VARCHAR(16) DEFAULT NULL,
  `descricao_atividade` TEXT DEFAULT NULL,
  `link_evidencia` TEXT DEFAULT NULL,
  `status_entrega` VARCHAR(64) DEFAULT 'Concluído',
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_timesheet_aluno` (`id_aluno`),
  KEY `idx_timesheet_projeto` (`id_projeto`),
  KEY `idx_timesheet_data` (`data`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. Tabela de Estado Geral da Aplicação (Sincronização / Backup)
CREATE TABLE IF NOT EXISTS `app_state` (
  `key` VARCHAR(64) NOT NULL,
  `value` LONGTEXT NOT NULL,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5. Tabela de Cursos SENAI (FIC, Técnico, CAI)
CREATE TABLE IF NOT EXISTS `cursos` (
  `id` VARCHAR(64) NOT NULL,
  `nome` VARCHAR(255) NOT NULL,
  `tipo` VARCHAR(64) NOT NULL DEFAULT 'FIC',
  `carga_horaria` INT DEFAULT 0,
  `descricao` TEXT DEFAULT NULL,
  `ucs_padrao` LONGTEXT DEFAULT NULL,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_cursos_tipo` (`tipo`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 6. Tabela de Atividades Pedagógicas e Avaliações Formatória/Somativa MSEP
CREATE TABLE IF NOT EXISTS `atividades` (
  `id` VARCHAR(64) NOT NULL,
  `titulo` VARCHAR(255) NOT NULL,
  `id_turma` VARCHAR(64) NOT NULL,
  `id_uc` VARCHAR(64) DEFAULT NULL,
  `descricao` LONGTEXT DEFAULT NULL,
  `tipo_avaliacao` VARCHAR(64) DEFAULT 'FORMATIVA',
  `instrumento_avaliacao` VARCHAR(64) DEFAULT 'RUBRICA_MSEP',
  `peso` DECIMAL(6,2) DEFAULT 1.00,
  `exige_criticos` TINYINT(1) DEFAULT 1,
  `estrategia_desafiadora` VARCHAR(128) DEFAULT 'Situação-Problema',
  `estrategia_ensino` VARCHAR(128) DEFAULT 'Atividade Prática',
  `contextualizacao` LONGTEXT DEFAULT NULL,
  `desafio` LONGTEXT DEFAULT NULL,
  `resultados_esperados` LONGTEXT DEFAULT NULL,
  `data_entrega` VARCHAR(64) DEFAULT NULL,
  `pontuacao_total` DECIMAL(6,2) DEFAULT 100.00,
  `tem_criterios` TINYINT(1) DEFAULT 1,
  `criterios` LONGTEXT DEFAULT NULL,
  `modo_distribuicao` VARCHAR(64) DEFAULT 'HIBRIDO',
  `status` VARCHAR(64) DEFAULT 'Aberta',
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_atividades_turma` (`id_turma`),
  KEY `idx_atividades_uc` (`id_uc`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 7. Tabela de Entregas, Autoavaliações e Avaliações Docente
CREATE TABLE IF NOT EXISTS `entregas` (
  `id` VARCHAR(64) NOT NULL,
  `id_atividade` VARCHAR(64) NOT NULL,
  `id_turma` VARCHAR(64) NOT NULL,
  `id_aluno` VARCHAR(64) NOT NULL,
  `nome_aluno` VARCHAR(255) DEFAULT NULL,
  `re_aluno` VARCHAR(64) DEFAULT NULL,
  `data_entrega` VARCHAR(64) DEFAULT NULL,
  `link_evidencia` TEXT DEFAULT NULL,
  `texto_resposta` LONGTEXT DEFAULT NULL,
  `autoavaliacao` LONGTEXT DEFAULT NULL,
  `avaliacao_docente` LONGTEXT DEFAULT NULL,
  `parecer_reflexivo` LONGTEXT DEFAULT NULL,
  `nota_final` DECIMAL(6,2) DEFAULT 0.00,
  `criticos_atingidos` TINYINT(1) DEFAULT 0,
  `status` VARCHAR(64) DEFAULT 'Pendente',
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_entregas_ativ` (`id_atividade`),
  KEY `idx_entregas_turma` (`id_turma`),
  KEY `idx_entregas_aluno` (`id_aluno`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 8. Tabela de Cronogramas MSEP (8.50 FR 93) e Níveis de Desempenho
CREATE TABLE IF NOT EXISTS `cronogramas` (
  `id` VARCHAR(64) NOT NULL,
  `id_turma` VARCHAR(64) NOT NULL,
  `id_uc` VARCHAR(64) DEFAULT NULL,
  `semestre` VARCHAR(64) DEFAULT NULL,
  `docente_titular` VARCHAR(255) DEFAULT NULL,
  `dias_semana` VARCHAR(128) DEFAULT NULL,
  `data_inicio` VARCHAR(32) DEFAULT NULL,
  `data_fim` VARCHAR(32) DEFAULT NULL,
  `qa_total` INT DEFAULT 60,
  `matriz_aulas` LONGTEXT DEFAULT NULL,
  `niveis_desempenho` LONGTEXT DEFAULT NULL,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_cronogramas_turma` (`id_turma`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 9. Tabela de Senhas Personalizadas de Usuários (Admin, Docentes e Alunos)
CREATE TABLE IF NOT EXISTS `user_passwords` (
  `user_key` VARCHAR(128) NOT NULL,
  `password` VARCHAR(255) NOT NULL,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`user_key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 10. Tabela de Auditoria e Governança Algorítmica Educacional (MIGAE - Ferreira, 2026)
CREATE TABLE IF NOT EXISTS `migae_audit_logs` (
  `id` VARCHAR(64) NOT NULL,
  `evento` VARCHAR(64) NOT NULL,
  `ator` VARCHAR(128) DEFAULT NULL,
  `hash_integridade` VARCHAR(64) NOT NULL,
  `metadados_manifestos` LONGTEXT DEFAULT NULL,
  `status_n8n` VARCHAR(64) DEFAULT 'REGISTRADO_MYSQL',
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_migae_evento` (`evento`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;



