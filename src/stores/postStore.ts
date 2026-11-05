import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import type { Post, Reply, PostType, Series } from '../types';

function generateId(): string {
  return crypto.randomUUID
    ? crypto.randomUUID()
    : Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

type PostInput = Omit<Post, 'id' | 'replies' | 'createdAt' | 'editedAt' | 'likes' | 'likedBy'> & {
  createdAt?: number;
};

type ReplyInput = Omit<Reply, 'id' | 'postId' | 'floor' | 'createdAt'> & {
  createdAt?: number;
};

type SortOption = 'newest' | 'oldest' | 'most_replies' | 'most_likes';

interface PostState {
  posts: Post[];
  series: Series[];
  loading: boolean;
  error: string | null;
  searchQuery: string;
  sortBy: SortOption;
  selectedBoard: string | null; // null = 全部
  loadPosts: () => Promise<void>;
  addPost: (p: PostInput) => Promise<Post>;
  updatePost: (
    id: string,
    data: Partial<
      Pick<
        Post,
        | 'title'
        | 'content'
        | 'tags'
        | 'allowParticipation'
        | 'isPublic'
        | 'createdAt'
        | 'board'
        | 'postType'
        | 'imageUrls'
        | 'seriesId'
        | 'chapterNo'
      >
    >
  ) => Promise<void>;
  deletePost: (id: string) => Promise<void>;
  addReply: (postId: string, r: ReplyInput) => Promise<Reply | null>;
  deleteReply: (postId: string, replyId: string) => Promise<void>;
  toggleLike: (postId: string, userId: string) => Promise<void>;
  getPost: (id: string) => Post | undefined;
  getUserPosts: (userId: string) => Post[];
  getFilteredPosts: () => Post[];
  setSearchQuery: (q: string) => void;
  setSortBy: (s: SortOption) => void;
  setSelectedBoard: (b: string | null) => void;
  clearError: () => void;
  // ---- 连载 ----
  addSeries: (input: {
    authorId: string;
    title: string;
    description?: string;
    board?: string;
    tags?: string[];
  }) => Promise<Series>;
  getSeries: (id: string | null | undefined) => Series | undefined;
  getSeriesPosts: (seriesId: string) => Post[];
}

function getNextReplyTime(post: Post): number {
  let maxTime = post.createdAt;
  for (const r of post.replies) {
    if (r.createdAt > maxTime) maxTime = r.createdAt;
  }
  return maxTime + 60000 + Math.floor(Math.random() * 840000);
}

function toReply(r: any): Reply {
  return {
    id: r.id,
    postId: r.post_id,
    userId: r.user_id || null,
    characterId: r.character_id || null,
    characterName: r.character_name,
    characterAvatar: r.character_avatar || '👤',
    content: r.content,
    quoteId: r.quote_id || null,
    floor: r.floor,
    createdAt: new Date(r.created_at).getTime(),
  };
}

function toPost(p: any): Post {
  return {
    id: p.id,
    title: p.title,
    authorId: p.author_id,
    characterId: p.character_id || null,
    characterName: p.character_name,
    characterAvatar: p.character_avatar || '👤',
    content: p.content,
    tags: p.tags || [],
    isPublic: p.is_public ?? true,
    allowParticipation: p.allow_participation ?? true,
    editedAt: p.edited_at ? new Date(p.edited_at).getTime() : null,
    replies: [],
    createdAt: new Date(p.created_at).getTime(),
    board: p.board || 'daily',
    postType: (p.post_type as PostType) || 'normal',
    likes: p.likes || 0,
    likedBy: p.liked_by || [],
    imageUrls: p.image_urls || [],
    seriesId: p.series_id || null,
    chapterNo: p.chapter_no ?? null,
  };
}

function toSeries(s: any): Series {
  return {
    id: s.id,
    authorId: s.author_id,
    title: s.title,
    description: s.description || '',
    board: s.board || 'cp',
    tags: s.tags || [],
    createdAt: new Date(s.created_at).getTime(),
    updatedAt: new Date(s.updated_at || s.created_at).getTime(),
  };
}

async function withRetry(
  fn: () => any,
  retries = 2
): Promise<{ data: any; error: any }> {
  let lastError: any = null;
  for (let i = 0; i <= retries; i++) {
    try {
      const result = await fn();
      if (!result.error) return result;
      lastError = result.error;
      if (result.error.code === 'NETWORK_ERROR' || result.error.message?.includes('network')) {
        await new Promise((r) => setTimeout(r, 500 * (i + 1)));
        continue;
      }
      return result;
    } catch (e) {
      lastError = e;
      await new Promise((r) => setTimeout(r, 500 * (i + 1)));
    }
  }
  return { data: null, error: lastError };
}

export const usePostStore = create<PostState>()(
  (set, get) => ({
    posts: [],
    series: [],
    loading: false,
    error: null,
    searchQuery: '',
    sortBy: 'newest',
    selectedBoard: null,

    clearError: () => set({ error: null }),
    setSearchQuery: (q) => set({ searchQuery: q }),
    setSortBy: (s) => set({ sortBy: s }),
    setSelectedBoard: (b) => set({ selectedBoard: b }),

    loadPosts: async () => {
      set({ loading: true, error: null });

      const { data: postsData, error: postsError } = await withRetry(() =>
        supabase
          .from('posts')
          .select('*')
          .order('created_at', { ascending: false })
      );

      if (postsError) {
        console.error('加载帖子失败:', postsError);
        set({ loading: false, error: '加载帖子失败，请检查网络' });
        return;
      }

      if (!postsData) {
        set({ loading: false });
        return;
      }

      // 加载所有回复
      const postIds = postsData.map((p: any) => p.id);
      let repliesByPost: Record<string, Reply[]> = {};

      if (postIds.length > 0) {
        const { data: repliesData, error: repliesError } = await withRetry(() =>
          supabase
            .from('replies')
            .select('*')
            .in('post_id', postIds)
            .order('floor', { ascending: true })
        );

        if (!repliesError && repliesData) {
          for (const r of repliesData) {
            const reply = toReply(r);
            if (!repliesByPost[reply.postId]) repliesByPost[reply.postId] = [];
            repliesByPost[reply.postId].push(reply);
          }
        }
      }

      const posts = postsData.map((p: any) => ({
        ...toPost(p),
        replies: repliesByPost[p.id] || [],
      }));

      // 连载列表（独立查询，失败不影响帖子展示）
      let seriesList: Series[] = [];
      const { data: seriesData } = await withRetry(() =>
        supabase.from('series').select('*').order('updated_at', { ascending: false })
      );
      if (seriesData) seriesList = seriesData.map(toSeries);

      set({ posts, series: seriesList, loading: false, error: null });
    },

    addPost: async (p) => {
      const id = generateId();
      const row = {
        id,
        author_id: p.authorId,
        character_id: p.characterId || null,
        character_name: p.characterName,
        character_avatar: p.characterAvatar,
        title: p.title,
        content: p.content,
        tags: p.tags || [],
        is_public: p.isPublic ?? true,
        allow_participation: p.allowParticipation ?? true,
        board: p.board || 'daily',
        post_type: p.postType || 'normal',
        likes: 0,
        liked_by: [],
        image_urls: p.imageUrls || [],
        series_id: p.seriesId || null,
        chapter_no: p.chapterNo ?? null,
        created_at: p.createdAt
          ? new Date(p.createdAt).toISOString()
          : new Date().toISOString(),
      };

      let res = await withRetry(() =>
        supabase
          .from('posts')
          .insert(row)
          .select()
          .single()
      );

      // 兜底：若数据库还没执行扩展迁移（新列不存在），去掉新字段重试，
      // 保证基础发帖功能不受影响
      if (
        res.error &&
        /column .* does not exist|could not find the .* column|schema cache/i.test(
          res.error.message || ''
        )
      ) {
        const legacy: any = { ...row };
        delete legacy.image_urls;
        delete legacy.series_id;
        delete legacy.chapter_no;
        res = await withRetry(() =>
          supabase.from('posts').insert(legacy).select().single()
        );
      }

      const { data, error } = res;
      if (error || !data) throw new Error('发帖失败: ' + (error?.message || '未知错误'));

      const post = { ...toPost(data), replies: [] };
      set((s) => ({ posts: [post, ...s.posts] }));

      // 更新连载的最近更新时间
      if (p.seriesId) {
        supabase
          .from('series')
          .update({ updated_at: new Date().toISOString() })
          .eq('id', p.seriesId)
          .then(
            () => {},
            () => {}
          );
        set((s) => ({
          series: s.series.map((x) =>
            x.id === p.seriesId ? { ...x, updatedAt: Date.now() } : x
          ),
        }));
      }

      return post;
    },

    updatePost: async (id, updates) => {
      const dbUpdates: any = {};
      if (updates.title !== undefined) dbUpdates.title = updates.title;
      if (updates.content !== undefined) dbUpdates.content = updates.content;
      if (updates.tags !== undefined) dbUpdates.tags = updates.tags;
      if (updates.isPublic !== undefined) dbUpdates.is_public = updates.isPublic;
      if (updates.allowParticipation !== undefined)
        dbUpdates.allow_participation = updates.allowParticipation;
      if (updates.board !== undefined) dbUpdates.board = updates.board;
      if (updates.postType !== undefined) dbUpdates.post_type = updates.postType;
      if (updates.imageUrls !== undefined) dbUpdates.image_urls = updates.imageUrls;
      if (updates.seriesId !== undefined) dbUpdates.series_id = updates.seriesId;
      if (updates.chapterNo !== undefined) dbUpdates.chapter_no = updates.chapterNo;
      if (updates.createdAt !== undefined)
        dbUpdates.created_at = new Date(updates.createdAt).toISOString();
      dbUpdates.edited_at = new Date().toISOString();

      const { error } = await withRetry(() =>
        supabase
          .from('posts')
          .update(dbUpdates)
          .eq('id', id)
      );

      if (error) throw new Error('更新失败');

      set((s) => ({
        posts: s.posts.map((p) =>
          p.id === id
            ? { ...p, ...updates, editedAt: Date.now() }
            : p
        ),
      }));
    },

    deletePost: async (id) => {
      const { error } = await withRetry(() =>
        supabase.from('posts').delete().eq('id', id)
      );

      if (error) throw new Error('删除失败');

      set((s) => ({ posts: s.posts.filter((p) => p.id !== id) }));
    },

    addReply: async (postId, r) => {
      const post = get().posts.find((p) => p.id === postId);
      if (!post) return null;
      if (!post.allowParticipation) return null;

      const floor = post.replies.length + 1;
      const row = {
        id: generateId(),
        post_id: postId,
        user_id: r.userId || null,
        character_id: r.characterId || null,
        character_name: r.characterName,
        character_avatar: r.characterAvatar,
        content: r.content,
        quote_id: r.quoteId || null,
        floor,
        created_at: r.createdAt
          ? new Date(r.createdAt).toISOString()
          : new Date(getNextReplyTime(post)).toISOString(),
      };

      const { data, error } = await withRetry(() =>
        supabase
          .from('replies')
          .insert(row)
          .select()
          .single()
      );

      if (error || !data) return null;

      const reply = toReply(data);
      set((s) => ({
        posts: s.posts.map((p) =>
          p.id === postId
            ? { ...p, replies: [...p.replies, reply] }
            : p
        ),
      }));
      return reply;
    },

    deleteReply: async (postId, replyId) => {
      const { error } = await withRetry(() =>
        supabase
          .from('replies')
          .delete()
          .eq('id', replyId)
      );

      if (error) return;

      set((s) => ({
        posts: s.posts.map((p) =>
          p.id === postId
            ? {
                ...p,
                replies: p.replies
                  .filter((r) => r.id !== replyId)
                  .map((r, i) => ({ ...r, floor: i + 1 })),
              }
            : p
        ),
      }));
    },

    toggleLike: async (postId, userId) => {
      const post = get().posts.find((p) => p.id === postId);
      if (!post) return;

      const hasLiked = post.likedBy.includes(userId);
      const newLikedBy = hasLiked
        ? post.likedBy.filter((id) => id !== userId)
        : [...post.likedBy, userId];
      const newLikes = hasLiked ? post.likes - 1 : post.likes + 1;

      // 乐观更新
      set((s) => ({
        posts: s.posts.map((p) =>
          p.id === postId
            ? { ...p, likes: newLikes, likedBy: newLikedBy }
            : p
        ),
      }));

      // 服务端按会话令牌识别用户并切换点赞状态（防止伪造他人点赞）
      const { data, error } = await withRetry(() =>
        supabase.rpc('toggle_like', { p_post_id: postId })
      );

      if (error || !data) {
        // 服务端失败 → 回滚乐观更新
        set((s) => ({
          posts: s.posts.map((p) =>
            p.id === postId
              ? { ...p, likes: post.likes, likedBy: post.likedBy }
              : p
          ),
        }));
        return;
      }

      // 以服务端结果为准
      set((s) => ({
        posts: s.posts.map((p) =>
          p.id === postId
            ? { ...p, likes: data.likes, likedBy: data.likedBy }
            : p
        ),
      }));
    },

    getPost: (id) => get().posts.find((p) => p.id === id),

    getUserPosts: (userId) =>
      get().posts.filter((p) => p.authorId === userId),

    // ---- 连载 ----
    addSeries: async (input) => {
      const row = {
        id: generateId(),
        author_id: input.authorId,
        title: input.title,
        description: input.description || '',
        board: input.board || 'cp',
        tags: input.tags || [],
      };
      const { data, error } = await withRetry(() =>
        supabase.from('series').insert(row).select().single()
      );
      if (error || !data) throw new Error('创建连载失败: ' + (error?.message || ''));
      const created = toSeries(data);
      set((st) => ({ series: [created, ...st.series] }));
      return created;
    },

    getSeries: (id) => (id ? get().series.find((s) => s.id === id) : undefined),

    getSeriesPosts: (seriesId) =>
      get()
        .posts.filter((p) => p.seriesId === seriesId)
        .sort((a, b) => (a.chapterNo ?? 0) - (b.chapterNo ?? 0)),

    getFilteredPosts: () => {
      const { posts, searchQuery, sortBy, selectedBoard } = get();
      let filtered = posts;

      // 板块筛选
      if (selectedBoard) {
        filtered = filtered.filter((p) => p.board === selectedBoard);
      }

      // 搜索
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        filtered = filtered.filter(
          (p) =>
            p.title.toLowerCase().includes(q) ||
            p.content.toLowerCase().includes(q) ||
            p.tags.some((t) => t.toLowerCase().includes(q)) ||
            p.characterName.toLowerCase().includes(q)
        );
      }

      // 排序
      switch (sortBy) {
        case 'oldest':
          filtered = [...filtered].sort((a, b) => a.createdAt - b.createdAt);
          break;
        case 'most_replies':
          filtered = [...filtered].sort((a, b) => b.replies.length - a.replies.length);
          break;
        case 'most_likes':
          filtered = [...filtered].sort((a, b) => b.likes - a.likes);
          break;
        default:
          filtered = [...filtered].sort((a, b) => b.createdAt - a.createdAt);
      }

      return filtered;
    },
  })
);
