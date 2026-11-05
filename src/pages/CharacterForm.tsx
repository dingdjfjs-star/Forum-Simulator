import { useState, useEffect } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { useCharacterStore } from '../stores/characterStore';
import { useUserStore } from '../stores/userStore';
import { useToastStore } from '../stores/toastStore';
import AvatarUpload from '../components/AvatarUpload';

export default function CharacterForm() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isEdit = !!id;

  const currentUser = useUserStore((s) => s.getCurrentUser());
  const characters = useCharacterStore((s) => s.characters);
  const addCharacter = useCharacterStore((s) => s.addCharacter);
  const updateCharacter = useCharacterStore((s) => s.updateCharacter);
  const toast = useToastStore((s) => s);
  const existingChar = id ? characters.find((c) => c.id === id) : undefined;

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [avatar, setAvatar] = useState('😊');
  const [signature, setSignature] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (existingChar) {
      setName(existingChar.name);
      setDescription(existingChar.description);
      setAvatar(existingChar.avatar);
      setSignature(existingChar.signature || '');
    }
  }, [existingChar]);

  if (!currentUser) {
    return (
      <div className="text-center py-20">
        <div className="text-5xl mb-4">🔒</div>
        <p className="text-lg text-muted">请先登录后再创建角色</p>
        <Link to="/login" className="inline-block mt-4 text-[var(--color-forum-header)] hover:underline">
          去登录 →
        </Link>
      </div>
    );
  }

  if (isEdit && existingChar && existingChar.userId !== currentUser.id) {
    return (
      <div className="text-center py-20">
        <div className="text-5xl mb-4">🚫</div>
        <p className="text-lg text-muted">无权编辑此角色</p>
        <Link to="/characters" className="inline-block mt-4 text-[var(--color-forum-header)] hover:underline">
          返回角色管理 →
        </Link>
      </div>
    );
  }

  if (isEdit && !existingChar) {
    return (
      <div className="text-center py-20">
        <div className="text-5xl mb-4">🔍</div>
        <p className="text-lg text-muted">角色不存在</p>
        <Link to="/characters" className="inline-block mt-4 text-[var(--color-forum-header)] hover:underline">
          返回角色管理 →
        </Link>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) return;

    setSaving(true);
    try {
      if (isEdit && id) {
        await updateCharacter(id, {
          name: trimmedName,
          description: description.trim(),
          avatar,
          signature: signature.trim(),
        });
        toast.success('角色已更新');
      } else {
        await addCharacter(currentUser.id, {
          name: trimmedName,
          description: description.trim(),
          avatar,
          signature: signature.trim(),
        });
        toast.success('角色创建成功');
      }
      navigate('/characters');
    } catch {
      toast.error(isEdit ? '更新失败' : '创建失败');
      setSaving(false);
    }
  };

  return (
    <div className="animate-fade-in">
      <h2 className="text-2xl font-bold text-[var(--color-forum-text)] mb-6">
        {isEdit ? '✏️ 编辑角色' : '🎭 创建角色'}
      </h2>

      <form onSubmit={handleSubmit} className="forum-floor p-6 max-w-2xl">
        <div className="mb-5">
          <label className="block text-sm font-bold text-muted mb-3 text-center">
            角色头像
          </label>
          <AvatarUpload value={avatar} onChange={setAvatar} size="lg" />
        </div>

        <div className="mb-4">
          <label className="block text-sm font-bold text-muted mb-1">
            角色名字 <span className="text-red-400">*</span>
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="例如：暴躁老哥、理性分析君"
            className="w-full border border-[var(--color-forum-border)] bg-[var(--color-forum-card)] text-[var(--color-forum-text)] rounded p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-forum-header)] focus:border-transparent"
            required
          />
        </div>

        <div className="mb-4">
          <label className="block text-sm font-bold text-muted mb-1">
            人设描述
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="描述这个角色的性格特点、说话风格等..."
            rows={3}
            className="w-full border border-[var(--color-forum-border)] bg-[var(--color-forum-card)] text-[var(--color-forum-text)] rounded p-2.5 text-sm resize-y focus:outline-none focus:ring-2 focus:ring-[var(--color-forum-header)] focus:border-transparent"
          />
        </div>

        <div className="mb-6">
          <label className="block text-sm font-bold text-muted mb-1">
            小尾巴（签名）
          </label>
          <input
            type="text"
            value={signature}
            onChange={(e) => setSignature(e.target.value)}
            placeholder="例如：来自火星的iphone 18 pro max"
            className="w-full border border-[var(--color-forum-border)] bg-[var(--color-forum-card)] text-[var(--color-forum-text)] rounded p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-forum-header)] focus:border-transparent"
          />
          <p className="text-xs text-muted mt-1">
            使用该角色发帖/回复时，内容底部会自动显示此签名
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={!name.trim() || saving}
            className="px-6 py-2.5 bg-[var(--color-forum-header)] text-white rounded-lg font-bold hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {saving ? (
              <>
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                保存中...
              </>
            ) : (
              isEdit ? '保存修改' : '创建角色'
            )}
          </button>
          <Link
            to="/characters"
            className="px-4 py-2.5 text-muted hover:text-[var(--color-forum-text)] transition-colors text-sm"
          >
            取消
          </Link>
        </div>
      </form>
    </div>
  );
}
