import { useState, useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import { usePostStore } from '../stores/postStore';
import { useUserStore } from '../stores/userStore';
import { useConfirmStore } from '../components/ConfirmDialog';
import { useToastStore } from '../stores/toastStore';
import CharacterAvatar from '../components/CharacterAvatar';
import { PostListSkeleton } from '../components/Skeleton';
import { forumImageUrl } from '../lib/supabase';
import { BOARDS } from '../types';

function formatTime(ts: number): string {
  const d = new Date(ts);
  const now = new Date();
  const diff = now.getTime() - ts;
  const pad = (n: number) => n.toString().padStart(2, '0');

  if (diff < 60000) return '刚刚';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}分钟前`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}小时前`;
  if (diff < 604800000) return `${Math.floor(diff / 86400000)}天前`;
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

type SortOption = 'newest' | 'oldest' | 'most_replies' | 'most_likes';

const sortLabels: Record<SortOption, string> = {
  newest: '最新',
  oldest: '最早',
  most_replies: '回复最多',
  most_likes: '点赞最多',
};

export default function PostList() {
  const { boardId } = useParams<{ boardId: string }>();
  const allPosts = usePostStore((s) => s.posts);
  const loading = usePostStore((s) => s.loading);
  const error = usePostStore((s) => s.error);
  const deletePost = usePostStore((s) => s.deletePost);
  const currentUser = useUserStore((s) => s.getCurrentUser());
  const users = useUserStore((s) => s.users);
  const confirmStore = useConfirmStore();
  const toast = useToastStore((s) => s);

  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('newest');
  const [filterBoard, setFilterBoard] = useState<string | null>(boardId || null);

  const board = BOARDS.find((b) => b.id === boardId);
  const effectiveBoard = boardId || filterBoard;

  const filteredPosts = useMemo(() => {
    let posts = allPosts.filter(
      (p) =>
        (!effectiveBoard || p.board === effectiveBoard) &&
        (p.isPublic || (currentUser && p.authorId === currentUser.id))
    );

    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      posts = posts.filter(
        (p) =>
          p.title.toLowerCase().includes(q) ||
          p.content.toLowerCase().includes(q) ||
          p.tags.some((t) => t.toLowerCase().includes(q)) ||
          p.characterName.toLowerCase().includes(q)
      );
    }

    switch (sortBy) {
      case 'oldest':
        posts = [...posts].sort((a, b) => a.createdAt - b.createdAt);
        break;
      case 'most_replies':
        posts = [...posts].sort((a, b) => b.replies.length - a.replies.length);
        break;
      case 'most_likes':
        posts = [...posts].sort((a, b) => b.likes - a.likes);
        break;
      default:
        posts = [...posts].sort((a, b) => b.createdAt - a.createdAt);
    }

    return posts;
  }, [allPosts, effectiveBoard, searchQuery, sortBy, currentUser]);

  const handleDelete = (postId: string, title: string) => {
    confirmStore.show({
      title: '删除帖子',
      message: `确定要删除「${title}」吗？所有回复也会被删除，此操作不可撤销。`,
      confirmText: '删除',
      danger: true,
      onConfirm: async () => {
        try {
          await deletePost(postId);
          toast.success('帖子已删除');
        } catch {
          toast.error('删除失败，请重试');
        }
      },
    });
  };

  if (loading) return <PostListSkeleton />;

  if (error) {
    return (
      <div className="text-center py-20">
        <div className="text-5xl mb-4">😵</div>
        <p className="text-lg text-muted mb-2">{error}</p>
        <button
          onClick={() => window.location.reload()}
          className="px-4 py-2 bg-[var(--color-forum-header)] text-white rounded-lg text-sm hover:opacity-90"
        >
          重新加载
        </button>
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      {/* Board header */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div className="flex items-center gap-3">
          {board && (
            <>
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center text-xl"
                style={{ backgroundColor: board.color + '22' }}
              >
                {board.icon}
              </div>
              <div>
                <h2 className="text-xl font-bold" style={{ color: board.color }}>
                  {board.name}
                </h2>
                <p className="text-xs text-muted">{board.description}</p>
              </div>
            </>
          )}
          {!board && (
            <h2 className="text-2xl font-bold text-[var(--color-forum-text)]">全部帖子</h2>
          )}
        </div>

        {currentUser ? (
          <Link
            to={boardId ? `/create-post/${boardId}` : '/create-post'}
            className="px-4 py-2 bg-[var(--color-forum-accent)] text-white rounded-lg font-bold hover:opacity-90 transition-opacity text-sm flex items-center gap-1"
          >
            <span>✏️</span> 发帖
          </Link>
        ) : (
          <Link
            to="/login"
            className="px-4 py-2 bg-[var(--color-forum-header)] text-white rounded-lg font-bold hover:opacity-90 transition-opacity text-sm"
          >
            登录后发帖
          </Link>
        )}
      </div>

      {/* 板块筛选（仅"全部帖子"视图） */}
      {!boardId && (
        <div className="flex gap-2 mb-3 flex-wrap">
          <button
            onClick={() => setFilterBoard(null)}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-colors border ${
              !filterBoard
                ? 'bg-[var(--color-forum-header)] text-white border-transparent'
                : 'bg-[var(--color-forum-card)] text-muted border-[var(--color-forum-border)] hover:text-[var(--color-forum-text)]'
            }`}
          >
            全部
          </button>
          {BOARDS.map((b) => (
            <button
              key={b.id}
              onClick={() => setFilterBoard(filterBoard === b.id ? null : b.id)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors border ${
                filterBoard === b.id
                  ? 'text-white border-transparent'
                  : 'bg-[var(--color-forum-card)] text-muted border-[var(--color-forum-border)] hover:text-[var(--color-forum-text)]'
              }`}
              style={filterBoard === b.id ? { backgroundColor: b.color } : undefined}
            >
              {b.icon} {b.name}
            </button>
          ))}
        </div>
      )}

      {/* Search & Sort */}
      {filteredPosts.length > 0 || searchQuery ? (
        <div className="flex gap-2 mb-4 flex-wrap">
          <div className="flex-1 min-w-[200px] relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted text-sm">🔍</span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="搜索标题、内容、标签..."
              className="w-full pl-9 pr-3 py-2 border border-[var(--color-forum-border)] bg-[var(--color-forum-card)] text-[var(--color-forum-text)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-forum-header)] focus:border-transparent"
            />
          </div>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortOption)}
            className="px-3 py-2 border border-[var(--color-forum-border)] bg-[var(--color-forum-card)] text-[var(--color-forum-text)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-forum-header)] cursor-pointer"
          >
            {(Object.keys(sortLabels) as SortOption[]).map((key) => (
              <option key={key} value={key}>{sortLabels[key]}</option>
            ))}
          </select>
        </div>
      ) : null}

      {/* Posts */}
      {filteredPosts.length === 0 ? (
        <div className="text-center py-20">
          <div className="text-5xl mb-4">{searchQuery ? '🔍' : '📭'}</div>
          <p className="text-lg text-muted">
            {searchQuery ? '没有找到匹配的帖子' : '还没有帖子，快来发第一个吧！'}
          </p>
          {currentUser && !searchQuery && (
            <Link
              to={boardId ? `/create-post/${boardId}` : '/create-post'}
              className="inline-block mt-4 text-[var(--color-forum-accent)] hover:underline"
            >
              去发帖 →
            </Link>
          )}
          {!currentUser && !searchQuery && (
            <Link
              to="/login"
              className="inline-block mt-4 text-[var(--color-forum-header)] hover:underline"
            >
              登录后发帖 →
            </Link>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {filteredPosts.map((post) => {
            const postBoard = BOARDS.find((b) => b.id === post.board);
            const isAuthor = currentUser && currentUser.id === post.authorId;
            const author = users.find((u) => u.id === post.authorId);

            return (
              <div
                key={post.id}
                className="forum-floor card-lift board-bar p-4 animate-fade-in"
                style={{ ['--bar-color' as any]: postBoard?.color || '#4a6d8c' }}
              >
                <div className="flex items-start gap-3 pl-1">
                  <CharacterAvatar
                    avatar={post.characterAvatar}
                    name={post.characterName}
                    size="md"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Link
                        to={`/post/${post.id}`}
                        className="text-lg font-bold text-[var(--color-forum-text)] hover:text-[var(--color-forum-header)] transition-colors"
                      >
                        {post.title}
                      </Link>
                      {post.postType === 'forum_sim' && (
                        <span className="badge bg-[var(--color-forum-header)] text-white">
                          论坛体
                        </span>
                      )}
                      {post.seriesId && (
                        <span className="badge bg-[var(--color-forum-accent)] text-white">
                          第{post.chapterNo ?? '?'}章
                        </span>
                      )}
                      {!post.allowParticipation && (
                        <span className="badge bg-red-100 dark:bg-red-900/30 text-red-500">
                          🔒 禁回
                        </span>
                      )}
                      {post.editedAt && <span className="text-xs text-muted">已编辑</span>}
                    </div>

                    {/* Tags */}
                    {post.tags.length > 0 && (
                      <div className="flex gap-1 flex-wrap mt-1.5">
                        {post.tags.map((t) => (
                          <span
                            key={t}
                            className="text-xs px-1.5 py-0.5 rounded-full bg-[var(--color-forum-quote)] text-muted"
                          >
                            #{t}
                          </span>
                        ))}
                      </div>
                    )}

                    <div className="flex items-center gap-2.5 mt-2 text-xs text-muted flex-wrap">
                      {(isAuthor || postBoard) && (
                        <span className="flex items-center gap-1">
                          {postBoard && <span>{postBoard.icon}</span>}
                          <span className="font-medium text-[var(--color-forum-text)]">
                            {post.characterId ? post.characterName : '匿名用户'}
                          </span>
                          {author?.role === 'admin' && <span className="badge badge-admin">👑 坛主</span>}
                          {isAuthor && (
                            <span className="badge bg-[var(--color-forum-accent)]/15 text-[var(--color-forum-accent)]">
                              我发的
                            </span>
                          )}
                        </span>
                      )}
                      <span>{formatTime(post.createdAt)}</span>
                      <span className="badge bg-[var(--color-forum-floor)] text-muted">
                        💬 {post.replies.length}
                      </span>
                      {post.likes > 0 && (
                        <span className="badge bg-red-50 dark:bg-red-900/25 text-red-500">
                          👍 {post.likes}
                        </span>
                      )}
                    </div>
                    {post.imageUrls.length > 0 && (
                      <div className="thumb-strip">
                        {post.imageUrls.slice(0, 4).map((img) => (
                          <img key={img} src={forumImageUrl(img)} alt="" loading="lazy" />
                        ))}
                        {post.imageUrls.length > 4 && (
                          <span className="text-xs text-muted self-center ml-1">
                            +{post.imageUrls.length - 4}
                          </span>
                        )}
                      </div>
                    )}
                    <p className="text-sm text-muted mt-2 line-clamp-2 whitespace-pre-wrap">
                      {post.content}
                    </p>
                  </div>
                  {isAuthor && (
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        handleDelete(post.id, post.title);
                      }}
                      className="text-xs text-muted hover:text-red-500 transition-colors shrink-0 mt-1"
                    >
                      删除
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
