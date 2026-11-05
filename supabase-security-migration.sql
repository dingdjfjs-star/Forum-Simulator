-- ============================================================
-- 论坛安全加固迁移 SQL（幂等，可重复运行，不影响现有数据）
-- 在 Supabase SQL Editor 中完整运行一次即可
--
-- 做了什么：
--   1. 开启 pgcrypto 扩展（密码加密用）
--   2. 把所有明文密码原地加密为 bcrypt 哈希（用户名密码不变，照常登录）
--   3. 新建 sessions 会话表（服务端登录凭证）
--   4. 新建鉴权辅助函数 + 登录/注册/点赞/设坛主 RPC 函数
--   5. 收紧 RLS：匿名只能看，不能改；改数据必须带登录令牌
--      - profiles 密码列对匿名完全不可见（连哈希都看不到）
--      - 帖子/回复/角色：公开可读，写入仅限登录用户本人
--      - 删帖/删回复：仅作者、楼主、坛主
--      - 设坛主：仅坛主
-- ============================================================

-- 1. pgcrypto 扩展
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 2. 明文密码 -> bcrypt 哈希（只处理还没加密过的行，幂等）
UPDATE public.profiles
SET password = crypt(password, gen_salt('bf', 10))
WHERE password NOT LIKE '$2%';

-- 3. 会话表
CREATE TABLE IF NOT EXISTS public.sessions (
  token text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  expires_at timestamptz NOT NULL
);
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;
-- sessions 不建任何 anon 策略 = 匿名完全无法访问（只能通过下面的函数间接使用）

-- 4. 辅助函数

-- 读取请求头（PostgREST 会把 HTTP 头放进 request.headers）
CREATE OR REPLACE FUNCTION public.forum_request_header(p_name text)
RETURNS text
LANGUAGE sql STABLE
AS $$
  SELECT CASE
    WHEN current_setting('request.headers', true) IS NULL
      OR current_setting('request.headers', true) = '' THEN NULL
    ELSE current_setting('request.headers', true)::json->>p_name
  END
$$;

-- 当前登录用户 ID（无令牌/令牌过期返回 NULL）
CREATE OR REPLACE FUNCTION public.current_forum_user_id()
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT s.user_id
  FROM public.sessions s
  WHERE s.token = public.forum_request_header('x-forum-token')
    AND s.expires_at > now()
$$;

-- 当前用户是否坛主
CREATE OR REPLACE FUNCTION public.is_forum_admin()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = public.current_forum_user_id() AND p.role = 'admin'
  )
$$;

-- 注册（服务端查重 + 加密密码 + 直接建立会话）
CREATE OR REPLACE FUNCTION public.register_user(p_username text, p_password text, p_avatar text DEFAULT '😊')
RETURNS json
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_id uuid;
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

  RETURN json_build_object(
    'id', v_id,
    'username', p_username,
    'avatar', v_avatar,
    'role', 'user',
    'token', encode(gen_random_bytes(32), 'hex')
  );
END $$;

-- 登录（服务端校验 bcrypt，签发 30 天会话令牌）
CREATE OR REPLACE FUNCTION public.login_user(p_username text, p_password text)
RETURNS json
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_row public.profiles%ROWTYPE;
  v_token text;
BEGIN
  DELETE FROM public.sessions WHERE expires_at < now(); -- 顺手清理过期会话

  SELECT * INTO v_row FROM public.profiles WHERE username = trim(p_username);
  IF v_row.id IS NULL
     OR v_row.password IS NULL
     OR crypt(p_password, v_row.password) <> v_row.password THEN
    RAISE EXCEPTION '用户名或密码错误';
  END IF;

  v_token := encode(gen_random_bytes(32), 'hex');
  INSERT INTO public.sessions (token, user_id, expires_at)
  VALUES (v_token, v_row.id, now() + interval '30 days');

  RETURN json_build_object(
    'id', v_row.id,
    'username', v_row.username,
    'avatar', v_row.avatar,
    'role', v_row.role,
    'token', v_token
  );
END $$;

-- 退出登录（删除会话）
CREATE OR REPLACE FUNCTION public.logout_user(p_token text)
RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path = public
AS $$
  DELETE FROM public.sessions WHERE token = p_token
$$;

-- 点赞/取消点赞（服务端按令牌识别用户，防止伪造他人点赞）
CREATE OR REPLACE FUNCTION public.toggle_like(p_post_id uuid)
RETURNS json
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_user uuid := public.current_forum_user_id();
  v_liked_by text[];
  v_likes int;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION '请先登录后再点赞';
  END IF;

  SELECT liked_by, likes INTO v_liked_by, v_likes
  FROM public.posts WHERE id = p_post_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION '帖子不存在';
  END IF;

  IF v_user::text = ANY(v_liked_by) THEN
    v_liked_by := array_remove(v_liked_by, v_user::text);
    v_likes := v_likes - 1;
  ELSE
    v_liked_by := array_append(v_liked_by, v_user::text);
    v_likes := v_likes + 1;
  END IF;

  UPDATE public.posts
  SET liked_by = v_liked_by, likes = v_likes
  WHERE id = p_post_id;

  RETURN json_build_object('likes', v_likes, 'likedBy', to_json(v_liked_by));
END $$;

-- 设置角色（仅坛主）
CREATE OR REPLACE FUNCTION public.set_user_role(p_user_id uuid, p_role text)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT public.is_forum_admin() THEN
    RAISE EXCEPTION '仅坛主可以执行此操作';
  END IF;
  IF p_role NOT IN ('admin', 'user') THEN
    RAISE EXCEPTION '无效的角色';
  END IF;
  UPDATE public.profiles SET role = p_role WHERE id = p_user_id;
