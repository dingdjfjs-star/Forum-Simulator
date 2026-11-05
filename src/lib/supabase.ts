import { createClient } from '@supabase/supabase-js';

// 通过 Netlify 代理访问 Supabase，解决国内 DNS 封锁问题
const supabaseUrl = 'https://jiangfeideluntan.netlify.app/api/supabase';
const supabaseAnonKey =
  'sb_publishable_9XtFvYd2O8vuvjn0nSdlHA_4RPPN8mD';

// ---- 论坛会话令牌（服务端鉴权用） ----
// 登录后由 login_user RPC 签发，之后每个请求自动带上 x-forum-token 头，
// 数据库 RLS 策略据此识别"当前是谁在操作"。
let forumToken: string | null = null;

export function setForumToken(token: string | null): void {
  forumToken = token;
}

export function getForumToken(): string | null {
  return forumToken;
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  global: {
    fetch: (input: RequestInfo | URL, init?: RequestInit) => {
      const headers = new Headers(init?.headers || {});
      if (forumToken) {
        headers.set('x-forum-token', forumToken);
      }
      return fetch(input, { ...init, headers });
    },
  },
});

// ---- 图片资源（同样走 Netlify 代理，避免国内直连被墙） ----

/**
 * 把数据库里存的图片相对路径转换为浏览器可访问的地址。
 * 相对路径形如 "abc123.webp"，最终得到
 * https://<站点>/api/supabase/storage/v1/object/public/forum-images/abc123.webp
 */
export function forumImageUrl(path: string): string {
  if (!path) return '';
  if (/^(https?:)?\/\//i.test(path) || path.startsWith('data:') || path.startsWith('blob:')) {
    return path;
  }
  return `${supabaseUrl}/storage/v1/object/public/forum-images/${path}`;
}

export const IMAGE_BUCKET = 'forum-images';
