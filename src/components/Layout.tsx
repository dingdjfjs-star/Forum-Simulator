import { useState, useEffect } from 'react';
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useUserStore } from '../stores/userStore';
import { useSiteStore } from '../stores/siteStore';
import { usePostStore } from '../stores/postStore';
import { useCharacterStore } from '../stores/characterStore';
import { useThemeStore } from '../stores/themeStore';
import { useToastStore } from '../stores/toastStore';
import { BOARDS } from '../types';
import ToastContainer from './Toast';
import { ConfirmDialog } from './ConfirmDialog';

export default function Layout() {
  const navigate = useNavigate();
  const location = useLocation();
  const currentUser = useUserStore((s) => s.getCurrentUser());
  const logout = useUserStore((s) => s.logout);
  const siteName = useSiteStore((s) => s.siteName);
  const setSiteName = useSiteStore((s) => s.setSiteName);
  const loadUsers = useUserStore((s) => s.loadUsers);
  const loadPosts = usePostStore((s) => s.loadPosts);
  const loadCharacters = useCharacterStore((s) => s.loadCharacters);
  const isDark = useThemeStore((s) => s.isDark);
  const toggleTheme = useThemeStore((s) => s.toggle);
  const toast = useToastStore((s) => s);

  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [editName, setEditName] = useState(siteName);
  const [dataLoaded, setDataLoaded] = useState(false);

  // 首次加载：从 Supabase 拉取数据
  useEffect(() => {
    Promise.all([loadUsers(), loadPosts(), loadCharacters()]).finally(() => {
      setDataLoaded(true);
    });
  }, []);

  // 同步页面标题
  useEffect(() => {
    document.title = siteName;
  }, [siteName]);

  // 关闭移动端菜单
  useEffect(() => {
    setShowMobileMenu(false);
    setShowUserMenu(false);
  }, [location.pathname]);

  const isEmoji = currentUser?.avatar
    ? /^(\p{Emoji_Presentation}|\p{Emoji}️|\p{Emoji_Modifier_Base}\p{Emoji_Modifier}?){1,2}$/u.test(currentUser.avatar)
    : false;

  const handleLogout = () => {
    logout();
    setShowUserMenu(false);
    toast.info('已退出登录');
    navigate('/');
  };

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="bg-[var(--color-forum-header)] text-white shadow-lg sticky top-0 z-50 backdrop-blur-md">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between gap-2">
          {/* Logo */}
          <div
            className="flex items-center gap-2 cursor-pointer shrink-0"
            onClick={() => navigate('/')}
          >
            <span className="text-2xl">💬</span>
            <h1 className="text-lg sm:text-xl font-bold tracking-wide hidden sm:block">
              {siteName}
            </h1>
          </div>

          {/* Desktop Nav */}
          <nav className="hidden md:flex items-center gap-1 text-sm">
            <NavLink
              to="/"
              end
              className={({ isActive }) =>
                `px-2.5 py-1.5 rounded transition-colors ${
                  isActive
                    ? 'bg-white/20 text-white'
                    : 'text-white/80 hover:text-white hover:bg-white/10'
                }`
              }
            >
              首页
            </NavLink>
            {BOARDS.map((board) => (
              <NavLink
                key={board.id}
                to={`/board/${board.id}`}
                className={({ isActive }) =>
                  `px-2.5 py-1.5 rounded transition-colors ${
                    isActive
                      ? 'bg-white/20 text-white'
                      : 'text-white/80 hover:text-white hover:bg-white/10'
                  }`
                }
              >
                {board.icon} {board.name}
              </NavLink>
            ))}
            <NavLink
              to="/series"
              className={({ isActive }) =>
                `px-2.5 py-1.5 rounded transition-colors ${
                  isActive
                    ? 'bg-white/20 text-white'
                    : 'text-white/80 hover:text-white hover:bg-white/10'
                }`
              }
            >
              📚 连载
            </NavLink>
            <NavLink
              to="/characters"
              className={({ isActive }) =>
                `px-2.5 py-1.5 rounded transition-colors ${
                  isActive
                    ? 'bg-white/20 text-white'
                    : 'text-white/80 hover:text-white hover:bg-white/10'
                }`
              }
            >
              🎭 角色
            </NavLink>
            {currentUser?.role === 'admin' && (
              <NavLink
                to="/admin"
                className={({ isActive }) =>
                  `px-2.5 py-1.5 rounded transition-colors ${
                    isActive
                      ? 'bg-amber-400/30 text-white'
                      : 'text-amber-200 hover:text-white hover:bg-white/10'
                  }`
                }
              >
                🛡️ 后台
              </NavLink>
            )}
          </nav>

          {/* Right section */}
          <div className="flex items-center gap-1">
            {/* Dark mode toggle */}
            <button
              onClick={toggleTheme}
              className="px-2 py-1.5 rounded text-white/70 hover:text-white hover:bg-white/10 transition-colors"
              title={isDark ? '切换浅色模式' : '切换深色模式'}
            >
              {isDark ? '☀️' : '🌙'}
            </button>

            {/* Settings */}
            <button
              onClick={() => {
                setEditName(siteName);
                setShowSettings(true);
              }}
              className="px-2 py-1.5 rounded text-white/70 hover:text-white hover:bg-white/10 transition-colors hidden sm:block"
              title="站点设置"
            >
              ⚙️
            </button>

            <span className="w-px h-5 bg-white/30 mx-0.5 hidden sm:block" />

            {/* User area */}
            {currentUser ? (
              <div className="relative">
                <button
                  onClick={() => setShowUserMenu(!showUserMenu)}
                  className="flex items-center gap-1.5 px-2 py-1 rounded hover:bg-white/10 transition-colors"
                >
                  {isEmoji ? (
                    <span className="text-base">{currentUser.avatar}</span>
                  ) : (
                    <img
                      src={currentUser.avatar}
                      alt=""
                      className="w-5 h-5 rounded-full object-cover"
                    />
                  )}
                  <span className="max-w-[60px] truncate text-xs hidden sm:inline">
                    {currentUser.username}
                  </span>
                </button>

                {showUserMenu && (
                  <>
                    <div
                      className="fixed inset-0 z-10"
                      onClick={() => setShowUserMenu(false)}
                    />
                    <div className="absolute right-0 top-full mt-1 bg-[var(--color-forum-card)] rounded-lg shadow-xl border border-[var(--color-forum-border)] py-1 z-20 min-w-[120px] animate-scale-in">
                      <button
                        onClick={() => {
                          navigate('/profile');
                          setShowUserMenu(false);
                        }}
                        className="w-full text-left px-4 py-2 text-sm text-[var(--color-forum-text)] hover:bg-[var(--color-forum-hover)] transition-colors"
                      >
                        👤 个人中心
                      </button>
                      <button
                        onClick={() => {
                          navigate('/characters');
                          setShowUserMenu(false);
                        }}
                        className="w-full text-left px-4 py-2 text-sm text-[var(--color-forum-text)] hover:bg-[var(--color-forum-hover)] transition-colors"
                      >
                        🎭 角色管理
                      </button>
                      {currentUser?.role === 'admin' && (
                        <button
                          onClick={() => {
                            navigate('/admin');
                            setShowUserMenu(false);
                          }}
                          className="w-full text-left px-4 py-2 text-sm text-amber-600 dark:text-amber-400 hover:bg-[var(--color-forum-hover)] transition-colors"
                        >
                          🛡️ 管理后台
                        </button>
                      )}
                      <hr className="my-1 border-[var(--color-forum-border)]" />
                      <button
                        onClick={handleLogout}
                        className="w-full text-left px-4 py-2 text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                      >
                        🚪 退出登录
                      </button>
                    </div>
                  </>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-1">
                <NavLink
                  to="/login"
                  className="px-2.5 py-1.5 rounded text-white/80 hover:text-white hover:bg-white/10 transition-colors text-xs"
                >
                  登录
                </NavLink>
                <NavLink
                  to="/register"
                  className="px-2.5 py-1.5 rounded bg-white/20 text-white hover:bg-white/30 transition-colors text-xs"
                >
                  注册
                </NavLink>
              </div>
            )}

            {/* Mobile menu button */}
            <button
              onClick={() => setShowMobileMenu(!showMobileMenu)}
              className="md:hidden px-2 py-1.5 rounded text-white/80 hover:text-white hover:bg-white/10 transition-colors"
            >
              {showMobileMenu ? '✕' : '☰'}
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        {showMobileMenu && (
          <div className="md:hidden border-t border-white/10 bg-[var(--color-forum-header)] animate-fade-in">
            <nav className="max-w-5xl mx-auto px-4 py-2 flex flex-col gap-1">
              <NavLink
                to="/"
                end
                className={({ isActive }) =>
                  `px-3 py-2 rounded transition-colors ${
                    isActive ? 'bg-white/20 text-white' : 'text-white/80 hover:bg-white/10'
                  }`
                }
              >
                🏠 首页
              </NavLink>
              {BOARDS.map((board) => (
                <NavLink
                  key={board.id}
                  to={`/board/${board.id}`}
                  className={({ isActive }) =>
                    `px-3 py-2 rounded transition-colors ${
                      isActive ? 'bg-white/20 text-white' : 'text-white/80 hover:bg-white/10'
                    }`
                  }
                >
                  {board.icon} {board.name}
                </NavLink>
              ))}
              <NavLink
                to="/series"
                className={({ isActive }) =>
                  `px-3 py-2 rounded transition-colors ${
                    isActive ? 'bg-white/20 text-white' : 'text-white/80 hover:bg-white/10'
                  }`
                }
              >
                📚 连载书架
              </NavLink>
              <NavLink
                to="/characters"
                className={({ isActive }) =>
                  `px-3 py-2 rounded transition-colors ${
                    isActive ? 'bg-white/20 text-white' : 'text-white/80 hover:bg-white/10'
                  }`
                }
              >
                🎭 角色管理
              </NavLink>
              {currentUser?.role === 'admin' && (
                <NavLink
                  to="/admin"
                  className={({ isActive }) =>
                    `px-3 py-2 rounded transition-colors ${
                      isActive ? 'bg-amber-400/30 text-white' : 'text-amber-200 hover:bg-white/10'
                    }`
                  }
                >
                  🛡️ 管理后台
                </NavLink>
              )}
              <button
                onClick={() => {
                  setEditName(siteName);
                  setShowSettings(true);
                  setShowMobileMenu(false);
                }}
                className="px-3 py-2 rounded text-left text-white/80 hover:bg-white/10 transition-colors"
              >
                ⚙️ 站点设置
              </button>
            </nav>
          </div>
        )}
      </header>

      {/* Main content */}
      <main className="flex-1 max-w-5xl mx-auto w-full px-4 py-6">
        {!dataLoaded && (
          <div className="flex items-center justify-center py-20">
            <div className="flex flex-col items-center gap-3">
              <div className="w-10 h-10 border-3 border-[var(--color-forum-border)] border-t-[var(--color-forum-header)] rounded-full animate-spin" />
              <p className="text-sm text-muted">正在加载数据...</p>
            </div>
          </div>
        )}
        {dataLoaded && <Outlet />}
      </main>

      {/* Footer */}
      <footer className="text-center text-muted text-xs py-4 border-t border-[var(--color-forum-border)]">
        {siteName} · 仅供娱乐 · 数据存储于云端
      </footer>

      {/* Toast notifications */}
      <ToastContainer />

      {/* Confirm dialog */}
      <ConfirmDialog />

      {/* Settings dialog */}
      {showSettings && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/40 animate-fade-in"
            onClick={() => setShowSettings(false)}
          />
          <div className="relative bg-[var(--color-forum-card)] rounded-xl shadow-2xl p-6 w-full max-w-md mx-4 z-10 animate-scale-in">
            <h3 className="text-lg font-bold text-[var(--color-forum-text)] mb-4">⚙️ 站点设置</h3>
            <label className="block text-sm font-bold text-muted mb-1">
              论坛名称
            </label>
            <input
              type="text"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              className="w-full border border-[var(--color-forum-border)] bg-[var(--color-forum-card)] text-[var(--color-forum-text)] rounded p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-forum-header)] focus:border-transparent"
              placeholder="输入论坛名称"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  const name = editName.trim();
                  if (name) {
                    setSiteName(name);
                    setShowSettings(false);
                    toast.success('论坛名称已更新');
                  }
                }
              }}
            />
            <div className="flex gap-2 mt-4 justify-end">
              <button
                onClick={() => setShowSettings(false)}
                className="px-4 py-2 text-sm text-muted hover:text-[var(--color-forum-text)] transition-colors"
              >
                取消
              </button>
              <button
                onClick={() => {
                  const name = editName.trim();
                  if (name) {
                    setSiteName(name);
                    setShowSettings(false);
                    toast.success('论坛名称已更新');
                  }
                }}
                disabled={!editName.trim()}
                className="px-5 py-2 bg-[var(--color-forum-header)] text-white rounded-lg text-sm font-bold hover:opacity-90 disabled:opacity-40"
              >
                保存
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
