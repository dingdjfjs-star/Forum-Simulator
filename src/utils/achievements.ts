import type { Post } from '../types';

export interface Achievement {
  id: string;
  icon: string;
  name: string;
  desc: string;
}

/** 主称号：按发帖数（唯一一个，永远有） */
export function mainTitle(postCount: number): { icon: string; name: string } {
  if (postCount >= 20) return { icon: '👑', name: '坛宠' };
  if (postCount >= 10) return { icon: '📣', name: '话痨' };
  if (postCount >= 6) return { icon: '🔥', name: '活跃分子' };
  if (postCount >= 3) return { icon: '🏠', name: '常驻居民' };
  if (postCount >= 1) return { icon: '🐣', name: '初来乍到' };
  return { icon: '🌱', name: '新入坛' };
}

/** 计算用户的成就徽章（纯前端推导，不占数据库） */
export function computeAchievements(
  posts: Post[],
  seriesCount: number,
  joinedAt: number
): Achievement[] {
  const out: Achievement[] = [];
  const postCount = posts.length;
  const likeCount = posts.reduce((s, p) => s + p.likes, 0);
  const forumSimCount = posts.filter((p) => p.postType === 'forum_sim').length;
  const maxReplies = posts.reduce((m, p) => Math.max(m, p.replies.length), 0);
  const days = Math.floor((Date.now() - joinedAt) / 86400000);

  if (postCount >= 1) out.push({ id: 'first', icon: '✍️', name: '第一笔', desc: '发布了第一个帖子' });
  if (likeCount >= 10) out.push({ id: 'popular', icon: '⭐', name: '人气王', desc: '累计获赞 10+' });
  if (likeCount >= 50) out.push({ id: 'top', icon: '🌟', name: '顶流', desc: '累计获赞 50+' });
  if (forumSimCount >= 3)
    out.push({ id: 'sim', icon: '🎭', name: '论坛体大师', desc: '发布 3 篇以上论坛体' });
  if (seriesCount >= 1)
    out.push({ id: 'serial', icon: '📚', name: '连载作家', desc: '开了一个连载' });
  if (maxReplies >= 10)
    out.push({ id: 'hot', icon: '💬', name: '话题制造机', desc: '单帖回复破 10' });
  if (days >= 30) out.push({ id: 'veteran', icon: '🕰️', name: '元老', desc: '加入满 30 天' });
  if (maxReplies >= 3 && likeCount >= 5)
    out.push({ id: 'both', icon: '💎', name: '双修', desc: '既有赞又有讨论度' });

  return out;
}
