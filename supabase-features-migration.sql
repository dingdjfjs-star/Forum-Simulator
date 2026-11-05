-- ============================================================
-- 论坛功能扩展迁移（幂等，可重复运行，不影响任何现有数据）
-- 在 Supabase SQL Editor 中完整运行一次即可
--
-- 新增能力：
--   1. posts 扩展：series_id（所属连载）/ chapter_no（章节号）/ image_urls（配图）
--   2. series 连载表（CP 区、创作区可分章连载）
--   3. admin_logs 操作日志表（坛主操作留痕）
--   4. profiles.bio 个人简介
--   5. 修复 register_user 未写入会话表的 bug（之前注册后令牌无效、发不了帖）
--   6. set_user_role / admin_delete_user 自动写操作日志
--   7. Storage 图片桶 forum-images（帖子配图）
-- ============================================================

-- ---------- 1) posts 扩展 ----------
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS series_id uuid;
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS chapter_no int;
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS image_urls text[] DEFAULT '{}';

-- ---------- 2) 连载表 ----------
CREATE TABLE IF NOT EXISTS public.series (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text DEFAULT '',
  board text DEFAULT 'cp',
  tags text[] DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE public.series ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "series_select" ON public.series;
DROP POLICY IF EXISTS "series_insert_own" ON public.series;
DROP POLICY IF EXISTS "series_update_own" ON public.series;
DROP POLICY IF EXISTS "series_delete_own_or_admin" ON public.series;

CREATE POLICY "series_select" ON public.series
  FOR SELECT USING (true);
CREATE POLICY "series_insert_own" ON public.series
  FOR INSERT WITH CHECK (author_id = public.current_forum_user_id());
CREATE POLICY "series_update_own" ON public.series
  FOR UPDATE
  USING (author_id = public.current_forum_user_id())
  WITH CHECK (author_id = public.current_forum_user_id());
CREATE POLICY "series_delete_own_or_admin" ON public.series
  FOR DELETE USING (
    author_id = public.current_forum_user_id()
    OR public.is_forum_admin()
  );

-- ---------- 3) 操作日志表 ----------
CREATE TABLE IF NOT EXISTS public.admin_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  actor_name text DEFAULT '',
  action text NOT NULL,
  detail text DEFAULT '',
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.admin_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_logs_select" ON public.admin_logs;
DROP POLICY IF EXISTS "admin_logs_insert" ON public.admin_logs;
-- 只有坛主能看日志、写日志
CREATE POLICY "admin_logs_select" ON public.admin_logs
  FOR SELECT USING (public.is_forum_admin());
CREATE POLICY "admin_logs_insert" ON public.admin_logs
  FOR INSERT WITH CHECK (public.is_forum_admin());

-- ---------- 4) profiles.bio 个人简介 ----------
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS bio text DEFAULT '';

-- ---------- 5) 修复 register_user：注册即建立会话 ----------
--   之前的版本签发了 token 却没有写入 sessions 表，
--   导致新用户注册后处于"假登录"状态（发帖/回复会被 RLS 拒绝）。
CREATE OR REPLACE FUNCTION public.register_user(p_username text, p_password text, p_avatar text DEFAULT '😊')
RETURNS json
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_id uuid;
  v_token text;
  v_avatar text := COALESCE(nullif(trim(p_avatar), ''), '😊');
BEGIN
  p_username := trim(p_username);
  IF p_username IS NULL OR length(p_username) < 1 OR length(p_username) > 20 THEN
    RAISE EXCEPTION '用户名需为 1-20 个字符';
  END IF;
  IF p_password IS NULL OR length(p_password) < 3 THEN
    RAISE EXCEPTION '密码至少需要 3 位';
  END IF;
  IF EXISTS (SELECT 1 FROM public.profiles WHERE username = p_username) THEN
    RAISE EXCEPTION '用户名已被占用';
  END IF;

  INSERT INTO public.profiles (username, password, avatar, role)
  VALUES (p_username, crypt(p_password, gen_salt('bf', 10)), v_avatar, 'user')
  RETURNING id INTO v_id;

  -- 关键修复：真正建立服务端会话
  v_token := encode(gen_random_bytes(32), 'hex');
  INSERT INTO public.sessions (token, user_id, expires_at)
  VALUES (v_token, v_id, now() + interval '30 days');

  RETURN json_build_object(
    'id', v_id,
    'username', p_username,
    'avatar', v_avatar,
    'role', 'user',
    'token', v_token
  );
