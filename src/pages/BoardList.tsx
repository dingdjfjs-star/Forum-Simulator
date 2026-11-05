import { Link } from 'react-router-dom';
import { usePostStore } from '../stores/postStore';
import { useUserStore } from '../stores/userStore';
import { useSiteStore } from '../stores/siteStore';
import { BOARDS } from '../types';

function formatTime(ts: number): string {
  const d = new Date(ts);
  const now = new Date();
  const diff = now.getTime() - ts;
  if (diff < 60000) return '刚刚';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}分钟前`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}小时前`;
  if (diff < 604800000) return `${Math.floor(diff / 86400000)}天前`;
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function isEmoji(v?: string) {
  if (!v) return false;
  return /^(\p{Emoji_Presentation}|\p{Emoji}️|\p{Emoji_Modifier_Base}\p{Emoji_Modifier}?){1,2}$/u.test(v);
}

export default function BoardList() {
  const allPosts = usePostStore((s) => s.posts);
  const users = useUserStore((s) => s.users);
  const currentUser = useUserStore((s) => s.getCurrentUser());
  const siteName = useSiteStore((s) => s.siteName);

  const visiblePosts = allPosts.filter(
    (p) => p.isPublic || (currentUser && p.authorId === currentUser.id)
  );

  const boardPosts = (boardId: string) => visiblePosts.filter((p) => p.board === boardId);

  const totalPosts = visiblePosts.length;
  const totalUsers = users.length;
  const todayNew = visiblePosts.filter(
    (p) => Date.now() - p.createdAt < 86400000
  ).length;

  // 活跃用户：按发帖数排序，取前 8
  const activeUsers = [...users]
    .map((u) => ({
      ...u,
      count: visiblePosts.filter((p) => p.authorId === u.id).length,
    }))
    .sort((a, b) => b.count - a.count || a.createdAt - b.createdAt)
    .slice(0, 8);

  const latestPosts = [...visiblePosts]
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, 6);

  return (
    <div className="animate-fade-in">
      {/* Hero */}
      <div className="hero-gradient rounded-xl p-6 sm:p-7 mb-6 shadow-md">
        <h2 className="text-2xl sm:text-3xl font-bold mb-2">{siteName}</h2>
        <p className="text-sm text-white/80">
          闲聊日常 · 写同人文 · 用论坛体模拟器把脑洞演出来
        </p>
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 mt-5 text-sm text-white/85">
          <span>
            <span className="stat-num text-lg">📊 {totalPosts}</span> 帖子
          </span>
          <span>
            <span className="stat-num text-lg">👥 {totalUsers}</span> 成员
          </span>
          <span>
            <span className="stat-num text-lg">🔥 {todayNew}</span> 今日新帖
          </span>
          <span>
            <span className="stat-num text-lg">💬 {BOARDS.length}</span> 板块
          </span>
        </div>
        <div className="flex items-center gap-2 mt-5">
          {currentUser ? (
            <Link
              to="/create-post"
              className="px-4 py-2 rounded-lg bg-white text-[var(--color-forum-header)] font-bold text-sm hover:bg-white/90 transition-colors shadow-sm"
            >
              ✏️ 发新帖
            </Link>
          ) : (
            <Link
              to="/register"
              className="px-4 py-2 rounded-lg bg-white text-[var(--color-forum-header)] font-bold text-sm hover:bg-white/90 transition-colors shadow-sm"
            >
              🎉 加入我们
            </Link>
          )}
          {currentUser?.role === 'admin' && (
            <Link
              to="/admin"
              className="px-4 py-2 rounded-lg bg-amber-400/90 text-amber-950 font-bold text-sm hover:bg-amber-400 transition-colors"
            >
              🛡️ 管理后台
            </Link>
          )}
        </div>
      </div>

      {/* 板块卡片 */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-base font-bold text-[var(--color-forum-text)]">板块</h3>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {BOARDS.map((board) => {
          const posts = boardPosts(board.id);
          const latest = posts[0];
          return (
            <Link
              key={board.id}
              to={`/board/${board.id}`}
              className="forum-floor card-lift board-bar p-5 group"
              style={{ ['--bar-color' as any]: board.color }}
            >
              <div className="flex items-start gap-3 pl-1">
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl shrink-0"
                  style={{ backgroundColor: board.color + '22' }}
                >
                  {board.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h4
                      className="text-lg font-bold group-hover:opacity-80 transition-opacity"
                      style={{ color: board.color }}
                    >
                      {board.name}
                    </h4>
                    <span className="badge bg-[var(--color-forum-floor)] text-muted">
                      {posts.length} 帖
                    </span>
                    {board.allowForumSim && (
                      <span className="badge bg-[var(--color-forum-accent)] text-white">
                        论坛体
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-muted mt-0.5 line-clamp-2">{board.description}</p>
                </div>
              </div>

              {/* 该板块最新一帖 */}
              <div className="mt-3 pt-3 border-t border-dashed border-[var(--color-forum-border)] pl-1">
                {latest ? (
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-xs text-muted shrink-0">最新</span>
                    <span className="text-xs text-[var(--color-forum-text)] truncate flex-1">
                      {latest.title}
                    </span>
                    <span className="text-xs text-muted shrink-0">
                      {formatTime(latest.createdAt)}
                    </span>
                  </div>
                ) : (
                  <p className="text-xs text-muted">还没有帖子，来发第一帖 →</p>
                )}
              </div>
            </Link>
          );
        })}
      </div>

      {/* 活跃成员 */}
      {activeUsers.length > 0 && (
        <div className="mt-8">
          <h3 className="text-base font-bold text-[var(--color-forum-text)] mb-3">活跃成员</h3>
          <div className="forum-floor p-4">
            <div className="flex flex-wrap gap-x-4 gap-y-3">
              {activeUsers.map((u) => (
                <div key={u.id} className="flex items-center gap-2" title={`${u.username} · ${u.count} 帖`}>
                  {isEmoji(u.avatar) ? (
                    <span
                      className="w-8 h-8 rounded-full flex items-center justify-center text-base bg-[var(--color-forum-floor)]"
                    >
                      {u.avatar}
                    </span>
                  ) : (
                    <img
                      src={u.avatar}
                      alt=""
                      className="w-8 h-8 rounded-full object-cover bg-[var(--color-forum-floor)]"
                    />
                  )}
                  <div className="leading-tight">
                    <div className="text-xs font-medium text-[var(--color-forum-text)] flex items-center gap-1">
                      {u.username}
                      {u.role === 'admin' && <span className="badge badge-admin">👑</span>}
                    </div>
                    <div className="text-[10px] text-muted">{u.count} 帖</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 最新帖子 */}
      {latestPosts.length > 0 && (
        <div className="mt-8">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-base font-bold text-[var(--color-forum-text)]">最新帖子</h3>
            <Link to="/board/daily" className="text-xs text-muted hover:underline">
              查看全部 →
            </Link>
          </div>
          <div className="space-y-2">
            {latestPosts.map((post) => {
              const board = BOARDS.find((b) => b.id === post.board);
              const author = users.find((u) => u.id === post.authorId);
              return (
                <Link
                  key={post.id}
                  to={`/post/${post.id}`}
                  className="forum-floor card-lift board-bar p-3 pr-4 flex items-center gap-3 group"
                  style={{ ['--bar-color' as any]: board?.color || '#4a6d8c' }}
                >
                  <span className="text-lg shrink-0 pl-1">{board?.icon || '📝'}</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-bold text-[var(--color-forum-text)] group-hover:text-[var(--color-forum-header)] transition-colors truncate">
                      {post.title}
                    </div>
                    <div className="text-xs text-muted mt-0.5 flex items-center gap-2 flex-wrap">
                      <span className="flex items-center gap-1">
                        {post.characterId ? post.characterName : '匿名用户'}
                        {author?.role === 'admin' && <span className="badge badge-admin">👑</span>}
                      </span>
                      <span>{formatTime(post.createdAt)}</span>
                      <span>💬 {post.replies.length}</span>
                      {post.likes > 0 && <span>👍 {post.likes}</span>}
                    </div>
                  </div>
                  {post.postType === 'forum_sim' && (
                    <span className="badge bg-[var(--color-forum-header)] text-white shrink-0">
                      论坛体
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
