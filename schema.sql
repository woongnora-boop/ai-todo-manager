-- =============================================================================
-- AI Todo Manager — Supabase 스키마 (PRD 데이터 구조 기준)
-- Supabase SQL Editor 또는 psql에서 그대로 실행 가능
-- =============================================================================

-- 우선순위 enum (high / medium / low)
CREATE TYPE public.todo_priority AS ENUM ('high', 'medium', 'low');

-- -----------------------------------------------------------------------------
-- public.users: auth.users(id)와 1:1 프로필
-- -----------------------------------------------------------------------------
CREATE TABLE public.users (
  id UUID NOT NULL PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  email TEXT,
  full_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.users IS 'Supabase Auth 사용자와 1:1 프로필';

-- -----------------------------------------------------------------------------
-- public.todos: 사용자별 할 일 (PRD 필드)
-- -----------------------------------------------------------------------------
CREATE TABLE public.todos (
  id UUID NOT NULL PRIMARY KEY DEFAULT gen_random_uuid (),
  user_id UUID NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  created_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  due_date TIMESTAMPTZ,
  priority public.todo_priority NOT NULL DEFAULT 'medium',
  category_id UUID,
  completed BOOLEAN NOT NULL DEFAULT FALSE
);

COMMENT ON TABLE public.todos IS '할 일 CRUD';
COMMENT ON COLUMN public.todos.created_date IS '생성일';
COMMENT ON COLUMN public.todos.due_date IS '마감일';
COMMENT ON COLUMN public.todos.category_id IS '카테고리 FK(별도 테이블 연결 시 사용, 현재는 nullable UUID)';

CREATE INDEX idx_todos_user_id ON public.todos (user_id);
CREATE INDEX idx_todos_user_due ON public.todos (user_id, due_date);

-- -----------------------------------------------------------------------------
-- 신규 가입 시 auth.users → public.users 자동 생성 (1:1 유지)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user ()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
  AS $$
BEGIN
  INSERT INTO public.users (id, email)
    VALUES (NEW.id, NEW.email);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user ();

-- -----------------------------------------------------------------------------
-- RLS 활성화
-- -----------------------------------------------------------------------------
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.todos ENABLE ROW LEVEL SECURITY;

-- public.users: 본인 행만 읽기/쓰기
CREATE POLICY "users_select_own"
  ON public.users
  FOR SELECT
  TO authenticated
  USING (auth.uid () = id);

CREATE POLICY "users_insert_own"
  ON public.users
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid () = id);

CREATE POLICY "users_update_own"
  ON public.users
  FOR UPDATE
  TO authenticated
  USING (auth.uid () = id)
  WITH CHECK (auth.uid () = id);

CREATE POLICY "users_delete_own"
  ON public.users
  FOR DELETE
  TO authenticated
  USING (auth.uid () = id);

-- public.todos: 본인 user_id 행만 읽기/쓰기
CREATE POLICY "todos_select_own"
  ON public.todos
  FOR SELECT
  TO authenticated
  USING (auth.uid () = user_id);

CREATE POLICY "todos_insert_own"
  ON public.todos
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid () = user_id);

CREATE POLICY "todos_update_own"
  ON public.todos
  FOR UPDATE
  TO authenticated
  USING (auth.uid () = user_id)
  WITH CHECK (auth.uid () = user_id);

CREATE POLICY "todos_delete_own"
  ON public.todos
  FOR DELETE
  TO authenticated
  USING (auth.uid () = user_id);

-- -----------------------------------------------------------------------------
-- 역할 권한 (Supabase 클라이언트용)
-- -----------------------------------------------------------------------------
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.users TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.todos TO authenticated;

GRANT ALL ON TABLE public.users TO service_role;
GRANT ALL ON TABLE public.todos TO service_role;

GRANT USAGE ON TYPE public.todo_priority TO authenticated, service_role;
