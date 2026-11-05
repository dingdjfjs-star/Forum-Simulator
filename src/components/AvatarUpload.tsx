import { useRef, useState } from 'react';

const EMOJI_OPTIONS = [
  '😊', '😎', '🤓', '🧐', '🤔', '😏', '🥳', '😇',
  '🦊', '🐱', '🐶', '🐼', '🐨', '🐰', '🦉', '🐙',
  '🌟', '💡', '🔥', '💎', '🎯', '🎨', '🎭', '🎪',
  '👑', '🗡️', '🛡️', '📚', '☕', '🍵', '🌸', '🌿',
  '🥽', '👓', '🕶️', '🚬', '🩺',
];

interface Props {
  value: string;       // 当前头像（emoji / URL / base64）
  onChange: (avatar: string) => void;
  size?: 'sm' | 'md' | 'lg';
}

const sizeMap: Record<string, string> = {
  sm: 'w-12 h-12 text-xl',
  md: 'w-16 h-16 text-2xl',
  lg: 'w-20 h-20 text-3xl',
};

export { EMOJI_OPTIONS };

export default function AvatarUpload({ value, onChange, size = 'md' }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [showEmoji, setShowEmoji] = useState(false);

  const isEmoji = /^(\p{Emoji_Presentation}|\p{Emoji}️|\p{Emoji_Modifier_Base}\p{Emoji_Modifier}?){1,2}$/u.test(value);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      onChange(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="flex flex-col items-center gap-3">
      {/* 头像预览 */}
      <div
        className={`${sizeMap[size]} rounded-full border-2 border-gray-300 overflow-hidden flex items-center justify-center bg-gray-50`}
      >
        {isEmoji ? (
          <span>{value}</span>
        ) : (
          <img
            src={value}
            alt="头像"
            className="w-full h-full object-cover"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = 'none';
            }}
          />
        )}
      </div>

      {/* 操作按钮 */}
      <div className="flex gap-2 flex-wrap justify-center">
        <button
          type="button"
          onClick={() => setShowEmoji(!showEmoji)}
          className={`px-2.5 py-1 text-xs rounded border transition-colors ${
            showEmoji
              ? 'bg-[var(--color-forum-header)] text-white border-[var(--color-forum-header)]'
              : 'bg-white text-gray-600 border-gray-300 hover:border-gray-400'
          }`}
        >
          😊 emoji
        </button>
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="px-2.5 py-1 text-xs rounded border border-gray-300 bg-white text-gray-600 hover:border-gray-400 transition-colors"
        >
          📁 本地上传
        </button>
        {!isEmoji && (
          <button
            type="button"
            onClick={() => onChange('😊')}
            className="px-2.5 py-1 text-xs rounded border border-red-200 bg-white text-red-400 hover:bg-red-50 transition-colors"
          >
            ✕ 清除
          </button>
        )}
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFileChange}
        />
      </div>

      {/* Emoji 选择面板 */}
      {showEmoji && (
        <div className="flex flex-wrap gap-1.5 p-3 bg-gray-50 rounded border border-gray-200 max-w-[280px] justify-center">
          {EMOJI_OPTIONS.map((emoji) => (
            <button
              key={emoji}
              type="button"
              onClick={() => {
                onChange(emoji);
                setShowEmoji(false);
              }}
              className={`w-9 h-9 text-lg rounded border-2 transition-colors flex items-center justify-center ${
                value === emoji
                  ? 'border-[var(--color-forum-header)] bg-blue-50 scale-110'
                  : 'border-gray-200 hover:border-gray-400 bg-white'
              }`}
            >
              {emoji}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
