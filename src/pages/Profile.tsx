import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useUserStore } from '../stores/userStore';
import { usePostStore } from '../stores/postStore';
import { useCharacterStore } from '../stores/characterStore';
import { useToastStore } from '../stores/toastStore';
import AvatarUpload from '../components/AvatarUpload';
import { BOARDS } from '../types';
import { mainTitle, computeAchievements } from '../utils/achievements';

export default function Profile() {
  const navigate = useNavigate();
  const currentUser = useUserStore((s) => s.getCurrentUser());
  const updateProfile = useUserStore((s) => s.updateProfile);
  const logout = useUserStore((s) => s.logout);
  const posts = usePostStore((s) => s.posts);
  const allSeries = usePostStore((s) => s.series);
  const characters = useCharacterStore((s) => s.characters);
  const toast = useToastStore((s) => s);

  const [editing, setEditing] = useState(false);
  const [username, setUsername] = useState('');
  const [avatar, setAvatar] = useState('');
  const [bio, setBio] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (currentUser) {
      setUsername(currentUser.username);
      setAvatar(currentUser.avatar);
      setBio(currentUser.bio || '');
    }
  }, [currentUser]);

  if (!currentUser) {
    return (
      <div className="text-center py-20">
        <div className="text-5xl mb-4">🔒</div>
        <p className="text-lg text-muted">请先登录</p>
        <Link to="/login" className="inline-block mt-4 text-[var(--color-forum-header)] hover:underline">
          去登录 →
        </Link>
      </div>
    );
  }

  const myPosts = posts.filter((p) => p.authorId === currentUser.id);
  const myChars = characters.filter((c) => c.userId === currentUser.id);
  const mySeries = allSeries.filter((s) => s.authorId === currentUser.id);
  const myLikes = myPosts.reduce((sum, p) => sum + p.likes, 0);
  const title = mainTitle(myPosts.length);
  const achievements = computeAchievements(myPosts, mySeries.length, currentUser.createdAt);

  const handleSave = async () => {
    if (!username.trim() || username.trim().length < 2) return;
    setSaving(true);
    const result = await updateProfile(currentUser.id, {
      username: username.trim(),
      avatar,
      bio: bio.trim(),
    });
    setSaving(false);
    if (result.success) {
      setEditing(false);
      toast.success('个人信息已保存');
    } else {
      toast.error(result.error || '保存失败');
    }
  };

  const handleLogout = () => {
    logout();
    toast.info('已退出登录');
    navigate('/');
  };

  return (
    <div className="animate-fade-in">
      <h2 className="text-2xl font-bold text-[var(--color-forum-text)] mb-6">👤 个人中心</h2>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* 左侧：个人信息卡片 */}
        <div className="lg:col-span-1">
          <div className="forum-floor p-6 text-center">
            {editing ? (
              <div className="flex flex-col items-center">
                <AvatarUpload value={avatar} onChange={setAvatar} size="lg" />
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="mt-4 w-full border border-[var(--color-forum-border)] bg-[var(--color-forum-card)] text-[var(--color-forum-text)] rounded p-2 text-sm text-center focus:outline-none focus:ring-2 focus:ring-[var(--color-forum-header)] focus:border-transparent"
                  placeholder="用户名"
                />
                <textarea
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  rows={2}
                  maxLength={80}
                  className="mt-2 w-full border border-[var(--color-forum-border)] bg-[var(--color-forum-card)] text-[var(--color-forum-text)] rounded p-2 text-xs resize-none focus:outline-none focus:ring-2 focus:ring-[var(--color-forum-header)] focus:border-transparent"
                  placeholder="一句话介绍自己（选填，最多 80 字）"
                />
                <div className="flex gap-2 mt-3">
                  <button
                    onClick={handleSave}
                    disabled={!username.trim() || username.trim().length < 2 || saving}
                    className="px-4 py-1.5 bg-[var(--color-forum-accent)] text-white rounded text-sm font-bold hover:opacity-90 disabled:opacity-40"
                  >
                    {saving ? '保存中...' : '保存'}
                  </button>
                  <button
                    onClick={() => {
                      setEditing(false);
                      setUsername(currentUser.username);
                      setAvatar(currentUser.avatar);
                    }}
                    className="px-4 py-1.5 bg-[var(--color-forum-floor)] text-muted rounded text-sm hover:bg-[var(--color-forum-hover)]"
                  >
                    取消
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="flex justify-center">
                  {/^(\p{Emoji_Presentation}|\p{Emoji}️|\p{Emoji_Modifier_Base}\p{Emoji_Modifier}?){1,2}$/u.test(currentUser.avatar) ? (
                    <span className="text-5xl">{currentUser.avatar}</span>
                  ) : (
                    <img
                      src={currentUser.avatar}
                      alt="头像"
                      className="w-20 h-20 rounded-full object-cover border-2 border-[var(--color-forum-border)]"
                    />
                  )}
                </div>
                <h3 className="text-xl font-bold text-[var(--color-forum-text)] mt-3">
                  {currentUser.username}
                </h3>
                <div className="flex items-center justify-center gap-2 mt-2 flex-wrap">
                  {currentUser.role === 'admin' && <span className="badge badge-admin">👑 坛主</span>}
                  <span className="badge">
                    {title.icon} {title.name}
                  </span>
                </div>
                <p className="text-xs text-muted mt-2 whitespace-pre-wrap break-words">
                  {currentUser.bio || '这个人很懒，还没写简介'}
                </p>
                <p className="text-xs text-muted mt-2">
                  注册于 {new Date(currentUser.createdAt).toLocaleDateString('zh-CN')}
                </p>
                <Link
                  to={`/user/${currentUser.id}`}
                  className="inline-block mt-2 text-xs text-[var(--color-forum-header)] hover:underline"
                >
                  查看我的公开主页 →
                </Link>
                <div className="flex gap-2 mt-4 justify-center">
                  <button
                    onClick={() => setEditing(true)}
                    className="px-3 py-1.5 text-xs border border-[var(--color-forum-border)] rounded hover:bg-[var(--color-forum-hover)] transition-colors text-[var(--color-forum-text)]"
                  >
                    ✏️ 编辑
                  </button>
                  <button
                    onClick={handleLogout}
                    className="px-3 py-1.5 text-xs border border-red-200 text-red-400 rounded hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                  >
                    🚪 退出登录
                  </button>
                </div>
              </>
            )}
          </div>
        </div>

        {/* 右侧：统计 */}
        <div className="lg:col-span-2 space-y-4">
          <div className="forum-floor p-5">
            <h3 className="font-bold text-[var(--color-forum-text)] mb-3">📊 我的统计</h3>
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-[var(--color-forum-quote)] rounded p-3 text-center">
                <div className="text-2xl font-bold text-[var(--color-forum-header)]">
                  {myPosts.length}
                </div>
                <div className="text-xs text-muted">发帖数</div>
              </div>
              <div className="bg-[var(--color-forum-quote)] rounded p-3 text-center">
                <div className="text-2xl font-bold text-[var(--color-forum-accent)]">
                  {myChars.length}
                </div>
                <div className="text-xs text-muted">角色数</div>
              </div>
              <div className="bg-[var(--color-forum-quote)] rounded p-3 text-center">
                <div className="text-2xl font-bold text-red-400">
                  {myLikes}
                </div>
                <div className="text-xs text-muted">获赞数</div>
              </div>
            </div>
          </div>

          <div className="forum-floor p-5">
            <h3 className="font-bold text-[var(--color-forum-text)] mb-3">🏅 我的成就</h3>
            {achievements.length === 0 ? (
              <p className="text-sm text-muted">
                还没有解锁成就——发帖、获赞、开连载都会解锁徽章
              </p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {achievements.map((a) => (
                  <span
                    key={a.id}
                    title={a.desc}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs bg-[var(--color-forum-quote)] text-[var(--color-forum-text)]"
                  >
                    {a.icon} {a.name}
                  </span>
                ))}
              </div>
            )}
          </div>

          {mySeries.length > 0 && (
            <div className="forum-floor p-5">
              <h3 className="font-bold text-[var(--color-forum-text)] mb-3">📚 我的连载</h3>
              <div className="space-y-2">
                {mySeries.map((s) => {
                  const count = posts.filter((p) => p.seriesId === s.id).length;
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
            <h3 className="font-bold text-[var(--color-forum-text)] mb-3">📝 我的帖子</h3>
            {myPosts.length === 0 ? (
              <p className="text-sm text-muted">还没有发过帖子</p>
            ) : (
              <div className="space-y-2">
                {myPosts.slice(0, 5).map((p) => {
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
                        {p.postType === 'forum_sim' && (
                          <span className="text-xs px-1.5 py-0.5 rounded bg-[var(--color-forum-header)] text-white">
                            论坛体
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-muted mt-0.5">
                        {p.replies.length} 回复 · {p.likes} 赞 · {p.allowParticipation ? '🔓 开放' : '🔒 禁止'}
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