END $$;

-- ---------- 6) 坛主操作自动写日志 ----------
CREATE OR REPLACE FUNCTION public.set_user_role(p_user_id uuid, p_role text)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_target text;
  v_actor uuid;
BEGIN
  IF NOT public.is_forum_admin() THEN
    RAISE EXCEPTION '仅坛主可以执行此操作';
  END IF;
  IF p_role NOT IN ('admin', 'user') THEN
    RAISE EXCEPTION '无效的角色';
  END IF;

  SELECT username INTO v_target FROM public.profiles WHERE id = p_user_id;
  v_actor := public.current_forum_user_id();

  UPDATE public.profiles SET role = p_role WHERE id = p_user_id;

  INSERT INTO public.admin_logs (actor_id, actor_name, action, detail)
  SELECT v_actor, p.username, 'set_role',
         format('把「%s」%s', COALESCE(v_target, p_user_id::text),
                CASE WHEN p_role = 'admin' THEN '设为坛主' ELSE '取消坛主' END)
  FROM public.profiles p WHERE p.id = v_actor;
END $$;

CREATE OR REPLACE FUNCTION public.admin_delete_user(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_target text;
  v_actor uuid;
BEGIN
  IF NOT public.is_forum_admin() THEN
    RAISE EXCEPTION '仅坛主可以执行此操作';
  END IF;
  IF p_user_id = public.current_forum_user_id() THEN
    RAISE EXCEPTION '不能删除自己';
  END IF;

  SELECT username INTO v_target FROM public.profiles WHERE id = p_user_id;
  v_actor := public.current_forum_user_id();

  DELETE FROM public.profiles WHERE id = p_user_id;

  INSERT INTO public.admin_logs (actor_id, actor_name, action, detail)
  SELECT v_actor, p.username, 'delete_user',
         format('删除了用户「%s」', COALESCE(v_target, p_user_id::text))
  FROM public.profiles p WHERE p.id = v_actor;
END $$;

-- 通用日志接口（供前端记录"删帖"等操作）
CREATE OR REPLACE FUNCTION public.admin_log(p_action text, p_detail text DEFAULT '')
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT public.is_forum_admin() THEN
    RAISE EXCEPTION '仅坛主可以执行此操作';
  END IF;
  INSERT INTO public.admin_logs (actor_id, actor_name, action, detail)
  SELECT public.current_forum_user_id(), p.username, p_action, p_detail
  FROM public.profiles p WHERE p.id = public.current_forum_user_id();
END $$;

GRANT EXECUTE ON FUNCTION public.register_user(text, text, text) TO anon;
GRANT EXECUTE ON FUNCTION public.set_user_role(uuid, text) TO anon;
GRANT EXECUTE ON FUNCTION public.admin_delete_user(uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.admin_log(text, text) TO anon;

-- ---------- 7) profiles 列级授权更新（加入 bio 列）----------
REVOKE ALL ON public.profiles FROM anon, authenticated;
GRANT SELECT (id, username, avatar, role, created_at, bio) ON public.profiles TO anon;
GRANT UPDATE (username, avatar, bio) ON public.profiles TO anon;
-- 注意：role 列匿名不可改，改角色只能走 set_user_role RPC

-- ---------- 8) Storage 图片桶（帖子配图） ----------
DO $$
BEGIN
  INSERT INTO storage.buckets (id, name, public)
  VALUES ('forum-images', 'forum-images', true)
  ON CONFLICT (id) DO UPDATE SET public = true;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE '[跳过] 创建 storage bucket: %', SQLERRM;
END $$;

DO $$
BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "forum_images_read" ON storage.objects';
  EXECUTE 'DROP POLICY IF EXISTS "forum_images_insert" ON storage.objects';
  EXECUTE 'CREATE POLICY "forum_images_read" ON storage.objects FOR SELECT USING (bucket_id = ''forum-images'')';
  EXECUTE 'CREATE POLICY "forum_images_insert" ON storage.objects FOR INSERT WITH CHECK (bucket_id = ''forum-images'')';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE '[跳过] storage 策略: %', SQLERRM;
END $$;

-- 完成。所有现有数据（用户/帖子/回复/角色）均保留，密码不变，照常登录。
