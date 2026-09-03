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

-- 5. CARGA INICIAL DE USUÁRIOS OFICIAIS SENAI
INSERT INTO public.senai_users (id, name, cpf, role) VALUES
  ('1', 'Heber Roberto Ferreira', '1080133', 'TEACHER'),
  ('2', 'Rafael Forti Scalfi', '222.222.222-22', 'TEACHER'),
  ('3', 'Prof. Bruno', '1021529', 'TEACHER'),
  ('4', 'Coordenador Pedagógico', '000.000.000-00', 'ADMIN')
ON CONFLICT (cpf) DO NOTHING;

-- 6. HABILITAR SINCRONIZAÇÃO EM TEMPO REAL (REALTIME)
ALTER PUBLICATION supabase_realtime ADD TABLE public.senai_users;
ALTER PUBLICATION supabase_realtime ADD TABLE public.senai_app_state;
ALTER PUBLICATION supabase_realtime ADD TABLE public.senai_projetos;
ALTER PUBLICATION supabase_realtime ADD TABLE public.senai_timesheet;
