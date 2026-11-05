import { useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useUserStore } from '../stores/userStore';
import { usePostStore } from '../stores/postStore';
import { useCharacterStore } from '../stores/characterStore';
import { BOARDS } from '../types';
import { mainTitle, computeAchievements } from '../utils/achievements';
import CharacterAvatar from '../components/CharacterAvatar';

const EMOJI_RE = /^(\p{Emoji_Presentation}|\p{Emoji}️|\p{Emoji_Modifier_Base}\p{Emoji_Modifier}?){1,2}$/u;

export default function UserProfile() {
  const { id } = useParams<{ id: string }>();
  const getUser = useUserStore((s) => s.getUser);
  const currentUser = useUserStore((s) => s.getCurrentUser());
  const allPosts = usePostStore((s) => s.posts);
  const allSeries = usePostStore((s) => s.series);
  const characters = useCharacterStore((s) => s.characters);

  const user = id ? getUser(id) : undefined;

  const myPosts = useMemo(
    () => (id ? allPosts.filter((p) => p.authorId === id) : []),
    [allPosts, id]
  );
  const mySeries = useMemo(
    () => (id ? allSeries.filter((s) => s.authorId === id) : []),
    [allSeries, id]
  );
  const myChars = useMemo(
    () => (id ? characters.filter((c) => c.userId === id) : []),
    [characters, id]
  );

  if (!user) {
    return (
      <div className="text-center py-20">
        <div className="text-5xl mb-4">🔍</div>
        <p className="text-lg text-muted">用户不存在</p>
        <Link to="/" className="inline-block mt-4 text-[var(--color-forum-header)] hover:underline">
          返回首页 →
        </Link>
      </div>
    );
  }

  const title = mainTitle(myPosts.length);
  const achievements = computeAchievements(myPosts, mySeries.length, user.createdAt);
  const likeCount = myPosts.reduce((s, p) => s + p.likes, 0);
  const isEmoji = user.avatar ? EMOJI_RE.test(user.avatar) : false;

  return (
    <div className="animate-fade-in">
      <div className="grid gap-6 lg:grid-cols-3">
        {/* 左侧资料卡 */}
        <div className="lg:col-span-1 space-y-4">
          <div className="forum-floor p-6 text-center">
            <div className="flex justify-center">
              {isEmoji ? (
                <span className="text-5xl">{user.avatar}</span>
              ) : (
                <img
                  src={user.avatar}
                  alt=""
                  className="w-20 h-20 rounded-full object-cover border-2 border-[var(--color-forum-border)]"
                />
              )}
            </div>
            <h3 className="text-xl font-bold text-[var(--color-forum-text)] mt-3">{user.username}</h3>
            <div className="flex items-center justify-center gap-2 mt-2 flex-wrap">
              {user.role === 'admin' && <span className="badge badge-admin">👑 坛主</span>}
              <span className="badge">
                {title.icon} {title.name}
              </span>
            </div>
            {user.bio && (
              <p className="text-xs text-muted mt-3 whitespace-pre-wrap break-words">{user.bio}</p>
            )}
            <p className="text-xs text-muted mt-3">
              加入于 {new Date(user.createdAt).toLocaleDateString('zh-CN')}
            </p>
            {currentUser?.id === user.id && (
              <Link
                to="/profile"
                className="inline-block mt-3 text-xs text-[var(--color-forum-header)] hover:underline"
              >
                编辑我的资料 →
              </Link>
            )}
          </div>

          {/* 成就 */}
          <div className="forum-floor p-5">
            <h3 className="font-bold text-sm text-[var(--color-forum-text)] mb-3">🏅 成就</h3>
            {achievements.length === 0 ? (
              <p className="text-xs text-muted">还没有解锁成就，加油！</p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {achievements.map((a) => (
                  <span
                    key={a.id}
                    title={a.desc}
                    className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs bg-[var(--color-forum-quote)] text-[var(--color-forum-text)]"
                  >
                    {a.icon} {a.name}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* 角色卡 */}
          {myChars.length > 0 && (
            <div className="forum-floor p-5">
              <h3 className="font-bold text-sm text-[var(--color-forum-text)] mb-3">
                🎭 角色（{myChars.length}）
              </h3>
              <div className="space-y-2">
                {myChars.map((c) => (
                  <div key={c.id} className="flex items-start gap-2 p-2 rounded bg-[var(--color-forum-quote)]">
                    <CharacterAvatar avatar={c.avatar} name={c.name} size="sm" />
                    <div className="min-w-0">
                      <div className="text-sm font-bold text-[var(--color-forum-text)] truncate">
                        {c.name}
                      </div>
                      {c.description && (
                        <div className="text-xs text-muted line-clamp-2">{c.description}</div>
                      )}
                      {c.signature && (
                        <div className="text-xs text-muted italic truncate">—— {c.signature}</div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* 右侧内容 */}
        <div className="lg:col-span-2 space-y-4">
          <div className="forum-floor p-5">
            <h3 className="font-bold text-[var(--color-forum-text)] mb-3">📊 统计</h3>
            <div className="grid grid-cols-4 gap-3 text-center">
              {[
                { v: myPosts.length, l: '发帖数', c: 'var(--color-forum-header)' },
                { v: myChars.length, l: '角色数', c: 'var(--color-forum-accent)' },
                { v: mySeries.length, l: '连载数', c: 'var(--color-forum-accent)' },
                { v: likeCount, l: '获赞数', c: '#e8556f' },
              ].map((x) => (
                <div key={x.l} className="bg-[var(--color-forum-quote)] rounded p-3">
                  <div className="text-xl font-bold" style={{ color: x.c }}>
                    {x.v}
                  </div>
                  <div className="text-xs text-muted">{x.l}</div>
                </div>
              ))}
            </div>
          </div>

          {mySeries.length > 0 && (
            <div className="forum-floor p-5">
              <h3 className="font-bold text-[var(--color-forum-text)] mb-3">📚 连载作品</h3>
              <div className="space-y-2">
                {mySeries.map((s) => {
                  const count = allPosts.filter((p) => p.seriesId === s.id).length;
                  return (
                    <Link
                      key={s.id}
                      to={`/series/${s.id}`}
                      className="flex items-center gap-2 p-2 rounded hover:bg-[var(--color-forum-hover)] transition-colors"
                    >
                      <span className="text-sm font-bold text-[var(--color-forum-text)] truncate flex-1">
                        {s.title}
                      </span>
                      <span className="text-xs text-muted shrink-0">{count} 章</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          )}

          <div className="forum-floor p-5">
            <h3 className="font-bold text-[var(--color-forum-text)] mb-3">
              📝 发布的帖子（{myPosts.length}）
            </h3>
            {myPosts.length === 0 ? (
              <p className="text-sm text-muted">还没有发过帖子</p>
            ) : (
              <div className="space-y-2">
                {myPosts.map((p) => {
                  const board = BOARDS.find((b) => b.id === p.board);
                  return (
                    <Link
                      key={p.id}
                      to={`/post/${p.id}`}
                      className="block p-2 rounded hover:bg-[var(--color-forum-hover)] transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        {board && <span className="text-xs">{board.icon}</span>}
                        <span className="text-sm font-bold text-[var(--color-forum-text)] truncate flex-1">
                          {p.title}
                        </span>
                        {p.seriesId && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--color-forum-accent)] text-white shrink-0">
                            第{p.chapterNo ?? '?'}章
                          </span>
                        )}
                        {p.postType === 'forum_sim' && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--color-forum-header)] text-white shrink-0">
                            论坛体
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-muted mt-0.5">
                        {p.replies.length} 回复 · {p.likes} 赞
                        {p.imageUrls.length > 0 && ` · 🖼️ ${p.imageUrls.length}`}
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
