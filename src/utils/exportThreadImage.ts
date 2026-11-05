import type { Post } from '../types';
import { BOARDS } from '../types';
import { forumImageUrl } from '../lib/supabase';

/**
 * 把整帖（主楼 + 全部回复）绘制成一张排版精美的长图，用于分享。
 * 纯 Canvas 实现，不依赖任何第三方库。
 */

interface Theme {
  bg: string;
  card: string;
  header: string;
  text: string;
  muted: string;
  border: string;
  quote: string;
  accent: string;
  badgeBg: string;
  badgeText: string;
}

const LIGHT: Theme = {
  bg: '#f2efe9',
  card: '#ffffff',
  header: '#3f5f7d',
  text: '#2b2b2b',
  muted: '#8c8c8c',
  border: '#e4e0d8',
  quote: '#f4f2ed',
  accent: '#4f7d4e',
  badgeBg: '#3f5f7d',
  badgeText: '#ffffff',
};

const DARK: Theme = {
  bg: '#191b1f',
  card: '#24272c',
  header: '#5d87ad',
  text: '#e6e6e6',
  muted: '#949494',
  border: '#33373d',
  quote: '#2c3036',
  accent: '#7bb07a',
  badgeBg: '#3d5c78',
  badgeText: '#ffffff',
};

const W = 820;
const PAD = 40;
const CW = W - PAD * 2;
const FONT_STACK =
  '"PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Source Han Sans SC", system-ui, -apple-system, sans-serif';
const EMOJI_STACK = '"Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif';
const MAX_HEIGHT = 30000;