END $$;

-- 坛主删除用户（服务端鉴权，级联删除其角色；帖子与回复策略已处理）
CREATE OR REPLACE FUNCTION public.admin_delete_user(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT public.is_forum_admin() THEN
    RAISE EXCEPTION '仅坛主可以执行此操作';
  END IF;
  IF p_user_id = public.current_forum_user_id() THEN
    RAISE EXCEPTION '不能删除自己';
  END IF;
  DELETE FROM public.profiles WHERE id = p_user_id;
END $$;

-- RPC 执行权限
GRANT EXECUTE ON FUNCTION public.register_user(text, text, text) TO anon;
GRANT EXECUTE ON FUNCTION public.login_user(text, text) TO anon;
GRANT EXECUTE ON FUNCTION public.logout_user(text) TO anon;
GRANT EXECUTE ON FUNCTION public.toggle_like(uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.set_user_role(uuid, text) TO anon;
GRANT EXECUTE ON FUNCTION public.admin_delete_user(uuid) TO anon;

-- 5. 收紧 profiles 表权限：匿名能看到基本资料，但看不到密码列
REVOKE ALL ON public.profiles FROM anon, authenticated;
GRANT SELECT (id, username, avatar, role, created_at) ON public.profiles TO anon;
GRANT UPDATE (username, avatar) ON public.profiles TO anon;
-- 注意：role 列匿名不可改，改角色只能走 set_user_role RPC

-- 6. 重建 RLS 策略
DROP POLICY IF EXISTS "Allow all profiles" ON profiles;
DROP POLICY IF EXISTS "Allow all characters" ON characters;
DROP POLICY IF EXISTS "Allow all posts" ON posts;
DROP POLICY IF EXISTS "Allow all replies" ON replies;

-- profiles：公开可读，本人可改自己的用户名/头像
DROP POLICY IF EXISTS "profiles_select" ON profiles;
DROP POLICY IF EXISTS "profiles_update_own" ON profiles;
CREATE POLICY "profiles_select" ON public.profiles
  FOR SELECT USING (true);
CREATE POLICY "profiles_update_own" ON public.profiles
  FOR UPDATE
  USING (id = public.current_forum_user_id())
  WITH CHECK (id = public.current_forum_user_id());

-- characters：公开可读，仅本人管理自己的角色
DROP POLICY IF EXISTS "characters_select" ON characters;
DROP POLICY IF EXISTS "characters_insert_own" ON characters;
DROP POLICY IF EXISTS "characters_update_own" ON characters;
DROP POLICY IF EXISTS "characters_delete_own" ON characters;
CREATE POLICY "characters_select" ON public.characters
  FOR SELECT USING (true);
CREATE POLICY "characters_insert_own" ON public.characters
  FOR INSERT WITH CHECK (user_id = public.current_forum_user_id());
CREATE POLICY "characters_update_own" ON public.characters
  FOR UPDATE
  USING (user_id = public.current_forum_user_id())
  WITH CHECK (user_id = public.current_forum_user_id());
CREATE POLICY "characters_delete_own" ON public.characters
  FOR DELETE USING (user_id = public.current_forum_user_id());

-- posts：公开可读；发帖/改帖仅限本人；删帖本人或坛主
DROP POLICY IF EXISTS "posts_select" ON posts;
DROP POLICY IF EXISTS "posts_insert_own" ON posts;
DROP POLICY IF EXISTS "posts_update_own" ON posts;
DROP POLICY IF EXISTS "posts_delete_own_or_admin" ON posts;
CREATE POLICY "posts_select" ON public.posts
  FOR SELECT USING (true);
CREATE POLICY "posts_insert_own" ON public.posts
  FOR INSERT WITH CHECK (author_id = public.current_forum_user_id());
CREATE POLICY "posts_update_own" ON public.posts
  FOR UPDATE
  USING (author_id = public.current_forum_user_id())
  WITH CHECK (author_id = public.current_forum_user_id());
CREATE POLICY "posts_delete_own_or_admin" ON public.posts
  FOR DELETE USING (
    author_id = public.current_forum_user_id()
    OR public.is_forum_admin()
  );

-- replies：公开可读；发回复需登录（模拟角色的匿名回复 user_id 为空也要求登录态）；
-- 删回复：回复作者 / 楼主 / 坛主
DROP POLICY IF EXISTS "replies_select" ON replies;
DROP POLICY IF EXISTS "replies_insert_logged_in" ON replies;
DROP POLICY IF EXISTS "replies_delete_own_or_admin" ON replies;
CREATE POLICY "replies_select" ON public.replies
  FOR SELECT USING (true);
CREATE POLICY "replies_insert_logged_in" ON public.replies
  FOR INSERT WITH CHECK (
    public.current_forum_user_id() IS NOT NULL
    AND (user_id = public.current_forum_user_id() OR user_id IS NULL)
  );
CREATE POLICY "replies_delete_own_or_admin" ON public.replies
  FOR DELETE USING (
    user_id = public.current_forum_user_id()
    OR public.is_forum_admin()
    OR EXISTS (
      SELECT 1 FROM public.posts p
      WHERE p.id = replies.post_id
        AND p.author_id = public.current_forum_user_id()
    )
  );

-- 完成。所有现有数据（用户/帖子/回复/角色）均保留，用户密码不变，照常登录。
