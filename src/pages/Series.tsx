import { useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import { usePostStore } from '../stores/postStore';
import { useUserStore } from '../stores/userStore';
import { BOARDS } from '../types';

function fmtDate(ts: number): string {
  return new Date(ts).toLocaleDateString('zh-CN');
}

/** 连载总览 */
export function SeriesList() {
  const series = usePostStore((s) => s.series);
  const posts = usePostStore((s) => s.posts);
  const userById = useUserStore((s) => s.getUser);

  const items = useMemo(
    () =>
      series.map((s) => ({
        s,
        count: posts.filter((p) => p.seriesId === s.id).length,
        author: userById(s.authorId),
      })),
    [series, posts, userById]
  );

  return (
    <div className="animate-fade-in">
      <h2 className="text-2xl font-bold text-[var(--color-forum-text)] mb-2">📚 连载书架</h2>
      <p className="text-sm text-muted mb-6">分章连载的长文作品都收在这里</p>

      {items.length === 0 ? (
        <div className="text-center py-16 text-muted">
          <div className="text-4xl mb-3">📭</div>
          <p className="text-sm">还没有任何连载</p>
          <Link
            to="/create-post/cp"
            className="inline-block mt-4 text-sm text-[var(--color-forum-header)] hover:underline"
          >
            去开一个连载 →
          </Link>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {items.map(({ s, count, author }) => {
            const board = BOARDS.find((b) => b.id === s.board);
            return (
              <Link
                key={s.id}
                to={`/series/${s.id}`}
                className="forum-floor p-4 card-lift border-l-4"
                style={{ borderLeftColor: board?.color || 'var(--color-forum-header)' }}
              >
                <div className="flex items-center gap-2">
                  <span className="text-lg">{board?.icon || '📖'}</span>
                  <span className="font-bold text-[var(--color-forum-text)] truncate">{s.title}</span>
                </div>
                {s.description && (
                  <p className="text-xs text-muted mt-1.5 line-clamp-2">{s.description}</p>
                )}
                <div className="text-xs text-muted mt-2 flex items-center gap-2 flex-wrap">
                  <span>{author?.username || '匿名'}</span>
                  <span>·</span>
                  <span>{count} 章</span>
                  <span>·</span>
                  <span>最近更新 {fmtDate(s.updatedAt)}</span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

/** 单个连载的目录 */
export function SeriesDetail() {
  const { id } = useParams<{ id: string }>();
  const series = usePostStore((s) => (id ? s.getSeries(id) : undefined));
  const allPosts = usePostStore((s) => s.posts);
  const userById = useUserStore((s) => s.getUser);

  const chapters = useMemo(
    () =>
      allPosts
        .filter((p) => p.seriesId === id)
        .sort((a, b) => (a.chapterNo ?? 0) - (b.chapterNo ?? 0)),
    [allPosts, id]
  );

  if (!series) {
    return (
      <div className="text-center py-20">
        <div className="text-5xl mb-4">🔍</div>
        <p className="text-lg text-muted">连载不存在或已被删除</p>
        <Link to="/series" className="inline-block mt-4 text-[var(--color-forum-header)] hover:underline">
          返回书架 →
        </Link>
      </div>
    );
  }

  const author = userById(series.authorId);
  const board = BOARDS.find((b) => b.id === series.board);

  return (
    <div className="animate-fade-in">
      <div className="forum-floor p-6 mb-5">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-2xl">{board?.icon || '📖'}</span>
          <h2 className="text-xl font-bold text-[var(--color-forum-text)]">{series.title}</h2>
        </div>
        {series.description && (
          <p className="text-sm text-muted mb-3 whitespace-pre-wrap">{series.description}</p>
        )}
        <div className="text-xs text-muted flex items-center gap-2 flex-wrap">
          {author && (
            <Link to={`/user/${author.id}`} className="hover:text-[var(--color-forum-header)]">
              ✍️ {author.username}
            </Link>
          )}
          <span>·</span>
          <span>共 {chapters.length} 章</span>
          <span>·</span>
          <span>创建于 {fmtDate(series.createdAt)}</span>
        </div>
      </div>

      <h3 className="text-sm font-bold text-muted mb-3">章节目录</h3>
      {chapters.length === 0 ? (
        <p className="text-sm text-muted text-center py-10">这个连载还没有章节</p>
      ) : (
        <div className="space-y-2">
          {chapters.map((c) => (
            <Link
              key={c.id}
              to={`/post/${c.id}`}
              className="flex items-center gap-3 forum-floor p-3 card-lift"
            >
              <span className="shrink-0 w-12 text-center text-xs font-mono font-bold px-1.5 py-1 rounded bg-[var(--color-forum-quote)] text-muted">
                第{c.chapterNo ?? '?'}章
              </span>
              <span className="flex-1 min-w-0 font-bold text-sm text-[var(--color-forum-text)] truncate">
                {c.title}
              </span>
              <span className="text-xs text-muted shrink-0 hidden sm:inline">
                {c.replies.length} 回复 · {c.likes} 赞
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
