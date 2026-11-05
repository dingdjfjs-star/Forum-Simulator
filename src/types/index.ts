export interface User {
  id: string;
  username: string;
  avatar: string;
  createdAt: number;
  role?: 'admin' | 'user'; // 角色：admin=坛主, user=普通用户
  bio?: string; // 个人简介
}

// 连载（长文分章）
export interface Series {
  id: string;
  authorId: string;
  title: string;
  description: string;
  board: string;
  tags: string[];
  createdAt: number;
  updatedAt: number;
}

export interface Character {
  id: string;
  userId: string; // 所属用户
  name: string;
  description: string;
  avatar: string; // emoji / URL / base64
  signature: string;
  createdAt: number;
}

export interface Reply {
  id: string;
  postId: string;
  userId: string | null; // 回复者用户ID（匿名则为null）
  characterId: string | null; // null = 匿名
  characterName: string;
  characterAvatar: string;
  content: string;
  quoteId: string | null;
  floor: number;
  createdAt: number;
}

// 帖子类型：普通帖 / 论坛体帖
export type PostType = 'normal' | 'forum_sim';

// 板块定义
export interface Board {
  id: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  allowForumSim: boolean; // 是否允许论坛体模式
}

// 预定义板块
export const BOARDS: Board[] = [
  {
    id: 'daily',
    name: '日常区',
    description: '闲聊、日常、碎碎念，什么都可以聊',
    icon: '☕',
    color: '#4a6d8c',
    allowForumSim: false,
  },
  {
    id: 'cp',
    name: 'CP区',
    description: '发同人文、用论坛体创作，畅享你的CP',
    icon: '💕',
    color: '#e8556f',
    allowForumSim: true,
  },
  {
    id: 'creation',
    name: '创作区',
    description: '原创小说、脑洞、设定分享',
    icon: '✍️',
    color: '#5b8c5a',
    allowForumSim: true,
  },
  {
    id: 'feedback',
    name: '反馈区',
    description: '站点建议、Bug反馈、功能需求',
    icon: '🔧',
    color: '#8c6d4a',
    allowForumSim: false,
  },
];

export interface Post {
  id: string;
  title: string;
  authorId: string; // 发帖用户ID
  characterId: string | null;
  characterName: string;
  characterAvatar: string;
  content: string;
  tags: string[];
  isPublic: boolean; // 公开/隐藏
  allowParticipation: boolean;
  editedAt: number | null;
  replies: Reply[];
  createdAt: number;
  board: string; // 所属板块ID
  postType: PostType; // 帖子类型
  likes: number; // 点赞数
  likedBy: string[]; // 点赞用户ID列表
  imageUrls: string[]; // 配图（存 Supabase Storage 相对路径）
  seriesId: string | null; // 所属连载ID
  chapterNo: number | null; // 章节序号
}
