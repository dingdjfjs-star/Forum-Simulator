-- ============================================
-- 论坛体模拟器 → 论坛 SQL Schema (迁移版)
-- 在 Supabase SQL Editor 中运行此文件
-- ============================================

-- 1. 用户表（简化的用户系统，用户名+密码）
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  avatar TEXT DEFAULT '😊',
  role TEXT DEFAULT 'user',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. 角色表
CREATE TABLE IF NOT EXISTS characters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  avatar TEXT DEFAULT '😊',
  signature TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. 帖子表
CREATE TABLE IF NOT EXISTS posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  character_id UUID REFERENCES characters(id) ON DELETE SET NULL,
  character_name TEXT NOT NULL,
  character_avatar TEXT DEFAULT '👤',
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  tags TEXT[] DEFAULT '{}',
  is_public BOOLEAN DEFAULT true,
  allow_participation BOOLEAN DEFAULT true,
  edited_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  board TEXT DEFAULT 'daily',
  post_type TEXT DEFAULT 'normal',
  likes INT DEFAULT 0,
  liked_by TEXT[] DEFAULT '{}'
);

-- 4. 回复表
CREATE TABLE IF NOT EXISTS replies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID REFERENCES posts(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  character_id UUID REFERENCES characters(id) ON DELETE SET NULL,
  character_name TEXT NOT NULL,
  character_avatar TEXT DEFAULT '👤',
  content TEXT NOT NULL,
  quote_id UUID REFERENCES replies(id) ON DELETE SET NULL,
  floor INT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 如果表已存在，添加新列（安全迁移）
-- ============================================

-- 添加 board 列（如果不存在）
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'posts' AND column_name = 'board') THEN
    ALTER TABLE posts ADD COLUMN board TEXT DEFAULT 'daily';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'posts' AND column_name = 'post_type') THEN
    ALTER TABLE posts ADD COLUMN post_type TEXT DEFAULT 'normal';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'posts' AND column_name = 'likes') THEN
    ALTER TABLE posts ADD COLUMN likes INT DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'posts' AND column_name = 'liked_by') THEN
    ALTER TABLE posts ADD COLUMN liked_by TEXT[] DEFAULT '{}';
  END IF;
END $$;

-- ============================================
-- 添加 role 列（如果已存在表，安全迁移）
-- ============================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'role') THEN
    ALTER TABLE profiles ADD COLUMN role TEXT DEFAULT 'user';
  END IF;
END $$;

-- 把"客影裁云"设为坛主（admin）
UPDATE profiles SET role = 'admin' WHERE username = '客影裁云';

-- ============================================
-- RLS 策略
-- ============================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE characters ENABLE ROW LEVEL SECURITY;
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE replies ENABLE ROW LEVEL SECURITY;

-- 删除旧策略（如果存在）再创建
DROP POLICY IF EXISTS "Public posts are viewable by everyone" ON posts;
DROP POLICY IF EXISTS "Authors can manage their own posts" ON posts;
DROP POLICY IF EXISTS "Allow all profiles" ON profiles;
DROP POLICY IF EXISTS "Allow all characters" ON characters;
DROP POLICY IF EXISTS "Allow all replies" ON replies;

-- 全开策略（论坛模拟器，前端鉴权即可）
CREATE POLICY "Allow all profiles" ON profiles FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all characters" ON characters FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all posts" ON posts FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all replies" ON replies FOR ALL USING (true) WITH CHECK (true);
