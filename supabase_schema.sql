-- =========================================================================
-- ESQUEMA DO BANCO DE DADOS SUPABASE - SISTEMA INTEGRADO SENAI
-- Execute este script no "SQL Editor" do seu painel Supabase (supabase.com)
-- =========================================================================

-- 1. TABELA DE USUÁRIOS (Professores e Coordenadores)
CREATE TABLE IF NOT EXISTS public.senai_users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  cpf TEXT UNIQUE NOT NULL,
  role TEXT NOT NULL DEFAULT 'TEACHER',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.senai_users ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Acesso publico senai_users" ON public.senai_users;
CREATE POLICY "Acesso publico senai_users" ON public.senai_users FOR ALL USING (true) WITH CHECK (true);

-- 2. TABELA DE ESTADO GERAL (Turmas, Notas, Rubricas e Estudantes)
CREATE TABLE IF NOT EXISTS public.senai_app_state (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.senai_app_state ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Acesso publico senai_app_state" ON public.senai_app_state;
CREATE POLICY "Acesso publico senai_app_state" ON public.senai_app_state FOR ALL USING (true) WITH CHECK (true);

-- 3. TABELA DE PROJETOS
CREATE TABLE IF NOT EXISTS public.senai_projetos (
  id TEXT PRIMARY KEY,
  titulo TEXT NOT NULL,
  id_uc TEXT,
  id_turma TEXT,
  tipo_formacao TEXT,
  data_inicio TEXT,
  data_fim TEXT,
  descricao TEXT,
  status TEXT DEFAULT 'Aberto',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.senai_projetos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Acesso publico senai_projetos" ON public.senai_projetos;
CREATE POLICY "Acesso publico senai_projetos" ON public.senai_projetos FOR ALL USING (true) WITH CHECK (true);

-- 4. TABELA DE TIMESHEET (Apontamento de Horas)
CREATE TABLE IF NOT EXISTS public.senai_timesheet (
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
  status_entrega TEXT DEFAULT 'Concluído',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.senai_timesheet ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Acesso publico senai_timesheet" ON public.senai_timesheet;
CREATE POLICY "Acesso publico senai_timesheet" ON public.senai_timesheet FOR ALL USING (true) WITH CHECK (true);

-- 5. TABELA DE CURSOS SENAI (FIC, Técnico e CAI)
CREATE TABLE IF NOT EXISTS public.senai_cursos (
  id TEXT PRIMARY KEY,
  nome TEXT NOT NULL,
  tipo TEXT NOT NULL, -- 'FIC', 'TECNICO', 'CAI'
  carga_horaria INT DEFAULT 0,
  descricao TEXT,
  ucs_padrao JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.senai_cursos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Acesso publico senai_cursos" ON public.senai_cursos;
CREATE POLICY "Acesso publico senai_cursos" ON public.senai_cursos FOR ALL USING (true) WITH CHECK (true);

-- 6. TABELA DE ATIVIDADES PEDAGÓGICAS
CREATE TABLE IF NOT EXISTS public.senai_atividades (
  id TEXT PRIMARY KEY,
  titulo TEXT NOT NULL,
  id_turma TEXT NOT NULL,
  id_uc TEXT,
  descricao TEXT,
  data_entrega TEXT,
  pontuacao_total NUMERIC DEFAULT 100,
  tem_criterios BOOLEAN DEFAULT true,
  criterios JSONB DEFAULT '[]'::jsonb,
  modo_distribuicao TEXT DEFAULT 'HIBRIDO', -- 'RE', 'CLASSROOM', 'HIBRIDO'
  status TEXT DEFAULT 'Aberta',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.senai_atividades ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Acesso publico senai_atividades" ON public.senai_atividades;
CREATE POLICY "Acesso publico senai_atividades" ON public.senai_atividades FOR ALL USING (true) WITH CHECK (true);

-- 7. TABELA DE ENTREGAS, AUTOAVALIAÇÃO E HETEROAVALIAÇÃO
CREATE TABLE IF NOT EXISTS public.senai_entregas (
  id TEXT PRIMARY KEY,
  id_atividade TEXT NOT NULL,
  id_turma TEXT NOT NULL,
  id_aluno TEXT NOT NULL,
  nome_aluno TEXT,
  re_aluno TEXT,
  data_entrega TIMESTAMPTZ DEFAULT NOW(),
  link_evidencia TEXT,
  texto_resposta TEXT,
  autoavaliacao JSONB DEFAULT '{}'::jsonb,
  avaliacao_docente JSONB DEFAULT '{}'::jsonb,
  nota_final NUMERIC DEFAULT 0,
  criticos_atingidos BOOLEAN DEFAULT false,
  status TEXT DEFAULT 'Pendente', -- 'Pendente', 'Entregue', 'Avaliado'
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.senai_entregas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Acesso publico senai_entregas" ON public.senai_entregas;
CREATE POLICY "Acesso publico senai_entregas" ON public.senai_entregas FOR ALL USING (true) WITH CHECK (true);

-- 8. TABELA DE CRONOGRAMA DE SITUAÇÃO DE APRENDIZAGEM - MSEP (8.50 FR 93)
CREATE TABLE IF NOT EXISTS public.senai_cronogramas (
  id TEXT PRIMARY KEY,
  id_turma TEXT NOT NULL,
  id_uc TEXT,
  semestre TEXT,
  docente_titular TEXT,
  dias_semana TEXT,
  data_inicio TEXT,
  data_fim TEXT,
  qa_total INT DEFAULT 60,
  matriz_aulas JSONB DEFAULT '{}'::jsonb,
  niveis_desempenho JSONB DEFAULT '[]'::jsonb,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.senai_cronogramas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Acesso publico senai_cronogramas" ON public.senai_cronogramas;
CREATE POLICY "Acesso publico senai_cronogramas" ON public.senai_cronogramas FOR ALL USING (true) WITH CHECK (true);

-- 9. CARGA INICIAL DE USUÁRIOS OFICIAIS SENAI
INSERT INTO public.senai_users (id, name, cpf, role) VALUES
  ('1', 'Heber Roberto Ferreira', '1080133', 'TEACHER'),
  ('2', 'Rafael Forti Scalfi', '222.222.222-22', 'TEACHER'),
  ('3', 'Prof. Bruno', '1021529', 'TEACHER'),
  ('4', 'Coordenador Pedagógico', '000.000.000-00', 'ADMIN')
ON CONFLICT (cpf) DO NOTHING;

-- 10. HABILITAR SINCRONIZAÇÃO EM TEMPO REAL (REALTIME)
ALTER PUBLICATION supabase_realtime ADD TABLE public.senai_users;
ALTER PUBLICATION supabase_realtime ADD TABLE public.senai_app_state;
ALTER PUBLICATION supabase_realtime ADD TABLE public.senai_projetos;
ALTER PUBLICATION supabase_realtime ADD TABLE public.senai_timesheet;
ALTER PUBLICATION supabase_realtime ADD TABLE public.senai_cursos;
ALTER PUBLICATION supabase_realtime ADD TABLE public.senai_atividades;
ALTER PUBLICATION supabase_realtime ADD TABLE public.senai_entregas;
ALTER PUBLICATION supabase_realtime ADD TABLE public.senai_cronogramas;
