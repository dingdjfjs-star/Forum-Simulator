interface Props {
  avatar: string;
  name: string;
  size?: 'sm' | 'md' | 'lg';
}

const sizeMap = {
  sm: 'w-8 h-8 text-lg',
  md: 'w-10 h-10 text-xl',
  lg: 'w-14 h-14 text-2xl',
};

export default function CharacterAvatar({ avatar, name, size = 'md' }: Props) {
  // 如果avatar看起来像emoji（单个或两个字符），直接显示
  const isEmoji = /^(\p{Emoji_Presentation}|\p{Emoji}️|\p{Emoji_Modifier_Base}\p{Emoji_Modifier}?){1,2}$/u.test(avatar);

  if (isEmoji) {
    return (
      <div
        className={`${sizeMap[size]} rounded-full bg-gray-100 flex items-center justify-center border-2 border-[var(--color-forum-border)] shrink-0`}
        title={name}
      >
        {avatar}
      </div>
    );
  }

  // URL头像
  return (
    <img
      src={avatar}
      alt={name}
      className={`${sizeMap[size]} rounded-full object-cover border-2 border-[var(--color-forum-border)] shrink-0`}
      title={name}
    />
  );
}
