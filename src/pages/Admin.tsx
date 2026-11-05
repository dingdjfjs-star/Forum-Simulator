import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useUserStore } from '../stores/userStore';
import { usePostStore } from '../stores/postStore';
import { useSiteStore } from '../stores/siteStore';
import { useToastStore } from '../stores/toastStore';
import { useConfirmStore } from '../components/ConfirmDialog';
import { BOARDS } from '../types';

type Tab = 'dashboard' | 'users' | 'posts' | 'logs';

const ACTION_LABEL: Record<string, string> = {
  set_role: '角色变更',
  delete_user: '删除用户',
  delete_post: '删除帖子',
};

interface LogRow {
  id: string;
  actor_name: string;
  action: string;
  detail: string;
  created_at: string;
}

export default function Admin() {
  const navigate = useNavigate();
  const currentUser = useUserStore((s) => s.getCurrentUser());
  const loadingUsers = useUserStore((s) => s.loading);
  const users = useUserStore((s) => s.users);
  const setUserRole = useUserStore((s) => s.setUserRole);
  const posts = usePostStore((s) => s.posts);
  const series = usePostStore((s) => s.series);
  const loadPosts = usePostStore((s) => s.loadPosts);
  const siteName = useSiteStore((s) => s.siteName);
  const toast = useToastStore((s) => s);
  const confirm = useConfirmStore((s) => s.show);

  const [tab, setTab] = useState<Tab>('dashboard');
  const [logs, setLogs] = useState<LogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [backingUp, setBackingUp] = useState(false);

  // 鉴权：非坛主禁止进入
  useEffect(() => {
    if (!loadingUsers && currentUser && currentUser.role !== 'admin') {
      toast.error('只有坛主才能访问管理后台');
      navigate('/');
    }
  }, [loadingUsers, currentUser, navigate, toast]);

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadData = async () => {
    setLoading(true);
    const [, , lg] = await Promise.all([
      useUserStore.getState().loadUsers(),
      loadPosts(),
      supabase
        .from('admin_logs')
        .select('id, actor_name, action, detail, created_at')
        .order('created_at', { ascending: false })
        .limit(200),
    ]);
    if (lg.error) console.error('加载操作日志失败:', lg.error);
    if (lg.data) setLogs(lg.data as LogRow[]);
    setLoading(false);
  };

  // ---------- 统计 ----------
  const totalPosts = posts.length;
  const totalReplies = posts.reduce((s, p) => s + p.replies.length, 0);
  const totalLikes = posts.reduce((s, p) => s + p.likes, 0);
  const totalImages = posts.reduce((s, p) => s + p.imageUrls.length, 0);

  const boardStats = BOARDS.map((b) => ({
    ...b,
    count: posts.filter((p) => p.board === b.id).length,
  }));
  const maxBoard = Math.max(1, ...boardStats.map((b) => b.count));

  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - (6 - i));
    return d;
  });
  const trend = days.map((d) => {
    const start = d.getTime();
    const end = start + 86400000;
    return posts.filter((p) => p.createdAt >= start && p.createdAt < end).length;
  });
  const maxTrend = Math.max(1, ...trend);

  const activeUsers = [...users]
    .map((u) => ({
      u,
      count: posts.filter((p) => p.authorId === u.id).length,
      likes: posts.filter((p) => p.authorId === u.id).reduce((s, p) => s + p.likes, 0),
    }))
    .sort((a, b) => b.count - a.count || b.likes - a.likes)
    .slice(0, 6);

  const topPosts = [...posts]
    .sort((a, b) => b.likes + b.replies.length - (a.likes + a.replies.length))
    .slice(0, 5);

  // ---------- 备份 ----------
  const handleBackup = async () => {
    setBackingUp(true);
    try {
      // 从服务端重新拉一遍全量数据（保证与云端一致）
      const [p, r, pr, ch, se] = await Promise.all([
        supabase.from('posts').select('*'),
        supabase.from('replies').select('*'),
        supabase.from('profiles').select('id, username, avatar, role, bio, created_at'),
        supabase.from('characters').select('*'),
        supabase.from('series').select('*'),
      ]);
      const bad = [p, r, pr, ch, se].find((x) => x.error);
      if (bad?.error) throw new Error(bad.error.message);

      const data = {
        exportedAt: new Date().toISOString(),
        site: siteName,
        note: '由坛主后台导出。profiles 不含密码（数据库层面对匿名不可见）。',
        counts: {
          profiles: pr.data?.length ?? 0,
          posts: p.data?.length ?? 0,
          replies: r.data?.length ?? 0,
          characters: ch.data?.length ?? 0,
          series: se.data?.length ?? 0,
        },
        profiles: pr.data,
        posts: p.data,
        replies: r.data,
        characters: ch.data,
        series: se.data,
      };

      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const d = new Date();
      const pad = (n: number) => n.toString().padStart(2, '0');
      a.href = url;
      a.download = `forum-backup-${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 3000);
      toast.success('备份已导出');
    } catch (e: any) {
      toast.error('备份失败：' + (e?.message || '请重试'));
    }
    setBackingUp(false);
  };

  // ---------- 用户操作 ----------
  const handleDeleteUser = (user: any) => {
    if (user.id === currentUser?.id) {
      toast.error('不能删除自己');
      return;
    }
    confirm({
      title: '删除用户',
      message: `确定删除用户「${user.username}」吗？该用户的所有帖子、角色、回复将一并删除，不可恢复。`,
      confirmText: '删除',
      danger: true,
      onConfirm: async () => {
        const { error } = await supabase.rpc('admin_delete_user', { p_user_id: user.id });
        if (error) {
          console.error('删除用户失败:', error);
          toast.error('删除失败：' + (error.message || '请重试'));
        } else {
          toast.success('用户已删除');
          loadData();
        }
      },
    });
  };

  const handleToggleRole = async (user: any) => {
    if (user.id === currentUser?.id && user.role === 'admin') {
      toast.error('不能取消自己的坛主身份');
      return;
    }
    const newRole = user.role === 'admin' ? 'user' : 'admin';
    const { success } = await setUserRole(user.id, newRole);
    if (success) {
      toast.success(
        newRole === 'admin' ? `已将「${user.username}」设为坛主` : `已取消「${user.username}」的坛主`
      );
      loadData();
    } else {
      toast.error('操作失败，请重试');
    }
  };

  const handleDeletePost = (post: any) => {
    confirm({
      title: '删除帖子',
      message: `确定删除帖子「${post.title}」吗？其所有回复将一并删除，不可恢复。`,
      confirmText: '删除',
      danger: true,
      onConfirm: async () => {
        const { error } = await supabase.from('posts').delete().eq('id', post.id);
        if (error) toast.error('删除失败，请重试');
        else {
          // 记录操作日志（失败不影响删除结果）
          supabase
            .rpc('admin_log', { p_action: 'delete_post', p_detail: `删除了帖子「${post.title}」` })
            .then(
              () => {},
              () => {}
            );
          toast.success('帖子已删除');
          loadData();
        }
      },
    });
  };

  const userName = (id: string) => users.find((u) => u.id === id)?.username || '(已删除)';
  const fmtDate = (iso: string) =>
    new Date(iso).toLocaleString('zh-CN', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  const weekLabel = ['日', '一', '二', '三', '四', '五', '六'];

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-3 border-[var(--color-forum-border)] border-t-[var(--color-forum-header)] rounded-full animate-spin" />
          <p className="text-sm text-muted">正在加载管理数据...</p>
        </div>
      </div>
    );
  }

  const tabs: { key: Tab; label: string }[] = [
    { key: 'dashboard', label: '📊 数据看板' },
    { key: 'users', label: `👥 用户管理 (${users.length})` },
    { key: 'posts', label: `📝 帖子管理 (${posts.length})` },
    { key: 'logs', label: `📜 操作日志 (${logs.length})` },
  ];

  return (
    <div className="animate-fade-in">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <h1 className="text-xl font-bold text-[var(--color-forum-text)]">🛡️ 坛主管理后台</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={handleBackup}
            disabled={backingUp}
            className="px-3 py-1.5 rounded-lg text-xs font-bold bg-[var(--color-forum-accent)] text-white hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center gap-1.5"
          >
            {backingUp ? (
              <>
                <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                打包中...
              </>
            ) : (
              '💾 一键备份'
            )}
          </button>
          <span className="text-xs text-muted hidden sm:inline">
            欢迎，{currentUser?.username} 坛主
          </span>
        </div>
      </div>

      {/* Tab 切换 */}
      <div className="flex gap-1 mb-4 border-b border-[var(--color-forum-border)] overflow-x-auto">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 whitespace-nowrap ${
              tab === t.key
                ? 'border-[var(--color-forum-header)] text-[var(--color-forum-header)]'
                : 'border-transparent text-muted hover:text-[var(--color-forum-text)]'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ============ 数据看板 ============ */}
      {tab === 'dashboard' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {[
              { v: users.length, l: '注册用户', i: '👥', c: 'var(--color-forum-header)' },
              { v: totalPosts, l: '帖子总数', i: '📝', c: 'var(--color-forum-accent)' },
              { v: totalReplies, l: '回复总数', i: '💬', c: '#8a6d3b' },
              { v: totalLikes, l: '累计点赞', i: '❤️', c: '#c0506a' },
              { v: series.length, l: '连载作品', i: '📚', c: '#7a5aa8' },
            ].map((x) => (
              <div key={x.l} className="forum-floor p-4 text-center">
                <div className="text-lg">{x.i}</div>
                <div className="text-2xl font-bold mt-1" style={{ color: x.c }}>
                  {x.v}
                </div>
                <div className="text-xs text-muted mt-0.5">{x.l}</div>
              </div>
            ))}
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            {/* 板块分布 */}
            <div className="forum-floor p-5">
              <h3 className="font-bold text-sm text-[var(--color-forum-text)] mb-3">📂 板块分布</h3>
              <div className="space-y-2.5">
                {boardStats.map((b) => (
                  <div key={b.id}>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="text-[var(--color-forum-text)]">
                        {b.icon} {b.name}
                      </span>
                      <span className="text-muted">{b.count} 帖</span>
                    </div>
                    <div className="h-2 rounded-full bg-[var(--color-forum-quote)] overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${(b.count / maxBoard) * 100}%`,
                          backgroundColor: b.color,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* 近 7 天趋势 */}
            <div className="forum-floor p-5">
              <h3 className="font-bold text-sm text-[var(--color-forum-text)] mb-3">
                📈 近 7 天发帖
              </h3>
              <div className="flex items-end justify-between gap-2 h-32">
                {trend.map((v, i) => (
                  <div key={i} className="flex-1 flex flex-col items-center gap-1">
                    <span className="text-xs text-muted">{v || ''}</span>
                    <div
                      className="w-full rounded-t bg-[var(--color-forum-header)] transition-all"
                      style={{
                        height: `${Math.max(4, (v / maxTrend) * 96)}px`,
                        opacity: v === 0 ? 0.25 : 1,
                      }}
                    />
                    <span className="text-xs text-muted">
                      {weekLabel[days[i].getDay()]}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            {/* 活跃榜 */}
            <div className="forum-floor p-5">
              <h3 className="font-bold text-sm text-[var(--color-forum-text)] mb-3">🔥 活跃成员</h3>
              <div className="space-y-2">
                {activeUsers.map((x, i) => (
                  <div key={x.u.id} className="flex items-center gap-2 text-sm">
                    <span className="w-5 text-center text-xs font-bold text-muted">{i + 1}</span>
                    <span className="flex-1 truncate text-[var(--color-forum-text)]">
                      {x.u.username}
                      {x.u.role === 'admin' && ' 👑'}
                    </span>
                    <span className="text-xs text-muted shrink-0">
                      {x.count} 帖 · {x.likes} 赞
                    </span>
                  </div>
                ))}
                {activeUsers.length === 0 && <p className="text-xs text-muted">暂无数据</p>}
              </div>
            </div>

            {/* 热门帖 */}
            <div className="forum-floor p-5">
              <h3 className="font-bold text-sm text-[var(--color-forum-text)] mb-3">🏆 最热帖子</h3>
              <div className="space-y-2">
                {topPosts.map((p) => (
                  <div key={p.id} className="flex items-center gap-2 text-sm">
                    <span className="text-xs">{BOARDS.find((b) => b.id === p.board)?.icon}</span>
                    <span className="flex-1 truncate text-[var(--color-forum-text)]">{p.title}</span>
                    <span className="text-xs text-muted shrink-0">
                      {p.replies.length} 回复 · {p.likes} 赞
                    </span>
                  </div>
                ))}
                {topPosts.length === 0 && <p className="text-xs text-muted">暂无数据</p>}
              </div>
            </div>
          </div>

          <div className="forum-floor p-4 text-xs text-muted">
            帖子累计带图 {totalImages} 张 · 数据云端存储（Supabase）· 建议每周点一次「一键备份」留个底
          </div>
        </div>
      )}

      {/* ============ 用户管理 ============ */}
      {tab === 'users' && (
        <div className="space-y-2">
          {users.map((u) => (
            <div
              key={u.id}
              className="flex items-center justify-between gap-3 bg-[var(--color-forum-card)] border border-[var(--color-forum-border)] rounded-lg p-3"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-[var(--color-forum-text)] truncate">
                    {u.username}
                  </span>
                  {u.role === 'admin' && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 font-bold">
                      👑 坛主
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted mt-0.5">
                  注册于 {fmtDate(new Date(u.createdAt).toISOString())}
                  {u.bio ? ` · ${u.bio}` : ''}
                </p>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  onClick={() => handleToggleRole(u)}
                  disabled={u.id === currentUser?.id && u.role === 'admin'}
                  className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                    u.role === 'admin'
                      ? 'bg-[var(--color-forum-hover)] text-muted hover:text-red-500'
                      : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 hover:opacity-80'
                  } disabled:opacity-40 disabled:cursor-not-allowed`}
                >
                  {u.role === 'admin' ? '取消坛主' : '设为坛主'}
                </button>
                <button
                  onClick={() => handleDeleteUser(u)}
                  disabled={u.id === currentUser?.id}
                  className="px-2.5 py-1 rounded text-xs font-medium text-red-500 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  删除
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ============ 帖子管理 ============ */}
      {tab === 'posts' && (
        <div className="space-y-2">
          {posts.map((p) => (
            <div
              key={p.id}
              className="flex items-center justify-between gap-3 bg-[var(--color-forum-card)] border border-[var(--color-forum-border)] rounded-lg p-3"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-[var(--color-forum-text)] truncate">
                    {p.title}
                  </span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--color-forum-hover)] text-muted shrink-0">
                    {BOARDS.find((b) => b.id === p.board)?.name || p.board}
                  </span>
                  {p.seriesId && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--color-forum-accent)] text-white shrink-0">
                      第{p.chapterNo ?? '?'}章
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted mt-0.5">
                  作者：{userName(p.authorId)} ·{' '}
                  {new Date(p.createdAt).toLocaleString('zh-CN', {
                    month: '2-digit',
                    day: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                  {' · '}
                  {p.replies.length} 回复 · {p.likes} 赞
                </p>
              </div>
              <button
                onClick={() => handleDeletePost(p)}
                className="px-2.5 py-1 rounded text-xs font-medium text-red-500 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors shrink-0"
              >
                删除
              </button>
            </div>
          ))}
          {posts.length === 0 && <p className="text-center text-muted text-sm py-8">还没有帖子</p>}
        </div>
      )}

      {/* ============ 操作日志 ============ */}
      {tab === 'logs' && (
        <div className="space-y-2">
          {logs.length === 0 && (
            <p className="text-center text-muted text-sm py-8">
              还没有操作记录。坛主的删帖、设坛主、删用户等操作都会自动记在这里。
            </p>
          )}
          {logs.map((l) => (
            <div
              key={l.id}
              className="flex items-start gap-3 bg-[var(--color-forum-card)] border border-[var(--color-forum-border)] rounded-lg p-3"
            >
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--color-forum-quote)] text-muted shrink-0 mt-0.5">
                {ACTION_LABEL[l.action] || l.action}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm text-[var(--color-forum-text)] break-words">{l.detail}</p>
                <p className="text-xs text-muted mt-0.5">
                  {l.actor_name || '坛主'} · {fmtDate(l.created_at)}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
