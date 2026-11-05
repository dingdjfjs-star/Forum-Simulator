import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useUserStore } from '../stores/userStore';
import { useToastStore } from '../stores/toastStore';
import AvatarUpload from '../components/AvatarUpload';

export default function Register() {
  const navigate = useNavigate();
  const register = useUserStore((s) => s.register);
  const toast = useToastStore((s) => s);

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [avatar, setAvatar] = useState('😊');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const name = username.trim();
    if (!name || !password) return;
    if (name.length < 2) {
      setError('用户名至少2个字符');
      return;
    }
    if (password.length < 3) {
      setError('密码至少3位');
      return;
    }
    if (password !== confirmPassword) {
      setError('两次密码输入不一致');
      return;
    }

    setLoading(true);
    const result = await register(name, password, avatar);
    setLoading(false);

    if (result.success) {
      toast.success('注册成功，欢迎加入！');
      navigate('/');
    } else {
      setError(result.error || '注册失败');
    }
  };

  return (
    <div className="max-w-md mx-auto mt-10 animate-fade-in">
      <h2 className="text-2xl font-bold text-[var(--color-forum-text)] mb-6 text-center">🎉 注册账号</h2>

      <form onSubmit={handleSubmit} className="forum-floor p-6">
        {error && (
          <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded text-sm text-red-600 dark:text-red-300 animate-fade-in">
            {error}
          </div>
        )}

        <div className="mb-4">
          <label className="block text-sm font-bold text-muted mb-2 text-center">
            选择头像
          </label>
          <AvatarUpload value={avatar} onChange={setAvatar} size="lg" />
        </div>

        <div className="mb-4">
          <label className="block text-sm font-bold text-muted mb-1">用户名</label>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="给自己起个名字（至少2字）"
            className="w-full border border-[var(--color-forum-border)] bg-[var(--color-forum-card)] text-[var(--color-forum-text)] rounded p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-forum-header)] focus:border-transparent"
            required
            disabled={loading}
          />
        </div>

        <div className="mb-4">
          <label className="block text-sm font-bold text-muted mb-1">密码</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="设置密码（至少3位）"
            className="w-full border border-[var(--color-forum-border)] bg-[var(--color-forum-card)] text-[var(--color-forum-text)] rounded p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-forum-header)] focus:border-transparent"
            required
            disabled={loading}
          />
        </div>

        <div className="mb-6">
          <label className="block text-sm font-bold text-muted mb-1">确认密码</label>
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="再次输入密码"
            className="w-full border border-[var(--color-forum-border)] bg-[var(--color-forum-card)] text-[var(--color-forum-text)] rounded p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-forum-header)] focus:border-transparent"
            required
            disabled={loading}
          />
        </div>

        <button
          type="submit"
          disabled={loading || !username.trim() || !password || !confirmPassword}
          className="w-full py-2.5 bg-[var(--color-forum-accent)] text-white rounded-lg font-bold hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {loading ? (
            <>
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              注册中...
            </>
          ) : (
            '注册'
          )}
        </button>

        <div className="mt-4 text-center text-sm text-muted">
          已有账号？
          <Link to="/login" className="text-[var(--color-forum-header)] hover:underline ml-1">
            去登录 →
          </Link>
        </div>
      </form>
    </div>
  );
}
