import { useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { usePostStore } from '../stores/postStore';
import { useUserStore } from '../stores/userStore';
import { useSiteStore } from '../stores/siteStore';
import { useThemeStore } from '../stores/themeStore';
import { useConfirmStore } from '../components/ConfirmDialog';
import { useToastStore } from '../stores/toastStore';
import { MainFloor } from '../components/ForumFloor';
import ReplyFloor from '../components/ForumFloor';
import ReplyForm from '../components/ReplyForm';
import { PostDetailSkeleton } from '../components/Skeleton';
import {
  exportAsText,
  exportAsMarkdown,
  downloadFile,
  copyToClipboard,
} from '../utils/exportThread';
import { downloadThreadImage } from '../utils/exportThreadImage';
import { BOARDS } from '../types';
import type { Reply } from '../types';

export default function PostDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const post = usePostStore((s) => (id ? s.getPost(id) : undefined));
  const loading = usePostStore((s) => s.loading);
  const deletePost = usePostStore((s) => s.deletePost);
  const updatePost = usePostStore((s) => s.updatePost);
  const toggleLike = usePostStore((s) => s.toggleLike);
  const allPosts = usePostStore((s) => s.posts);
  const allSeries = usePostStore((s) => s.series);
  const currentUser = useUserStore((s) => s.getCurrentUser());
  const siteName = useSiteStore((s) => s.siteName);
  const isDark = useThemeStore((s) => s.isDark);
  const confirmStore = useConfirmStore();
  const toast = useToastStore((s) => s);

  const [quoteReply, setQuoteReply] = useState<Reply | null>(null);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);
  const [onlyOP, setOnlyOP] = useState(false); // 只看楼主
  const [exportingImg, setExportingImg] = useState(false);

  // 连载信息
  const seriesInfo = post?.seriesId ? allSeries.find((x) => x.id === post.seriesId) : undefined;
  const chapters = post?.seriesId
    ? allPosts
        .filter((p) => p.seriesId === post.seriesId)
        .sort((a, b) => (a.chapterNo ?? 0) - (b.chapterNo ?? 0))
    : [];
  const myIndex = post ? chapters.findIndex((p) => p.id === post.id) : -1;
  const prevChapter = myIndex > 0 ? chapters[myIndex - 1] : null;
  const nextChapter = myIndex >= 0 && myIndex < chapters.length - 1 ? chapters[myIndex + 1] : null;

  // 编辑主楼状态
  const [editingMain, setEditingMain] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editContent, setEditContent] = useState('');
  const [editTags, setEditTags] = useState<string[]>([]);
  const [editTagInput, setEditTagInput] = useState('');
  const [editAllowParticipation, setEditAllowParticipation] = useState(true);
  const [editIsPublic, setEditIsPublic] = useState(true);
  const [editCreatedAt, setEditCreatedAt] = useState('');

  const isAuthor = currentUser && post && currentUser.id === post.authorId;
  const canReply =
    post?.allowParticipation || (currentUser && post?.authorId === currentUser.id);

  const board = post ? BOARDS.find((b) => b.id === post.board) : null;
  const hasLiked = currentUser && post && post.likedBy.includes(currentUser.id);

  const startEditing = () => {
    if (!post) return;
    setEditTitle(post.title);
    setEditContent(post.content);
    setEditTags([...post.tags]);
    setEditAllowParticipation(post.allowParticipation);
    setEditIsPublic(post.isPublic);
    setEditCreatedAt(new Date(post.createdAt).toISOString().slice(0, 16));
    setEditingMain(true);
  };

  const saveEdit = async () => {
    if (!post || !editTitle.trim() || !editContent.trim()) return;
    try {
      await updatePost(post.id, {
        title: editTitle.trim(),
        content: editContent.trim(),
        tags: editTags,
        isPublic: editIsPublic,
        allowParticipation: editAllowParticipation,
        createdAt: editCreatedAt ? new Date(editCreatedAt).getTime() : undefined,
      });
      setEditingMain(false);
      toast.success('帖子已更新');
    } catch {
      toast.error('更新失败');
    }
  };

  const handleEditAddTag = () => {
    const t = editTagInput.trim();
    if (t && !editTags.includes(t) && editTags.length < 8) {
      setEditTags([...editTags, t]);
    }
    setEditTagInput('');
  };

  const handleExportTxt = () => {
    if (!post) return;
    downloadFile(
      exportAsText(post, siteName),
      `${post.title.slice(0, 20)}.txt`,
      'text/plain;charset=utf-8'
    );
    setShowExportMenu(false);
    toast.success('已导出为 TXT');
  };

  const handleExportMd = () => {
    if (!post) return;
    downloadFile(
      exportAsMarkdown(post, siteName),
      `${post.title.slice(0, 20)}.md`,
      'text/markdown;charset=utf-8'
    );
    setShowExportMenu(false);
    toast.success('已导出为 Markdown');
  };

  const handleCopy = async () => {
    if (!post) return;
    const ok = await copyToClipboard(exportAsText(post));
    if (ok) {
      setCopySuccess(true);
      toast.success('已复制到剪贴板');
      setTimeout(() => setCopySuccess(false), 2000);
    } else {
      toast.error('复制失败');
    }
    setShowExportMenu(false);
  };

  const handleLike = async () => {
    if (!post || !currentUser) return;
    await toggleLike(post.id, currentUser.id);
  };

  const handleExportImage = async () => {
    if (!post) return;
    setShowExportMenu(false);
    setExportingImg(true);
    try {
      await downloadThreadImage(post, { siteName, dark: isDark });
      toast.success('长图已导出');
    } catch (e: any) {
      toast.error(e?.message || '长图导出失败');
    }
    setExportingImg(false);
  };

  const handleDeletePost = () => {
    if (!post) return;
    confirmStore.show({
      title: '删除帖子',
      message: `确定要删除「${post.title}」吗？所有回复也会被删除，此操作不可撤销。`,
      confirmText: '删除',
      danger: true,
      onConfirm: async () => {
        try {
          await deletePost(post.id);
          toast.success('帖子已删除');
          navigate('/');
        } catch {
          toast.error('删除失败');
        }
      },
    });
  };

  if (loading && !post) return <PostDetailSkeleton />;

  if (!post) {
    return (
      <div className="text-center py-20">
        <div className="text-5xl mb-4">🔍</div>
        <p className="text-lg text-muted">帖子不存在或已被删除</p>
        <Link to="/" className="inline-block mt-4 text-[var(--color-forum-header)] hover:underline">
          返回首页 →
        </Link>
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      {/* 面包屑导航 */}
      <div className="flex items-center gap-2 text-sm text-muted mb-4 flex-wrap">
        <Link to="/" className="hover:text-[var(--color-forum-header)] transition-colors">
          首页
        </Link>
        {board && (
          <>
            <span>›</span>
            <Link to={`/board/${board.id}`} className="hover:text-[var(--color-forum-header)] transition-colors">
              {board.icon} {board.name}
            </Link>
          </>
        )}
        <span>›</span>
        <span className="text-[var(--color-forum-text)] truncate">{post.title}</span>

        {post.tags.length > 0 && (
          <div className="flex gap-1 flex-wrap">
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

        {!post.isPublic && (
          <span className="text-xs px-1.5 py-0.5 rounded bg-[var(--color-forum-floor)] text-muted">
            🔒 隐藏
          </span>
        )}
        {!post.allowParticipation && (
          <span className="text-xs px-1.5 py-0.5 rounded bg-red-100 dark:bg-red-900/30 text-red-500">
            🚫 禁止回复
          </span>
        )}

        {post.editedAt && (
          <span className="text-xs text-muted">(已编辑)</span>
        )}

        <div className="ml-auto flex items-center gap-2">
          {/* Like button */}
          {currentUser && (
            <button
              onClick={handleLike}
              className={`text-xs font-bold transition-all flex items-center gap-1 ${
                hasLiked ? 'text-red-500 scale-110' : 'text-muted hover:text-red-400'
              }`}
            >
              {hasLiked ? '❤️' : '🤍'} {post.likes > 0 ? post.likes : '点赞'}
            </button>
          )}

          {/* Export button */}
          <div className="relative">
            <button
              onClick={() => setShowExportMenu(!showExportMenu)}
              className="text-xs text-[var(--color-forum-accent)] hover:opacity-80 transition-opacity font-bold"
            >
              📥 导出
            </button>
            {showExportMenu && (
              <>
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setShowExportMenu(false)}
                />
                <div className="absolute right-0 top-full mt-1 bg-[var(--color-forum-card)] rounded-lg shadow-xl border border-[var(--color-forum-border)] py-1 z-20 min-w-[160px] animate-scale-in">
                  <button
                    onClick={handleExportTxt}
                    className="w-full text-left px-4 py-2 text-sm text-[var(--color-forum-text)] hover:bg-[var(--color-forum-hover)]"
                  >
                    📄 导出为文本 (.txt)
                  </button>
                  <button
                    onClick={handleExportMd}
                    className="w-full text-left px-4 py-2 text-sm text-[var(--color-forum-text)] hover:bg-[var(--color-forum-hover)]"
                  >
                    📝 导出为 Markdown (.md)
                  </button>
                  <button
                    onClick={handleExportImage}
                    disabled={exportingImg}
                    className="w-full text-left px-4 py-2 text-sm text-[var(--color-forum-text)] hover:bg-[var(--color-forum-hover)] disabled:opacity-50"
                  >
                    {exportingImg ? '🖼️ 正在生成长图...' : '🖼️ 导出为长图 (.png)'}
                  </button>
                  <hr className="my-1 border-[var(--color-forum-border)]" />
                  <button
                    onClick={handleCopy}
                    className="w-full text-left px-4 py-2 text-sm text-[var(--color-forum-text)] hover:bg-[var(--color-forum-hover)]"
                  >
                    {copySuccess ? '✅ 已复制！' : '📋 复制到剪贴板'}
                  </button>
                </div>
              </>
            )}
          </div>

          {isAuthor && (
            <>
              <button
                onClick={startEditing}
                className="text-xs text-[var(--color-forum-header)] hover:opacity-80 transition-opacity"
              >
                ✏️ 编辑
              </button>
              <button
                onClick={handleDeletePost}
                className="text-xs text-muted hover:text-red-500 transition-colors"
              >
                删除
              </button>
            </>
          )}
        </div>
      </div>

      {/* 连载章节导航 */}
      {seriesInfo && (
        <div className="forum-floor p-3 mb-4 border-l-4 border-[var(--color-forum-accent)]">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-bold text-[var(--color-forum-text)]">
              📖 {seriesInfo.title}
            </span>
            <span className="text-xs text-muted">
              第 {post.chapterNo ?? '?'} / {chapters.length} 章
            </span>
            <div className="ml-auto flex items-center gap-2 text-xs">
              {prevChapter ? (
                <Link
                  to={`/post/${prevChapter.id}`}
                  className="px-2 py-1 rounded border border-[var(--color-forum-border)] text-muted hover:border-[var(--color-forum-header)] hover:text-[var(--color-forum-header)] transition-colors"
                >
                  ← 上一章
                </Link>
              ) : (
                <span className="px-2 py-1 rounded border border-[var(--color-forum-border)] text-muted opacity-40">
                  ← 上一章
                </span>
              )}
              <Link
                to={`/series/${seriesInfo.id}`}
                className="px-2 py-1 rounded bg-[var(--color-forum-header)] text-white hover:opacity-90 transition-opacity"
              >
                ☰ 目录
              </Link>
              {nextChapter ? (
                <Link
                  to={`/post/${nextChapter.id}`}
                  className="px-2 py-1 rounded border border-[var(--color-forum-border)] text-muted hover:border-[var(--color-forum-header)] hover:text-[var(--color-forum-header)] transition-colors"
                >
                  下一章 →
                </Link>
              ) : (
                <span className="px-2 py-1 rounded border border-[var(--color-forum-border)] text-muted opacity-40">
                  下一章 →
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 编辑主楼表单 */}
      {editingMain ? (
        <div className="forum-floor p-5 mb-6 border-2 border-[var(--color-forum-header)]">
          <h3 className="font-bold text-[var(--color-forum-text)] mb-4">✏️ 编辑帖子</h3>

          <div className="mb-3">
            <label className="block text-xs font-bold text-muted mb-1">标题</label>
            <input
              type="text"
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              className="w-full border border-[var(--color-forum-border)] bg-[var(--color-forum-card)] text-[var(--color-forum-text)] rounded p-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-forum-header)]"
            />
          </div>

          <div className="mb-3">
            <label className="block text-xs font-bold text-muted mb-1">内容</label>
            <textarea
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              rows={8}
              className="w-full border border-[var(--color-forum-border)] bg-[var(--color-forum-card)] text-[var(--color-forum-text)] rounded p-2.5 text-sm resize-y focus:outline-none focus:ring-2 focus:ring-[var(--color-forum-header)]"
            />
          </div>

          <div className="mb-3">
            <label className="block text-xs font-bold text-muted mb-1">标签</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={editTagInput}
                onChange={(e) => setEditTagInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleEditAddTag();
                  }
                }}
                placeholder="输入后回车添加"
                className="flex-1 border border-[var(--color-forum-border)] bg-[var(--color-forum-card)] text-[var(--color-forum-text)] rounded p-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-forum-header)]"
              />
              <button
                type="button"
                onClick={handleEditAddTag}
                className="px-3 py-2 bg-[var(--color-forum-floor)] rounded text-sm text-muted hover:bg-[var(--color-forum-hover)]"
              >
                + 添加
              </button>
            </div>
            {editTags.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {editTags.map((t) => (
                  <span
                    key={t}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-[var(--color-forum-header)] text-white"
                  >
                    {t}
                    <button
                      type="button"
                      onClick={() => setEditTags(editTags.filter((tag) => tag !== t))}
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {post.postType === 'forum_sim' && (
            <div className="mb-3">
              <label className="block text-xs font-bold text-muted mb-1">🕐 发帖时间</label>
              <input
                type="datetime-local"
                value={editCreatedAt}
                onChange={(e) => setEditCreatedAt(e.target.value)}
                className="w-full border border-[var(--color-forum-border)] bg-[var(--color-forum-card)] text-[var(--color-forum-text)] rounded p-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-forum-header)]"
              />
            </div>
          )}

          <div className="mb-3">
            <label className="block text-xs font-bold text-muted mb-1">👁️ 可见性</label>
            <div className="flex gap-2">
              <label className={`flex-1 flex items-center justify-center gap-1 p-2 rounded border cursor-pointer text-xs ${editIsPublic ? 'border-[var(--color-forum-accent)] bg-green-50 dark:bg-green-900/20' : 'border-[var(--color-forum-border)]'}`}>
                <input type="radio" name="edit-vis" checked={editIsPublic} onChange={() => setEditIsPublic(true)} className="sr-only" />
                🌐 公开
              </label>
              <label className={`flex-1 flex items-center justify-center gap-1 p-2 rounded border cursor-pointer text-xs ${!editIsPublic ? 'border-[var(--color-forum-header)] bg-blue-50 dark:bg-blue-900/20' : 'border-[var(--color-forum-border)]'}`}>
                <input type="radio" name="edit-vis" checked={!editIsPublic} onChange={() => setEditIsPublic(false)} className="sr-only" />
                🔒 隐藏
              </label>
            </div>
          </div>

          <div className="mb-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={editAllowParticipation}
                onChange={(e) => setEditAllowParticipation(e.target.checked)}
                className="w-4 h-4 accent-[var(--color-forum-accent)]"
              />
              <span className="text-sm text-[var(--color-forum-text)]">允许其他用户回复此帖子</span>
            </label>
          </div>

          <div className="flex gap-2">
            <button
              onClick={saveEdit}
              disabled={!editTitle.trim() || !editContent.trim()}
              className="px-4 py-2 bg-[var(--color-forum-accent)] text-white rounded font-bold text-sm hover:opacity-90 disabled:opacity-40"
            >
              💾 保存修改
            </button>
            <button
              onClick={() => setEditingMain(false)}
              className="px-4 py-2 bg-[var(--color-forum-floor)] text-muted rounded text-sm hover:bg-[var(--color-forum-hover)]"
            >
              取消
            </button>
          </div>
        </div>
      ) : (
        <MainFloor post={post} />
      )}

      {/* 回复列表 */}
      {post.replies.length > 0 && (
        <div className="mb-6">
          <div className="flex items-center justify-between gap-2 mb-3 flex-wrap">
            <div className="text-sm text-muted font-bold">
              共 {post.replies.length} 条回复
            </div>
            {post.replies.some((r) => r.userId === post.authorId) && (
              <div className="flex gap-1.5">
                <button
                  onClick={() => setOnlyOP(false)}
                  className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
                    !onlyOP
                      ? 'bg-[var(--color-forum-header)] text-white border-transparent'
                      : 'bg-[var(--color-forum-card)] text-muted border-[var(--color-forum-border)]'
                  }`}
                >
                  全部
                </button>
                <button
                  onClick={() => setOnlyOP(true)}
                  className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
                    onlyOP
                      ? 'bg-[var(--color-forum-header)] text-white border-transparent'
                      : 'bg-[var(--color-forum-card)] text-muted border-[var(--color-forum-border)]'
                  }`}
                >
                  只看楼主
                </button>
              </div>
            )}
          </div>
          {(() => {
            const list = onlyOP
              ? post.replies.filter((r) => r.userId === post.authorId)
              : post.replies;
            if (list.length === 0) {
              return (
                <p className="text-center text-muted text-sm py-8">楼主还没有在这帖里回复过</p>
              );
            }
            return list.map((reply) => (
              <div key={reply.id} className="relative group">
                <ReplyFloor
                  reply={reply}
                  allReplies={post.replies}
                  postId={post.id}
                  postAuthorId={post.authorId}
                  isOP={!!reply.userId && reply.userId === post.authorId}
                />
                {canReply && (
                  <button
                    onClick={() => setQuoteReply(reply)}
                    className="absolute top-3 right-3 text-xs text-muted hover:text-[var(--color-forum-accent)] transition-colors opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
                  >
                    💬 引用
                  </button>
                )}
              </div>
            ));
          })()}
        </div>
      )}

      {post.replies.length === 0 && (
        <div className="text-center py-10 text-muted mb-6">
          <div className="text-3xl mb-2">💬</div>
          <p>
            {post.allowParticipation ? '暂无回复，来抢沙发吧！' : '楼主关闭了回复功能'}
          </p>
        </div>
      )}

      {/* 回复表单 */}
      {canReply ? (
        <div className="mb-8">
          <h3 className="text-sm font-bold text-muted mb-3">发表回复</h3>
          <ReplyForm
            postId={post.id}
            quoteReply={quoteReply}
            onQuoteClear={() => setQuoteReply(null)}
            postType={post.postType}
          />
        </div>
      ) : (
        <div className="text-center py-6 mb-8 forum-floor p-4 text-muted text-sm">
          🔒 楼主已关闭此帖子的回复功能
        </div>
      )}
    </div>
  );
}
