import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useCharacterStore } from '../stores/characterStore';
import { usePostStore } from '../stores/postStore';
import { useUserStore } from '../stores/userStore';
import { useToastStore } from '../stores/toastStore';
import type { Reply, PostType } from '../types';
import CharacterAvatar from './CharacterAvatar';

interface Props {
  postId: string;
  quoteReply?: Reply | null;
  onQuoteClear?: () => void;
  postType?: PostType;
}

/** 随机路人素材：写不动的时候给你个"意外" */
const RANDOM_NAMES = [
  '路过的甲',
  '吃瓜群众',
  '深夜潜水员',
  '一只小透明',
  '蹲后续的',
  '隔壁老王',
  '云养猫人士',
  '路过的小可爱',
];
const RANDOM_LINES = [
  '前排围观，蹲一个后续。',
  '催更催更，蹲了好久了！',
  '哈哈哈哈笑死我了，这段写得好。',
  '所以呢？然后呢？快说下去！',
  '这波我站楼主。',
  '默默收藏了，写得好。',
  '顶顶顶，别沉了。',
  '看完心里空落落的，还有吗？',
  '细节好戳，我哭了。',
  '虽然没看懂，但大受震撼。',
];

export default function ReplyForm({ postId, quoteReply, onQuoteClear, postType = 'normal' }: Props) {
  const [content, setContent] = useState('');
  const [selectedCharId, setSelectedCharId] = useState<string | null>(null);
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [customTime, setCustomTime] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const currentUser = useUserStore((s) => s.getCurrentUser());
  const characters = useCharacterStore((s) => s.characters);
  const addReply = usePostStore((s) => s.addReply);
  const toast = useToastStore((s) => s);

  // 论坛体帖子才用角色选择
  const useCharacters = postType === 'forum_sim';

  const myChars = currentUser
    ? characters.filter((c) => c.userId === currentUser.id)
    : [];

  const selectedChar = useCharacters
    ? (isAnonymous ? null : myChars.find((c) => c.id === selectedCharId) ?? null)
    : null;

  const displayName = useCharacters
    ? (isAnonymous ? '匿名用户' : selectedChar?.name ?? '匿名用户')
    : (currentUser?.username || '匿名用户');
  const displayAvatar = useCharacters
    ? (isAnonymous ? '👤' : selectedChar?.avatar ?? '👤')
    : (currentUser?.avatar || '👤');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = content.trim();
    if (!trimmed) return;

    setSubmitting(true);
    try {
      const result = await addReply(postId, {
        userId: useCharacters ? (isAnonymous ? null : currentUser?.id ?? null) : (currentUser?.id ?? null),
        characterId: useCharacters ? (isAnonymous ? null : selectedChar?.id ?? null) : null,
        characterName: displayName,
        characterAvatar: displayAvatar,
        content: trimmed,
        quoteId: quoteReply?.id ?? null,
        createdAt: customTime ? new Date(customTime).getTime() : undefined,
      });

      if (result) {
        setContent('');
        setCustomTime('');
        if (quoteReply && onQuoteClear) onQuoteClear();
        toast.success('回复成功');
      } else {
        toast.error('回复失败');
      }
    } catch {
      toast.error('回复失败，请重试');
    }
    setSubmitting(false);
  };

  const handleRandom = () => {
    const name = RANDOM_NAMES[Math.floor(Math.random() * RANDOM_NAMES.length)];
    const line = RANDOM_LINES[Math.floor(Math.random() * RANDOM_LINES.length)];
    if (useCharacters) {
      setIsAnonymous(true);
      setSelectedCharId(null);
    }
    setContent((c) => (c.trim() ? `${c}\n${line}` : line));
    toast.info(`「${name}」路过并留下一句话`);
  };

  if (!currentUser) {
    return (
      <div className="forum-floor p-4 text-center text-sm text-muted">
        <Link to="/login" className="text-[var(--color-forum-header)] hover:underline">
          登录
        </Link>
        {' '}后即可回复
      </div>
    );
  }

  return (
    <div className="forum-floor p-4 sticky bottom-4 shadow-lg border-2 border-[var(--color-forum-accent)]">
      {/* 引用提示 */}
      {quoteReply && (
        <div className="flex items-center gap-2 mb-3 p-2 bg-[var(--color-forum-quote)] rounded text-sm">
          <span className="text-muted">
            正在回复 #{quoteReply.floor}{' '}
            {quoteReply.characterId ? quoteReply.characterName : '匿名用户'}
          </span>
          <button
            onClick={onQuoteClear}
            className="text-red-400 hover:text-red-600 text-xs ml-auto"
          >
            ✕ 取消引用
          </button>
        </div>
      )}

      <form onSubmit={handleSubmit}>
        {/* 角色选择器 - 仅论坛体帖子显示 */}
        {useCharacters && (
          <div className="flex items-center gap-2 mb-3 flex-wrap">
            <span className="text-xs text-muted shrink-0">发言身份：</span>

            <button
              type="button"
              onClick={() => { setIsAnonymous(true); setSelectedCharId(null); }}
              className={`flex items-center gap-1 px-2 py-1 rounded text-xs border transition-colors ${
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
                onClick={() => { setIsAnonymous(false); setSelectedCharId(ch.id); }}
                className={`flex items-center gap-1 px-2 py-1 rounded text-xs border transition-colors ${
                  !isAnonymous && selectedCharId === ch.id
                    ? 'bg-[var(--color-forum-header)] text-white border-[var(--color-forum-header)]'
                    : 'bg-[var(--color-forum-card)] text-muted border-[var(--color-forum-border)] hover:border-[var(--color-forum-header)]'
                }`}
              >
                <span>{/^(\p{Emoji_Presentation}|\p{Emoji}️|\p{Emoji_Modifier_Base}\p{Emoji_Modifier}?){1,2}$/u.test(ch.avatar) ? ch.avatar : '🖼️'}</span>
                <span className="max-w-[80px] truncate">{ch.name}</span>
              </button>
            ))}

            {myChars.length === 0 && (
              <span className="text-xs text-muted">
                暂无角色，
                <Link to="/characters" className="text-[var(--color-forum-header)] hover:underline">去创建</Link>
              </span>
            )}
          </div>
        )}

        {/* 自定义时间 - 仅论坛体帖子显示 */}
        {useCharacters && (
          <div className="mb-3">
            <input
              type="datetime-local"
              value={customTime}
              onChange={(e) => setCustomTime(e.target.value)}
              className="w-full border border-[var(--color-forum-border)] bg-[var(--color-forum-card)] text-[var(--color-forum-text)] rounded p-2 text-xs focus:outline-none focus:ring-2 focus:ring-[var(--color-forum-accent)] focus:border-transparent"
            />
            <p className="text-xs text-muted mt-0.5">留空自动基于上一条回复时间顺延 1~15 分钟</p>
          </div>
        )}

        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder={useCharacters ? "写下你的回复... (可扮演角色)" : "写下你的回复..."}
          rows={4}
          className="w-full border border-[var(--color-forum-border)] bg-[var(--color-forum-card)] text-[var(--color-forum-text)] rounded p-3 text-sm resize-y focus:outline-none focus:ring-2 focus:ring-[var(--color-forum-accent)] focus:border-transparent"
        />

        <div className="flex items-center justify-between mt-3">
          <div className="flex items-center gap-2 text-xs text-muted">
            <CharacterAvatar avatar={displayAvatar} name={displayName} size="sm" />
            <span>{displayName}</span>
            <button
              type="button"
              onClick={handleRandom}
              title="随机来一句路人回复（写不动时用）"
              className="ml-1 px-2 py-0.5 rounded border border-[var(--color-forum-border)] hover:border-[var(--color-forum-accent)] hover:text-[var(--color-forum-accent)] transition-colors"
            >
              🎲 路人
            </button>
          </div>
          <button
            type="submit"
            disabled={!content.trim() || submitting}
            className="px-6 py-2 bg-[var(--color-forum-accent)] text-white rounded font-bold text-sm hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {submitting ? (
              <>
                <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                回复中...
              </>
            ) : (
              '回复'
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
