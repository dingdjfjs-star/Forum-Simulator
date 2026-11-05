import type { Post } from '../types';
import { BOARDS } from '../types';

function formatTime(ts: number): string {
  const d = new Date(ts);
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

export function exportAsText(post: Post, siteName = '论坛'): string {
  const lines: string[] = [];
  const board = BOARDS.find((b) => b.id === post.board);

  lines.push('═══════════════════════════════════════');
  lines.push(`  ${siteName} — 帖子导出`);
  lines.push('═══════════════════════════════════════');
  lines.push('');
  lines.push(`标题：${post.title}`);
  lines.push(`发帖人：${post.characterName}`);
  lines.push(`发帖时间：${formatTime(post.createdAt)}`);
  if (board) {
    lines.push(`板块：${board.icon} ${board.name}`);
  }
  if (post.postType === 'forum_sim') {
    lines.push(`类型：论坛体模拟`);
  }
  if (post.tags.length > 0) {
    lines.push(`标签：${post.tags.map((t) => '#' + t).join(' ')}`);
  }
  lines.push(`参与设置：${post.allowParticipation ? '允许回复' : '禁止回复'}`);
  if (post.likes > 0) {
    lines.push(`点赞数：${post.likes}`);
  }
  if (post.editedAt) {
    lines.push(`最后编辑：${formatTime(post.editedAt)}`);
  }
  lines.push('');
  lines.push('┌─ 【主楼】 ──────────────────────────');
  lines.push('│');
  for (const line of post.content.split('\n')) {
    lines.push(`│  ${line}`);
  }
  lines.push('│');
  lines.push('└──────────────────────────────────────');
  lines.push('');

  if (post.replies.length > 0) {
    for (const reply of post.replies) {
      lines.push(
        `#${reply.floor}  ${reply.characterName} | ${formatTime(reply.createdAt)}`
      );
      lines.push('─'.repeat(45));

      if (reply.quoteId) {
        const quoted = post.replies.find((r) => r.id === reply.quoteId);
        if (quoted) {
          lines.push(`  ╭─ 引用 #${quoted.floor} ${quoted.characterName}:`);
          const quoteLines = quoted.content.split('\n');
          const preview =
            quoteLines[0].slice(0, 60) +
            (quoteLines.length > 1 || quoteLines[0].length > 60 ? '...' : '');
          lines.push(`  │  ${preview}`);
          lines.push('  ╰─');
        }
      }

      for (const line of reply.content.split('\n')) {
        lines.push(`  ${line}`);
      }
      lines.push('');
    }
  }

  lines.push('═══════════════════════════════════════');
  lines.push(`导出时间：${formatTime(Date.now())}`);
  lines.push(`由 ${siteName} 生成 · 仅供娱乐`);

  return lines.join('\n');
}

export function exportAsMarkdown(post: Post, siteName = '论坛'): string {
  const lines: string[] = [];
  const board = BOARDS.find((b) => b.id === post.board);

  lines.push(`# ${post.title}`);
  lines.push('');
  lines.push(
    `> 发帖人：**${post.characterName}**　|　${formatTime(post.createdAt)}`
  );
  if (board) {
    lines.push(`> 板块：${board.icon} ${board.name}`);
  }
  if (post.postType === 'forum_sim') {
    lines.push(`> 类型：论坛体模拟`);
  }
  if (post.tags.length > 0) {
    lines.push(`> 标签：${post.tags.map((t) => '#' + t).join(' ')}`);
  }
  lines.push(
    `> ${post.allowParticipation ? '🔓 允许回复' : '🔒 禁止回复'}　|　👍 ${post.likes} 赞`
  );
  if (post.editedAt) {
    lines.push(`> 最后编辑：${formatTime(post.editedAt)}`);
  }
  lines.push('');

  lines.push(post.content);
  lines.push('');
  lines.push('---');
  lines.push('');

  for (const reply of post.replies) {
    lines.push(
      `### #${reply.floor}　${reply.characterName}　|　${formatTime(reply.createdAt)}`
    );
    lines.push('');

    if (reply.quoteId) {
      const quoted = post.replies.find((r) => r.id === reply.quoteId);
      if (quoted) {
        const quoteLines = quoted.content.split('\n');
        const preview =
          quoteLines[0].slice(0, 80) +
          (quoteLines.length > 1 || quoteLines[0].length > 80 ? '...' : '');
        lines.push(
          `> 引用 #${quoted.floor} **${quoted.characterName}**：${preview}`
        );
        lines.push('');
      }
    }

    lines.push(reply.content);
    lines.push('');
    lines.push('---');
    lines.push('');
  }

  lines.push(
    `*导出时间：${formatTime(Date.now())} · 由${siteName}生成*`
  );

  return lines.join('\n');
}

export function downloadFile(content: string, filename: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    try {
      document.execCommand('copy');
      return true;
    } catch {
      return false;
    } finally {
      document.body.removeChild(textarea);
    }
  }
}
