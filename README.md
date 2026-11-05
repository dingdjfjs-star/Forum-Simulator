# 论坛模拟器 Forum Simulator

一个"论坛体"故事模拟器小站：注册马甲、扮演角色、发帖盖楼、连载分章，用老式 BBS 的形式写故事、闲聊、创作同人文。

**在线地址**：https://jiangfeideluntan.netlify.app

## 功能

- 🧑‍🤝‍🧑 多用户注册 / 登录（密码服务端哈希，会话令牌鉴权）
- 🎭 角色扮演：一人可建多个角色（马甲），带头像与设定
- 📋 版块 + 帖子 + 回复盖楼（楼层号、引用回复）
- 📖 连载分章（Series）：长文按章节组织
- 🖼️ 图片上传（Supabase Storage，webp）+ 帖子导出长图
- 🏆 成就系统、个人主页、坛主数据看板（Admin）
- 📱 PWA：可安装、Service Worker 离线缓存
- 🌗 主题切换

## 技术栈

| 层 | 技术 |
|---|---|
| 前端 | React 19 + TypeScript + Vite 8 + Tailwind CSS 4 + Zustand + React Router 6 |
| 后端 | Supabase（Postgres + RLS + Storage + Edge RPC） |
| 部署 | Netlify（静态站 + Functions + Redirects 代理） |

## 架构要点：Supabase 国内代理

国内直连 `supabase.co` 受 DNS 干扰，本站通过 Netlify 反向代理中转：

```
浏览器 → /api/supabase/* → (Netlify redirects) → https://<project>.supabase.co/*
```

- 前端 `src/lib/supabase.ts` 中 supabaseUrl 即代理地址
- 本地开发由 `vite.config.ts` 的 `server.proxy` 提供同样的 `/api/supabase` 转发
- `netlify/functions/keepalive.mjs`：每日 09:00 UTC 定时心跳，防止 Supabase 免费项目闲置暂停

## 数据库与安全

Schema 与迁移脚本（按顺序执行）：

1. `supabase-schema.sql` — 初始建表
2. `supabase-security-migration.sql` — 安全加固：pgcrypto 密码哈希、`sessions` 会话表、`login_user / register_user / toggle_like` 等 SECURITY DEFINER RPC、全站 RLS 收紧（仅本人可改删，role 仅管理员可变更）
3. `supabase-features-migration.sql` — 连载分章 / 成就 / 看板等特性表

前端请求携带 `x-forum-token` 头，RLS 策略通过 `current_forum_user_id()` 识别当前用户；anon 只能 SELECT `profiles` 的公开列（id/username/avatar/role/created_at），密码列不出数据库。

## 本地开发

```bash
npm install
npm run dev      # 开发服务器（/api/supabase 已代理）
npm run build    # tsc -b + vite build → dist/
npm run preview  # 预览构建产物
npm run lint
```

## 部署（Netlify）

- `netlify.toml` 已配置：构建命令、发布目录、Functions、Supabase 代理 redirects、SPA 路由回退、keepalive 定时函数
- `public/_redirects` 提供 SPA 回退兜底
- 推送到 GitHub 后由 Netlify 自动构建部署
