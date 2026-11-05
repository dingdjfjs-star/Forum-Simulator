import { useCharacterStore } from '../stores/characterStore';
import { usePostStore } from '../stores/postStore';
import { useUserStore } from '../stores/userStore';
import { useConfirmStore } from './ConfirmDialog';
import { useToastStore } from '../stores/toastStore';
import { forumImageUrl } from '../lib/supabase';
import type { Reply, Post as PostType } from '../types';
import CharacterAvatar from './CharacterAvatar';
import QuoteBox from './QuoteBox';

interface ReplyFloorProps {
  reply: Reply;
  allReplies: Reply[];
  postId: string;
  postAuthorId: string;
  isOP?: boolean;
}

function formatTime(ts: number): string {
  const d = new Date(ts);
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}`;
}

function ReplyFloor({ reply, allReplies, postId, postAuthorId, isOP }: ReplyFloorProps) {
  const character = useCharacterStore((s) => s.getCharacter(reply.characterId));
  const deleteReply = usePostStore((s) => s.deleteReply);
  const currentUser = useUserStore((s) => s.getCurrentUser());
  const replyAuthor = useUserStore((s) => (reply.userId ? s.getUser(reply.userId) : undefined));
  const confirmStore = useConfirmStore();
  const toast = useToastStore((s) => s);

  const quotedReply = reply.quoteId
    ? allReplies.find((r) => r.id === reply.quoteId)
    : null;

  const displayName = reply.characterId
    ? reply.characterName
    : '匿名用户';
  const displayAvatar = reply.characterId
    ? reply.characterAvatar
    : '👤';
  const signature = character?.signature || '';

  // 权限修复：只有回复者本人或帖子作者可以删除
  const canDelete =
    currentUser &&
    ((reply.userId && reply.userId === currentUser.id) ||
      currentUser.id === postAuthorId);

  const handleDelete = () => {
    confirmStore.show({
      title: '删除回复',
      message: '确定要删除这条回复吗？',
      confirmText: '删除',
      danger: true,
      onConfirm: async () => {
        try {
          await deleteReply(postId, reply.id);
          toast.success('回复已删除');
        } catch {
          toast.error('删除失败');
        }
      },
    });
  };

  return (
    <div
      className={`forum-floor p-4 mb-3 transition-shadow hover:shadow-md ${
        isOP ? 'main-post' : ''
      }`}
      id={`floor-${reply.floor}`}
    >
      {/* 楼层头部 */}
      <div className="flex items-center gap-3 mb-3 pb-2 border-b border-dashed border-[var(--color-forum-border)]">
        <CharacterAvatar avatar={displayAvatar} name={displayName} size="md" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className={`font-bold text-sm ${
                reply.characterId ? 'text-[var(--color-forum-header)]' : 'text-muted'
              }`}
            >
              {displayName}
            </span>
            {isOP && (
              <span className="text-xs bg-[var(--color-forum-header)] text-white px-1.5 py-0.5 rounded">
                楼主
              </span>
            )}
            {replyAuthor?.role === 'admin' && (
              <span className="badge badge-admin">👑 坛主</span>
            )}
            {!reply.characterId && (
              <span className="text-xs bg-[var(--color-forum-floor)] text-muted px-1.5 py-0.5 rounded">
                匿名
              </span>
            )}
          </div>
        </div>
        <div className="text-right shrink-0">
          <span className="text-xs font-mono bg-[var(--color-forum-floor)] px-2 py-0.5 rounded text-muted font-bold">
            #{reply.floor}
          </span>
          <div className="text-xs text-muted mt-1">
            {formatTime(reply.createdAt)}
          </div>
        </div>
      </div>

      {/* 引用框 */}
      {quotedReply && (
        <QuoteBox
          floor={quotedReply.floor}
          characterName={
            quotedReply.characterId
              ? quotedReply.characterName
              : '匿名用户'
          }
          content={quotedReply.content}
        />
      )}

      {/* 楼层内容 */}
      <div className="post-body whitespace-pre-wrap break-words text-[var(--color-forum-text)]">
        {reply.content}
      </div>

      {/* 小尾巴 */}
      {signature && (
        <div className="signature">—— {signature}</div>
      )}

      {/* 删除按钮 - 仅授权用户可见 */}
      {canDelete && (
        <div className="mt-2 text-right">
          <button
            onClick={handleDelete}
            className="text-xs text-muted hover:text-red-500 transition-colors"
          >
            删除
          </button>
        </div>
      )}
    </div>
  );
}

// 主楼层包装
interface MainFloorProps {
  post: PostType;
}

export function MainFloor({ post }: MainFloorProps) {
  const character = useCharacterStore((s) => s.getCharacter(post.characterId));
  const author = useUserStore((s) => s.getUser(post.authorId));
  const displayName = post.characterId ? post.characterName : '匿名用户';
  const displayAvatar = post.characterId ? post.characterAvatar : '👤';
  const signature = character?.signature || '';

  return (
    <div className="forum-floor main-post p-5 mb-6">
      <div className="flex items-center gap-3 mb-4 pb-3 border-b-2 border-[var(--color-forum-header)]">
        <CharacterAvatar avatar={displayAvatar} name={displayName} size="lg" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className={`font-bold text-base ${
                post.characterId ? 'text-[var(--color-forum-header)]' : 'text-muted'
              }`}
            >
              {displayName}
            </span>
            <span className="text-xs bg-[var(--color-forum-header)] text-white px-1.5 py-0.5 rounded">
              楼主
            </span>
            {author?.role === 'admin' && <span className="badge badge-admin">👑 坛主</span>}
            {post.postType === 'forum_sim' && (
              <span className="text-xs px-1.5 py-0.5 rounded bg-[var(--color-forum-accent)] text-white">
                论坛体
              </span>
            )}
          </div>
          <h2 className="text-lg font-bold mt-1 text-[var(--color-forum-text)]">{post.title}</h2>
        </div>
        <div className="text-right shrink-0">
          <span className="text-xs font-mono bg-[var(--color-forum-accent)] text-white px-2 py-0.5 rounded font-bold">
            主楼
          </span>
          <div className="text-xs text-muted mt-1">
            {formatTime(post.createdAt)}
          </div>
        </div>
      </div>

      <div className="post-body whitespace-pre-wrap break-words text-[var(--color-forum-text)]">
        {post.content}
      </div>

      {/* 配图 */}
      {post.imageUrls && post.imageUrls.length > 0 && (
        <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 gap-2">
          {post.imageUrls.map((p) => (
            <a
              key={p}
              href={forumImageUrl(p)}
              target="_blank"
              rel="noreferrer"
              className="block rounded-lg overflow-hidden border border-[var(--color-forum-border)] bg-[var(--color-forum-quote)]"
            >
              <img
                src={forumImageUrl(p)}
                alt=""
                loading="lazy"
                className="w-full h-32 sm:h-40 object-cover hover:opacity-90 transition-opacity"
              />
            </a>
          ))}
        </div>
      )}

      {signature && <div className="signature">—— {signature}</div>}
    </div>
  );
}

export default ReplyFloor;
