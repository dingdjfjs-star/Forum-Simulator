import { useState, useEffect, useRef } from 'react';
import { useNavigate, Link, useParams } from 'react-router-dom';
import { useCharacterStore } from '../stores/characterStore';
import { usePostStore } from '../stores/postStore';
import { useUserStore } from '../stores/userStore';
import { useToastStore } from '../stores/toastStore';
import CharacterAvatar from '../components/CharacterAvatar';
import { BOARDS } from '../types';
import { forumImageUrl } from '../lib/supabase';
import { uploadImage, validateImageFile } from '../utils/imageUpload';
import type { PostType } from '../types';

interface Draft {
  title: string;
  content: string;
  board: string;
  postType: PostType;
  tags: string[];
  allowParticipation: boolean;
  isPublic: boolean;
  images: string[];
  seriesId: string;
  chapterNo: string;
  savedAt: number;
}

export default function CreatePost() {
  const navigate = useNavigate();
  const { boardId } = useParams<{ boardId: string }>();
  const currentUser = useUserStore((s) => s.getCurrentUser());
  const characters = useCharacterStore((s) => s.characters);
  const addPost = usePostStore((s) => s.addPost);
  const addSeries = usePostStore((s) => s.addSeries);
  const allSeries = usePostStore((s) => s.series);
  const getSeriesPosts = usePostStore((s) => s.getSeriesPosts);
  const toast = useToastStore((s) => s);

  const initialBoard = boardId || 'daily';
  const board = BOARDS.find((b) => b.id === initialBoard);

  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [selectedBoard, setSelectedBoard] = useState(initialBoard);
  const [postType, setPostType] = useState<PostType>(
    board?.allowForumSim ? 'forum_sim' : 'normal'
  );
  const [selectedCharId, setSelectedCharId] = useState<string | null>(null);
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [tagInput, setTagInput] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [allowParticipation, setAllowParticipation] = useState(true);
  const [isPublic, setIsPublic] = useState(true);
  const [customTime, setCustomTime] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // 图片
  const [images, setImages] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // 连载
  const [seriesId, setSeriesId] = useState<string>(''); // '' = 不连载, 'new' = 新建
  const [newSeriesTitle, setNewSeriesTitle] = useState('');
  const [chapterNo, setChapterNo] = useState('');

  // 草稿
  const draftKey = currentUser ? `forum-draft-${currentUser.id}` : '';
  const [draftPrompt, setDraftPrompt] = useState<Draft | null>(null);
  const [restored, setRestored] = useState(false);

  const selectedBoardObj = BOARDS.find((b) => b.id === selectedBoard);
  const myChars = currentUser ? characters.filter((c) => c.userId === currentUser.id) : [];
  const mySeries = currentUser ? allSeries.filter((s) => s.authorId === currentUser.id) : [];

  const useCharacters = postType === 'forum_sim';
  const selectedChar = useCharacters
    ? isAnonymous
      ? null
      : myChars.find((c) => c.id === selectedCharId) ?? null
    : null;

  const displayName = useCharacters
    ? isAnonymous
      ? '匿名用户'
      : selectedChar?.name ?? '匿名用户'
    : currentUser?.username ?? '';
  const displayAvatar = useCharacters
    ? isAnonymous
      ? '👤'
      : selectedChar?.avatar ?? '👤'
    : currentUser?.avatar ?? '👤';

  // ---------- 草稿：进入页面时检查 ----------
  useEffect(() => {
    if (!draftKey) return;
    try {
      const raw = localStorage.getItem(draftKey);
      if (raw) {
        const d: Draft = JSON.parse(raw);
        if (d.title?.trim() || d.content?.trim() || (d.images && d.images.length)) {
          setDraftPrompt(d);
        }
      }
    } catch {
      /* 忽略损坏的草稿 */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftKey]);

  // ---------- 草稿：自动保存（防抖）----------
  useEffect(() => {
    if (!draftKey || restored) return;
    if (!title.trim() && !content.trim() && images.length === 0) return;
    const timer = setTimeout(() => {
      const d: Draft = {
        title,
        content,
        board: selectedBoard,
        postType,
        tags,
        allowParticipation,
        isPublic,
        images,
        seriesId,
        chapterNo,
        savedAt: Date.now(),
      };
      try {
        localStorage.setItem(draftKey, JSON.stringify(d));
      } catch {
        /* 存储满忽略 */
      }
    }, 800);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    title,
    content,
    selectedBoard,
    postType,
    tags,
    allowParticipation,
    isPublic,
    images,
    seriesId,
    chapterNo,
    draftKey,
    restored,
  ]);

  const applyDraft = () => {
    if (!draftPrompt) return;
    const d = draftPrompt;
    setTitle(d.title || '');
    setContent(d.content || '');
    if (d.board) setSelectedBoard(d.board);
    if (d.postType) setPostType(d.postType);
    setTags(d.tags || []);
    setAllowParticipation(d.allowParticipation ?? true);
    setIsPublic(d.isPublic ?? true);
    setImages(d.images || []);
    setSeriesId(d.seriesId || '');
    setChapterNo(d.chapterNo || '');
    setDraftPrompt(null);
    setRestored(true);
    toast.success('草稿已恢复');
  };

  const discardDraft = () => {
    if (draftKey) localStorage.removeItem(draftKey);
    setDraftPrompt(null);
    setRestored(true);
  };

  const clearDraft = () => {
    if (draftKey) localStorage.removeItem(draftKey);
  };

  // ---------- 图片上传 ----------
  const handlePickImages = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const remain = 9 - images.length;
    if (remain <= 0) {
      toast.error('最多上传 9 张图片');
      return;
    }
    const chosen = Array.from(files).slice(0, remain);
    setUploading(true);
    const uploaded: string[] = [];
    for (const f of chosen) {
      const err = validateImageFile(f);
      if (err) {
        toast.error(`${f.name}：${err}`);
        continue;
      }
      try {
        uploaded.push(await uploadImage(f));
      } catch (e: any) {
        toast.error(`${f.name} 上传失败：${e?.message || '请重试'}`);
      }
    }
    if (uploaded.length) {
      setImages((prev) => [...prev, ...uploaded]);
      toast.success(`已上传 ${uploaded.length} 张图片`);
    }
    setUploading(false);
    if (fileRef.current) fileRef.current.value = '';
  };

  const removeImage = (p: string) => setImages((prev) => prev.filter((x) => x !== p));

  // ---------- 其他 ----------
  const handleAddTag = () => {
    const t = tagInput.trim();
    if (t && !tags.includes(t) && tags.length < 8) setTags([...tags, t]);
    setTagInput('');
  };

  const handleTagKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddTag();
    }
  };

  const handleBoardChange = (newBoardId: string) => {
    const newBoard = BOARDS.find((b) => b.id === newBoardId);
    setSelectedBoard(newBoardId);
    if (!newBoard?.allowForumSim && postType === 'forum_sim') setPostType('normal');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    const trimmedTitle = title.trim();
    const trimmedContent = content.trim();
    if (!trimmedTitle || !trimmedContent) return;

    setSubmitting(true);
    try {
      // 新建连载
      let finalSeriesId: string | null = null;
      if (seriesId === 'new' && newSeriesTitle.trim()) {
        const s = await addSeries({
          authorId: currentUser.id,
          title: newSeriesTitle.trim(),
          board: selectedBoard,
        });
        finalSeriesId = s.id;
      } else if (seriesId && seriesId !== 'new') {
        finalSeriesId = seriesId;
      }

      const post = await addPost({
        title: trimmedTitle,
        authorId: currentUser.id,
        characterId: useCharacters ? (isAnonymous ? null : selectedChar?.id ?? null) : null,
        characterName: displayName,
        characterAvatar: displayAvatar,
        content: trimmedContent,
        tags,
        isPublic,
        allowParticipation,
        board: selectedBoard,
        postType,
        imageUrls: images,
        seriesId: finalSeriesId,
        chapterNo: finalSeriesId
          ? chapterNo.trim()
            ? Number(chapterNo)
            : getSeriesPosts(finalSeriesId).length + 1
          : null,
        createdAt: customTime ? new Date(customTime).getTime() : undefined,
      });
      clearDraft();
      toast.success('帖子发布成功！');
      navigate(`/post/${post.id}`);
    } catch (err: any) {
      toast.error(err?.message || '发帖失败，请重试');
      setSubmitting(false);
    }
  };

  if (!currentUser) {
    return (
      <div className="text-center py-20">
        <div className="text-5xl mb-4">🔒</div>
        <p className="text-lg text-muted">请先登录后发帖</p>
        <Link to="/login" className="inline-block mt-4 text-[var(--color-forum-header)] hover:underline">
          去登录 →
        </Link>
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      <h2 className="text-2xl font-bold text-[var(--color-forum-text)] mb-6">📝 发布新帖</h2>

      {/* 草稿恢复提示 */}
      {draftPrompt && (
        <div className="forum-floor p-3 mb-4 flex items-center gap-3 flex-wrap border-l-4 border-amber-400">
          <span className="text-sm text-[var(--color-forum-text)]">
            💾 检测到一篇未发布的草稿（保存于{' '}
            {new Date(draftPrompt.savedAt).toLocaleString('zh-CN', {
              month: '2-digit',
              day: '2-digit',
              hour: '2-digit',
              minute: '2-digit',
            })}
            ）
          </span>
          <div className="flex gap-2 ml-auto">
            <button
              type="button"
              onClick={applyDraft}
              className="px-3 py-1 bg-[var(--color-forum-header)] text-white rounded text-xs font-bold hover:opacity-90"
            >
              恢复
            </button>
            <button
              type="button"
              onClick={discardDraft}
              className="px-3 py-1 bg-[var(--color-forum-floor)] text-muted rounded text-xs hover:bg-[var(--color-forum-hover)]"
            >
              丢弃
            </button>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="forum-floor p-6 max-w-2xl">
        {/* 板块选择 */}
        <div className="mb-4">
          <label className="block text-sm font-bold text-muted mb-2">
            📂 选择板块 <span className="text-red-400">*</span>
          </label>
          <div className="flex gap-2 flex-wrap">
            {BOARDS.map((b) => (
              <button
                key={b.id}
                type="button"
                onClick={() => handleBoardChange(b.id)}
                className={`flex items-center gap-1 px-3 py-1.5 rounded text-sm border transition-colors ${
                  selectedBoard === b.id
                    ? 'text-white border-transparent'
                    : 'bg-[var(--color-forum-card)] text-muted border-[var(--color-forum-border)] hover:border-[var(--color-forum-header)]'
                }`}
                style={selectedBoard === b.id ? { backgroundColor: b.color } : {}}
              >
                {b.icon} {b.name}
              </button>
            ))}
          </div>
        </div>

        {/* 帖子类型切换 */}
        {selectedBoardObj?.allowForumSim && (
          <div className="mb-4">
            <label className="block text-sm font-bold text-muted mb-2">📝 帖子类型</label>
            <div className="flex gap-3">
              <label
                className={`flex-1 flex items-center justify-center gap-2 p-3 rounded-lg border-2 cursor-pointer transition-colors ${
                  postType === 'normal'
                    ? 'border-[var(--color-forum-accent)] bg-green-50 dark:bg-green-900/20'
                    : 'border-[var(--color-forum-border)] hover:border-[var(--color-forum-header)]'
                }`}
              >
                <input
                  type="radio"
                  name="postType"
                  checked={postType === 'normal'}
                  onChange={() => setPostType('normal')}
                  className="sr-only"
                />
                <span className="text-lg">✍️</span>
                <div className="text-left">
                  <div className="text-sm font-bold text-[var(--color-forum-text)]">普通发帖</div>
                  <div className="text-xs text-muted">用你的用户名直接发帖</div>
                </div>
              </label>
              <label
                className={`flex-1 flex items-center justify-center gap-2 p-3 rounded-lg border-2 cursor-pointer transition-colors ${
                  postType === 'forum_sim'
                    ? 'border-[var(--color-forum-header)] bg-blue-50 dark:bg-blue-900/20'
                    : 'border-[var(--color-forum-border)] hover:border-[var(--color-forum-header)]'
                }`}
              >
                <input
                  type="radio"
                  name="postType"
                  checked={postType === 'forum_sim'}
                  onChange={() => setPostType('forum_sim')}
                  className="sr-only"
                />
                <span className="text-lg">🎭</span>
                <div className="text-left">
                  <div className="text-sm font-bold text-[var(--color-forum-text)]">论坛体模式</div>
                  <div className="text-xs text-muted">扮演角色、自定义时间、可导出</div>
                </div>
              </label>
            </div>
          </div>
        )}

        {/* 标题 */}
        <div className="mb-4">
          <label className="block text-sm font-bold text-muted mb-1">
            帖子标题 <span className="text-red-400">*</span>
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="输入标题..."
            className="w-full border border-[var(--color-forum-border)] bg-[var(--color-forum-card)] text-[var(--color-forum-text)] rounded p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-forum-header)] focus:border-transparent"
            required
          />
        </div>

        {/* 连载 */}
        {selectedBoardObj?.allowForumSim && (
          <div className="mb-4">
            <label className="block text-sm font-bold text-muted mb-2">
              📚 连载分章（可选）
            </label>
            <div className="flex gap-2 flex-wrap">
              <button
                type="button"
                onClick={() => setSeriesId('')}
                className={`px-3 py-1.5 rounded text-sm border transition-colors ${
                  seriesId === ''
                    ? 'bg-[var(--color-forum-header)] text-white border-transparent'
                    : 'bg-[var(--color-forum-card)] text-muted border-[var(--color-forum-border)] hover:border-[var(--color-forum-header)]'
                }`}
              >
                单篇发布
              </button>
              {mySeries.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => {
                    setSeriesId(s.id);
                    setChapterNo(String(getSeriesPosts(s.id).length + 1));
                  }}
                  className={`px-3 py-1.5 rounded text-sm border transition-colors max-w-[180px] truncate ${
                    seriesId === s.id
                      ? 'bg-[var(--color-forum-accent)] text-white border-transparent'
                      : 'bg-[var(--color-forum-card)] text-muted border-[var(--color-forum-border)] hover:border-[var(--color-forum-header)]'
                  }`}
                >
                  📖 {s.title}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setSeriesId('new')}
                className={`px-3 py-1.5 rounded text-sm border border-dashed transition-colors ${
                  seriesId === 'new'
                    ? 'bg-amber-500 text-white border-transparent'
                    : 'text-muted border-[var(--color-forum-border)] hover:border-[var(--color-forum-header)]'
                }`}
              >
                ＋ 新建连载
              </button>
            </div>

            {seriesId === 'new' && (
              <input
                type="text"
                value={newSeriesTitle}
                onChange={(e) => setNewSeriesTitle(e.target.value)}
                placeholder="连载名称，例如：观星者手记"
                className="mt-2 w-full border border-[var(--color-forum-border)] bg-[var(--color-forum-card)] text-[var(--color-forum-text)] rounded p-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-forum-header)]"
              />
            )}

            {seriesId && (
              <div className="mt-2 flex items-center gap-2">
                <span className="text-xs text-muted">本章序号</span>
                <input
                  type="number"
                  min={1}
                  value={chapterNo}
                  onChange={(e) => setChapterNo(e.target.value)}
                  placeholder="自动"
                  className="w-24 border border-[var(--color-forum-border)] bg-[var(--color-forum-card)] text-[var(--color-forum-text)] rounded p-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-forum-header)]"
                />
                <span className="text-xs text-muted">留空自动接下一章</span>
              </div>
            )}
          </div>
        )}

        {/* 发帖身份 */}
        {useCharacters && (
          <div className="mb-4">
            <label className="block text-sm font-bold text-muted mb-2">发帖身份（楼主）</label>
            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={() => {
                  setIsAnonymous(true);
                  setSelectedCharId(null);
                }}
                className={`flex items-center gap-1 px-3 py-1.5 rounded text-sm border transition-colors ${
                  isAnonymous
                    ? 'bg-gray-700 text-white border-gray-700'
                    : 'bg-[var(--color-forum-card)] text-muted border-[var(--color-forum-border)] hover:border-[var(--color-forum-header)]'
                }`}
              >
                👤 匿名
              </button>
              {myChars.map((ch) => (
                <button
                  key={ch.id}
                  type="button"
                  onClick={() => {
                    setIsAnonymous(false);
                    setSelectedCharId(ch.id);
                  }}
                  className={`flex items-center gap-1 px-3 py-1.5 rounded text-sm border transition-colors ${
                    !isAnonymous && selectedCharId === ch.id
                      ? 'bg-[var(--color-forum-header)] text-white border-[var(--color-forum-header)]'
                      : 'bg-[var(--color-forum-card)] text-muted border-[var(--color-forum-border)] hover:border-[var(--color-forum-header)]'
                  }`}
                >
                  <CharacterAvatar avatar={ch.avatar} name={ch.name} size="sm" />
                  <span className="max-w-[100px] truncate">{ch.name}</span>
                </button>
              ))}
              {myChars.length === 0 && (
                <span className="text-xs text-muted">
                  还没有角色，将匿名发帖（可先去
                  <Link to="/characters" className="text-[var(--color-forum-header)] hover:underline mx-1">
                    角色管理
                  </Link>
                  创建角色）
                </span>
              )}
            </div>
          </div>
        )}

        {/* 发帖时间 */}
        {useCharacters && (
          <div className="mb-4">
            <label className="block text-sm font-bold text-muted mb-1">🕐 发帖时间</label>
            <input
              type="datetime-local"
              value={customTime}
              onChange={(e) => setCustomTime(e.target.value)}
              className="w-full border border-[var(--color-forum-border)] bg-[var(--color-forum-card)] text-[var(--color-forum-text)] rounded p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-forum-header)] focus:border-transparent"
            />
            <p className="text-xs text-muted mt-1">留空则使用当前时间</p>
          </div>
        )}

        {/* 内容 */}
        <div className="mb-4">
          <label className="block text-sm font-bold text-muted mb-1">
            帖子内容 <span className="text-red-400">*</span>
          </label>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder={useCharacters ? '写下帖子内容... (支持换行，可扮演角色)' : '写下帖子内容...'}
            rows={10}
            className="w-full border border-[var(--color-forum-border)] bg-[var(--color-forum-card)] text-[var(--color-forum-text)] rounded p-3 text-sm resize-y focus:outline-none focus:ring-2 focus:ring-[var(--color-forum-header)] focus:border-transparent"
            required
          />
          <p className="text-xs text-muted mt-1">
            {content.length} 字 · 约 {Math.max(1, Math.round(content.length / 350))} 分钟读完
            <span className="ml-2">· 内容会自动存草稿</span>
          </p>
        </div>

        {/* 配图 */}
        <div className="mb-4">
          <label className="block text-sm font-bold text-muted mb-2">
            🖼️ 配图（最多 9 张，自动压缩）
          </label>
          <div className="flex flex-wrap gap-2">
            {images.map((p) => (
              <div key={p} className="relative w-20 h-20 rounded overflow-hidden border border-[var(--color-forum-border)] group">
                <img src={forumImageUrl(p)} alt="" className="w-full h-full object-cover" />
                <button
                  type="button"
                  onClick={() => removeImage(p)}
                  className="absolute top-0.5 right-0.5 w-5 h-5 rounded-full bg-black/60 text-white text-xs leading-5 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  ×
                </button>
              </div>
            ))}
            {images.length < 9 && (
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                className="w-20 h-20 rounded border-2 border-dashed border-[var(--color-forum-border)] text-muted hover:border-[var(--color-forum-header)] transition-colors flex flex-col items-center justify-center gap-1 disabled:opacity-50"
              >
                {uploading ? (
                  <span className="w-4 h-4 border-2 border-[var(--color-forum-border)] border-t-[var(--color-forum-header)] rounded-full animate-spin" />
                ) : (
                  <>
                    <span className="text-xl">＋</span>
                    <span className="text-[10px]">添加图片</span>
                  </>
                )}
              </button>
            )}
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => handlePickImages(e.target.files)}
          />
        </div>

        {/* 标签 */}
        <div className="mb-4">
          <label className="block text-sm font-bold text-muted mb-2">🏷️ 标签</label>
          <div className="flex gap-2">
            <input
              type="text"
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={handleTagKeyDown}
              placeholder="输入标签后按回车添加"
              className="flex-1 border border-[var(--color-forum-border)] bg-[var(--color-forum-card)] text-[var(--color-forum-text)] rounded p-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-forum-header)] focus:border-transparent"
            />
            <button
              type="button"
              onClick={handleAddTag}
              disabled={!tagInput.trim() || tags.length >= 8}
              className="px-3 py-2 bg-[var(--color-forum-floor)] text-muted rounded text-sm hover:bg-[var(--color-forum-hover)] transition-colors disabled:opacity-40"
            >
              + 添加
            </button>
          </div>
          {tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {tags.map((t) => (
                <span
                  key={t}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-[var(--color-forum-header)] text-white"
                >
                  {t}
                  <button type="button" onClick={() => setTags(tags.filter((tag) => tag !== t))} className="hover:text-red-200">
                    ×
                  </button>
                </span>
              ))}
            </div>
          )}
          <p className="text-xs text-muted mt-1">最多8个标签</p>
        </div>

        {/* 参与控制 */}
        <div className="mb-4">
          <label className="block text-sm font-bold text-muted mb-2">⚙️ 参与设置</label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={allowParticipation}
              onChange={(e) => setAllowParticipation(e.target.checked)}
              className="w-4 h-4 accent-[var(--color-forum-accent)]"
            />
            <span className="text-sm text-[var(--color-forum-text)]">允许其他用户回复此帖子</span>
          </label>
        </div>

        {/* 可见性 */}
        <div className="mb-4">
          <label className="block text-sm font-bold text-muted mb-2">👁️ 帖子可见性</label>
          <div className="flex gap-3">
            <label
              className={`flex-1 flex items-center justify-center gap-2 p-3 rounded border-2 cursor-pointer transition-colors ${
                isPublic
                  ? 'border-[var(--color-forum-accent)] bg-green-50 dark:bg-green-900/20'
                  : 'border-[var(--color-forum-border)] hover:border-[var(--color-forum-header)]'
              }`}
            >
              <input type="radio" name="visibility" checked={isPublic} onChange={() => setIsPublic(true)} className="sr-only" />
              <span className="text-lg">🌐</span>
              <div className="text-left">
                <div className="text-sm font-bold text-[var(--color-forum-text)]">公开</div>
                <div className="text-xs text-muted">所有人可见</div>
              </div>
            </label>
            <label
              className={`flex-1 flex items-center justify-center gap-2 p-3 rounded border-2 cursor-pointer transition-colors ${
                !isPublic
                  ? 'border-[var(--color-forum-header)] bg-blue-50 dark:bg-blue-900/20'
                  : 'border-[var(--color-forum-border)] hover:border-[var(--color-forum-header)]'
              }`}
            >
              <input type="radio" name="visibility" checked={!isPublic} onChange={() => setIsPublic(false)} className="sr-only" />
              <span className="text-lg">🔒</span>
              <div className="text-left">
                <div className="text-sm font-bold text-[var(--color-forum-text)]">隐藏</div>
                <div className="text-xs text-muted">仅自己可见</div>
              </div>
            </label>
          </div>
        </div>

        {/* 发帖人预览 */}
        <div className="flex items-center gap-2 mb-4 p-3 bg-[var(--color-forum-quote)] rounded text-sm text-muted flex-wrap">
          <span>发帖身份预览：</span>
          <CharacterAvatar avatar={displayAvatar} name={displayName} size="sm" />
          <span className="text-[var(--color-forum-text)]">{displayName}</span>
          {useCharacters && selectedChar?.signature && (
            <span className="text-xs text-muted">(小尾巴: {selectedChar.signature})</span>
          )}
          <span className="ml-auto text-xs">用户：{currentUser.username}</span>
        </div>

        {/* 提交 */}
        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={!title.trim() || !content.trim() || submitting || uploading}
            className="px-6 py-2.5 bg-[var(--color-forum-header)] text-white rounded-lg font-bold hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {submitting ? (
              <>
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                发布中...
              </>
            ) : (
              '发布帖子'
            )}
          </button>
          <button
            type="button"
            onClick={() => {
              clearDraft();
              toast.info('草稿已清除');
            }}
            className="text-xs text-muted hover:text-[var(--color-forum-text)]"
          >
            清除草稿
          </button>
        </div>
      </form>
    </div>
  );
}