function fmt(ts: number): string {
  const d = new Date(ts);
  const p = (n: number) => n.toString().padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

function wrap(ctx: CanvasRenderingContext2D, text: string, maxW: number): string[] {
  const out: string[] = [];
  for (const para of text.split('\n')) {
    if (para === '') {
      out.push('');
      continue;
    }
    let line = '';
    for (const ch of para) {
      const test = line + ch;
      if (ctx.measureText(test).width > maxW && line !== '') {
        out.push(line);
        line = ch;
      } else {
        line = test;
      }
    }
    out.push(line);
  }
  return out;
}

function isEmojiAvatar(a: string): boolean {
  if (!a) return false;
  return !/^(https?:)?\/\//i.test(a) && !a.startsWith('data:');
}

/** 预加载 URL 头像，返回 path -> Image */
async function preloadAvatars(post: Post): Promise<Map<string, HTMLImageElement>> {
  const urls = new Set<string>();
  const push = (a: string) => {
    if (a && !isEmojiAvatar(a)) urls.add(a);
  };
  push(post.characterAvatar);
  post.replies.forEach((r) => push(r.characterAvatar));
  (post.imageUrls || []).forEach((p) => push(forumImageUrl(p)));

  const map = new Map<string, HTMLImageElement>();
  await Promise.all(
    [...urls].map(
      (u) =>
        new Promise<void>((resolve) => {
          const img = new Image();
          img.crossOrigin = 'anonymous';
          img.onload = () => {
            map.set(u, img);
            resolve();
          };
          img.onerror = () => resolve();
          img.src = u;
        })
    )
  );
  return map;
}

interface Ctx {
  ctx: CanvasRenderingContext2D;
  t: Theme;
  dry: boolean;
  avatars: Map<string, HTMLImageElement>;
}

function roundRect(c: Ctx, x: number, y: number, w: number, h: number, r: number, fill: string) {
  if (c.dry) return;
  const ctx = c.ctx;
  ctx.beginPath();
  const rr = Math.min(r, w / 2, h / 2);
  ctx.moveTo(x + rr, y);
  ctx.lineTo(x + w - rr, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + rr);
  ctx.lineTo(x + w, y + h - rr);
  ctx.quadraticCurveTo(x + w, y + h, x + w - rr, y + h);
  ctx.lineTo(x + rr, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - rr);
  ctx.lineTo(x, y + rr);
  ctx.quadraticCurveTo(x, y, x + rr, y);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
}

function drawText(
  c: Ctx,
  text: string,
  x: number,
  y: number,
  size: number,
  color: string,
  opts: { bold?: boolean; emoji?: boolean; align?: CanvasTextAlign } = {}
) {
  if (c.dry) return;
  const ctx = c.ctx;
  ctx.font = `${opts.bold ? '600 ' : ''}${size}px ${opts.emoji ? EMOJI_STACK : FONT_STACK}`;
  ctx.fillStyle = color;
  ctx.textBaseline = 'top';
  ctx.textAlign = opts.align || 'left';
  ctx.fillText(text, x, y);
}

function drawAvatar(c: Ctx, avatar: string, x: number, y: number, size: number) {
  if (c.dry) return;
  const ctx = c.ctx;
  const img = c.avatars.get(avatar);
  ctx.save();
  ctx.beginPath();
  ctx.arc(x + size / 2, y + size / 2, size / 2, 0, Math.PI * 2);
  ctx.closePath();
  ctx.fillStyle = c.t.quote;
  ctx.fill();
  ctx.clip();
  if (img) {
    ctx.drawImage(img, x, y, size, size);
  } else {
    ctx.font = `${size * 0.62}px ${EMOJI_STACK}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = c.t.text;
    ctx.fillText(avatar && isEmojiAvatar(avatar) ? avatar : '👤', x + size / 2, y + size / 2 + 1);
  }
  ctx.restore();
}

function badge(c: Ctx, text: string, x: number, y: number, size: number, bg: string, fg: string): number {
  const ctx = c.ctx;
  ctx.font = `600 ${size}px ${FONT_STACK}`;
  const w = ctx.measureText(text).width + 12;
  const h = size + 8;
  roundRect(c, x, y, w, h, h / 2, bg);
  drawText(c, text, x + w / 2, y + (h - size) / 2, size, fg, { align: 'center', bold: true });
  return w;
}

/** 核心：顺序排版绘制；返回总高度 */
function render(c: Ctx, post: Post, siteName: string): number {
  let y = 0;
  const board = BOARDS.find((b) => b.id === post.board);

  // 顶部色带
  if (!c.dry) c.ctx.fillStyle = c.t.header;
  if (!c.dry) c.ctx.fillRect(0, 0, W, 66);
  drawText(c, `💬 ${siteName}`, PAD, 22, 22, '#ffffff', { bold: true });
  drawText(
    c,
    board ? `${board.icon} ${board.name}` : '帖子',
    W - PAD,
    26,
    14,
    'rgba(255,255,255,0.85)',
    { align: 'right' }
  );
  y = 66;

  // 标题区
  y += 34;
  const titleLines = wrap(c.ctx, post.title, CW);
  for (const ln of titleLines) {
    drawText(c, ln, PAD, y, 27, c.t.text, { bold: true });
    y += 40;
  }
  y += 6;

  // 主楼卡片
  const cardTop = y;
  const pad = 24;
  const innerW = CW - pad * 2;
  const innerX = PAD + pad;

  // 头部（头像/名字/时间）：先算高度
  let cy = cardTop + pad;
  const headTop = cy;
  // 内容
  let bodyY = headTop + 44 + 16;

  // 引用/正文计算
  const bodyLines = wrap(c.ctx, post.content, innerW);
  const bodyLineH = 30;
  bodyY += 0;
  const bodyHeight = bodyLines.length * bodyLineH;

  // 小尾巴预留（论坛体暂不绘制）
  const sigH = 0;

  // 图片高度
  const imgs = post.imageUrls || [];
  let imgBlockH = 0;
  const imgGap = 12;
  const imgH = Math.round(innerW * 0.62);
  if (imgs.length) imgBlockH = imgs.length * (imgH + imgGap);

  const cardHeight = pad * 2 + 44 + 16 + bodyHeight + sigH + imgBlockH;

  roundRect(c, PAD, cardTop, CW, cardHeight, 14, c.t.card);

  // 头部
  drawAvatar(c, post.characterAvatar, innerX, headTop, 44);
  const nameX = innerX + 44 + 14;
  const name = post.characterId ? post.characterName : '匿名用户';
  drawText(c, name, nameX, headTop + 4, 18, c.t.header, { bold: true });
  c.ctx.font = `600 18px ${FONT_STACK}`;
  const nameW = c.ctx.measureText(name).width;
  let bx = nameX + nameW + 8;
  bx += badge(c, '楼主', bx, headTop + 4, 12, c.t.badgeBg, c.t.badgeText) + 8;
  if (post.postType === 'forum_sim') {
    badge(c, '论坛体', bx, headTop + 4, 12, c.t.quote, c.t.muted);
  }
  drawText(c, fmt(post.createdAt), W - PAD - pad, headTop + 8, 13, c.t.muted, { align: 'right' });

  // 标题下的正文
  let ty = bodyY;
  c.ctx.font = `400 16px ${FONT_STACK}`;
  for (const ln of bodyLines) {
    drawText(c, ln, innerX, ty, 16, c.t.text);
    ty += bodyLineH;
  }

  // 图片（仅绘制占位与已缓存的图）
  if (imgs.length) {
    ty += imgGap;
    for (const p of imgs) {
      roundRect(c, innerX, ty, innerW, imgH, 10, c.t.quote);
      const img = c.avatars.get(forumImageUrl(p));
      if (!c.dry && img) {
        const scale = Math.min(innerW / img.width, imgH / img.height);
        const dw = img.width * scale;
        const dh = img.height * scale;
        c.ctx.save();
        c.ctx.beginPath();
        c.ctx.rect(innerX, ty, innerW, imgH);
        c.ctx.clip();
        c.ctx.drawImage(img, innerX + (innerW - dw) / 2, ty + (imgH - dh) / 2, dw, dh);
        c.ctx.restore();
      }
      ty += imgH + imgGap;
    }
    ty -= imgGap;
  }

  y = cardTop + cardHeight + 28;

  // 回复
  for (const r of post.replies) {
    const rTop = y;
    const rInnerW = CW - pad * 2;
    const rInnerX = PAD + pad;
    const content = r.content;
    const lines = wrap(c.ctx, content, rInnerW);
    let quoteH = 0;
    let quoteLines: string[] = [];
    if (r.quoteId) {
      const q = post.replies.find((x) => x.id === r.quoteId);
      if (q) {
        quoteLines = wrap(c.ctx, q.content, rInnerW - 24).slice(0, 3);
        quoteH = quoteLines.length * 24 + 16;
      }
    }
    const rHeight = pad * 2 + 40 + 14 + quoteH + lines.length * 28;

    roundRect(c, PAD, rTop, CW, rHeight, 12, c.t.card);

    let ry = rTop + pad;
    drawAvatar(c, r.characterAvatar, rInnerX, ry, 40);
    const rNameX = rInnerX + 40 + 12;
    const rName = r.characterId ? r.characterName : '匿名用户';
    drawText(c, rName, rNameX, ry + 3, 16, c.t.header, { bold: true });
    c.ctx.font = `600 16px ${FONT_STACK}`;
    const rnW = c.ctx.measureText(rName).width;
    badge(c, `#${r.floor}`, rNameX + rnW + 8, ry + 3, 12, c.t.quote, c.t.muted);
    drawText(c, fmt(r.createdAt), W - PAD - pad, ry + 6, 12, c.t.muted, { align: 'right' });

    ry += 40 + 14;

    // 引用块
    if (quoteH > 0) {
      roundRect(c, rInnerX, ry, rInnerW, quoteH, 8, c.t.quote);
      let qy = ry + 8;
      for (const ql of quoteLines) {
        drawText(c, ql, rInnerX + 12, qy, 13, c.t.muted);
        qy += 24;
      }
      ry += quoteH;
    }

    for (const ln of lines) {
      drawText(c, ln, rInnerX, ry, 15, c.t.text);
      ry += 28;
    }

    y = rTop + rHeight + 14;
  }

  // 页脚
  y += 10;
  drawText(c, `由 ${siteName} 生成 · 共 ${post.replies.length} 条回复 · ${post.likes} 赞`, PAD, y, 13, c.t.muted);
  y += 26;
  drawText(c, fmt(Date.now()), W - PAD, y - 26, 13, c.t.muted, { align: 'right' });
  y += 18;

  return y;
}

export interface ExportImageOptions {
  siteName: string;
  dark?: boolean;
}

/** 生成帖子长图，返回 Blob */
export async function renderThreadImage(post: Post, opts: ExportImageOptions): Promise<Blob> {
  const theme = opts.dark ? DARK : LIGHT;
  const avatars = await preloadAvatars(post);

  // 第一遍：测量
  const measureCanvas = document.createElement('canvas');
  measureCanvas.width = W;
  measureCanvas.height = 10;
  const mctx = measureCanvas.getContext('2d');
  if (!mctx) throw new Error('浏览器不支持 Canvas');
  const height = Math.ceil(render({ ctx: mctx, t: theme, dry: true, avatars }, post, opts.siteName));

  if (height > MAX_HEIGHT) {
    throw new Error('帖子太长，无法导出为一张长图（可分段导出 txt/md）');
  }

  // 第二遍：绘制
  const canvas = document.createElement('canvas');
  const scale = 2; // 2 倍分辨率，图片更清晰
  canvas.width = W * scale;
  canvas.height = height * scale;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('浏览器不支持 Canvas');
  ctx.scale(scale, scale);
  ctx.fillStyle = theme.bg;
  ctx.fillRect(0, 0, W, height);

  render({ ctx, t: theme, dry: false, avatars }, post, opts.siteName);

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('图片生成失败'))),
      'image/png'
    );
  });
}

/** 生成并下载长图 */
export async function downloadThreadImage(post: Post, opts: ExportImageOptions): Promise<void> {
  const blob = await renderThreadImage(post, opts);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${post.title.slice(0, 20)}.png`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 3000);
}
