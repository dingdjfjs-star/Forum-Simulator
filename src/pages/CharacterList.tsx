import { Link } from 'react-router-dom';
import { useCharacterStore } from '../stores/characterStore';
import { useUserStore } from '../stores/userStore';
import { useConfirmStore } from '../components/ConfirmDialog';
import { useToastStore } from '../stores/toastStore';
import CharacterAvatar from '../components/CharacterAvatar';

export default function CharacterList() {
  const currentUser = useUserStore((s) => s.getCurrentUser());
  const characters = useCharacterStore((s) => s.characters);
  const deleteCharacter = useCharacterStore((s) => s.deleteCharacter);
  const confirmStore = useConfirmStore();
  const toast = useToastStore((s) => s);

  if (!currentUser) {
    return (
      <div className="text-center py-20">
        <div className="text-5xl mb-4">🔒</div>
        <p className="text-lg text-muted">请先登录后管理角色</p>
        <Link to="/login" className="inline-block mt-4 text-[var(--color-forum-header)] hover:underline">
          去登录 →
        </Link>
      </div>
    );
  }

  const myChars = characters.filter((c) => c.userId === currentUser.id);

  const handleDelete = (charId: string, name: string) => {
    confirmStore.show({
      title: '删除角色',
      message: `确定要删除角色「${name}」吗？已发出的帖子/回复不会受影响。`,
      confirmText: '删除',
      danger: true,
      onConfirm: async () => {
        try {
          await deleteCharacter(charId);
          toast.success('角色已删除');
        } catch {
          toast.error('删除失败');
        }
      },
    });
  };

  return (
    <div className="animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-[var(--color-forum-text)]">🎭 我的角色</h2>
        <Link
          to="/create-character"
          className="px-4 py-2 bg-[var(--color-forum-accent)] text-white rounded-lg font-bold hover:opacity-90 transition-opacity text-sm"
        >
          + 创建角色
        </Link>
      </div>

      <div className="mb-4 p-3 bg-[var(--color-forum-quote)] rounded text-sm text-muted">
        💡 角色用于论坛体模式的帖子和回复中。在CP区、创作区发帖时选择「论坛体模式」即可使用角色扮演。
      </div>

      {myChars.length === 0 ? (
        <div className="text-center py-20">
          <div className="text-5xl mb-4">🎭</div>
          <p className="text-lg text-muted">还没有角色</p>
          <p className="text-sm mt-1 text-muted">
            创建角色后可以在论坛体模式下扮演不同的身份
          </p>
          <Link
            to="/create-character"
            className="inline-block mt-4 text-[var(--color-forum-accent)] hover:underline"
          >
            创建第一个角色 →
          </Link>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {myChars.map((ch) => (
            <div
              key={ch.id}
              className="forum-floor p-4 hover:shadow-md transition-shadow animate-fade-in"
            >
              <div className="flex items-start gap-3">
                <CharacterAvatar avatar={ch.avatar} name={ch.name} size="lg" />
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold text-[var(--color-forum-text)] text-lg">{ch.name}</h3>
                  {ch.description && (
                    <p className="text-sm text-muted mt-1 line-clamp-3">
                      {ch.description}
                    </p>
                  )}
                  {ch.signature && (
                    <div className="mt-2 text-xs text-muted">
                      ✍️ 小尾巴：{ch.signature}
                    </div>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 mt-3 pt-3 border-t border-dashed border-[var(--color-forum-border)]">
                <Link
                  to={`/edit-character/${ch.id}`}
                  className="text-xs text-[var(--color-forum-header)] hover:underline"
                >
                  编辑
                </Link>
                <button
                  onClick={() => handleDelete(ch.id, ch.name)}
                  className="text-xs text-red-400 hover:text-red-600 transition-colors"
                >
                  删除
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
