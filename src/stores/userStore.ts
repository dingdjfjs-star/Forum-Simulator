import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { supabase, setForumToken, getForumToken } from '../lib/supabase';
import type { User } from '../types';

/** 带重试的 Supabase 查询 */
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

/** 从 RPC 返回的 json 中解析用户（不含密码，含会话令牌） */
function toUser(d: any): User {
  return {
    id: d.id,
    username: d.username,
    avatar: d.avatar || '😊',
    createdAt: d.created_at ? new Date(d.created_at).getTime() : Date.now(),
    role: d.role || 'user',
    bio: d.bio || '',
  };
}

interface UserState {
  users: User[];
  currentUserId: string | null;
  currentUserData: User | null; // 缓存完整用户数据，解决刷新掉线
  loading: boolean;
  error: string | null;
  loadUsers: () => Promise<void>;
  register: (username: string, password: string, avatar?: string) => Promise<{ success: boolean; error?: string }>;
  login: (username: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  updateProfile: (userId: string, data: Partial<Pick<User, 'username' | 'avatar' | 'bio'>>) => Promise<{ success: boolean; error?: string }>;
  setUserRole: (userId: string, role: 'admin' | 'user') => Promise<{ success: boolean; error?: string }>;
  getCurrentUser: () => User | undefined;
  getUser: (id: string) => User | undefined;
  clearError: () => void;
}

export const useUserStore = create<UserState>()(
  persist(
    (set, get) => ({
      users: [],
      currentUserId: null,
      currentUserData: null,
      loading: false,
      error: null,

      clearError: () => set({ error: null }),

      loadUsers: async () => {
        set({ loading: true, error: null });
        let res = await withRetry(() =>
          supabase
            .from('profiles')
            .select('id, username, avatar, role, created_at, bio')
            .order('created_at', { ascending: false })
        );

        // 兜底：若 bio 列还不存在（扩展迁移未执行），退回旧列，避免整站用户名加载失败
        if (res.error && /bio|schema cache|does not exist/i.test(res.error.message || '')) {
          res = await withRetry(() =>
            supabase
              .from('profiles')
              .select('id, username, avatar, role, created_at')
              .order('created_at', { ascending: false })
          );
        }

        const { data, error } = res;

        if (error) {
          console.error('加载用户失败:', error);
          set({ loading: false, error: '加载用户数据失败，请检查网络' });
          return;
        }

        if (data) {
          const users: User[] = data.map((u: any) => ({
            id: u.id,
            username: u.username,
            avatar: u.avatar,
            createdAt: new Date(u.created_at).getTime(),
            role: u.role || 'user',
            bio: u.bio || '',
          }));

          // 同步当前用户缓存
          const currentId = get().currentUserId;
          const currentData = currentId
            ? users.find((u) => u.id === currentId) ?? null
            : null;

          set({ users, currentUserData: currentData, loading: false });
        } else {
          set({ loading: false });
        }
      },

      register: async (username, password, avatar) => {
        set({ error: null });

        // 服务端注册：查重 + bcrypt 加密 + 签发会话令牌
        const { data, error } = await withRetry(() =>
          supabase.rpc('register_user', {
            p_username: username,
            p_password: password,
            p_avatar: avatar || '😊',
          })
        );

        if (error || !data) {
          const raw = error?.message || '';
          // 服务端返回的是中文业务错误（如"用户名已被占用"），直接展示
          const msg =
            raw && !raw.includes('network') && raw.length < 50
              ? raw
              : '注册失败，请稍后重试';
          set({ error: msg });
          return { success: false, error: msg };
        }

        setForumToken(data.token);
        localStorage.setItem('forum-session-token', data.token);
        const user = toUser(data);

        set((s) => ({
          users: [user, ...s.users],
          currentUserId: user.id,
          currentUserData: user,
          error: null,
        }));
        return { success: true };
      },

      login: async (username, password) => {
        set({ error: null, loading: true });

        // 服务端登录：bcrypt 校验 + 签发会话令牌
        const { data, error } = await withRetry(() =>
          supabase.rpc('login_user', {
            p_username: username,
            p_password: password,
          })
        );

        if (error) {
          console.error('登录失败:', error);
          const raw = error.message || '';
          const msg = raw.includes('network')
            ? '网络连接失败，请检查网络后重试'
            : raw && !raw.includes('Failed') && raw.length < 50
              ? raw
              : '用户名或密码错误';
          set({ loading: false, error: msg });
          return { success: false, error: msg };
        }

        if (!data) {
          const msg = '登录失败，请稍后重试';
          set({ loading: false, error: msg });
          return { success: false, error: msg };
        }

        setForumToken(data.token);
        localStorage.setItem('forum-session-token', data.token);
        const user = toUser(data);

        set((s) => {
          const exists = s.users.find((u) => u.id === user.id);
          return {
            users: exists ? s.users : [user, ...s.users],
            currentUserId: user.id,
            currentUserData: user,
            loading: false,
            error: null,
          };
        });
        return { success: true };
      },

      logout: () => {
        // 通知服务端销毁会话（失败也不影响本地退出）
        const token = getForumToken();
        if (token) {
          supabase.rpc('logout_user', { p_token: token }).then(() => {}, () => {});
        }
        setForumToken(null);
        localStorage.removeItem('forum-session-token');
        set({ currentUserId: null, currentUserData: null });
      },

      updateProfile: async (userId, data) => {
        const updates: any = {};
        if (data.username) updates.username = data.username;
        if (data.avatar) updates.avatar = data.avatar;
        if (data.bio !== undefined) updates.bio = data.bio;

        const { error } = await withRetry(() =>
          supabase
            .from('profiles')
            .update(updates)
            .eq('id', userId)
        );

        if (error) {
          return { success: false, error: '更新失败，请稍后重试' };
        }

        set((s) => {
          const updatedUsers = s.users.map((u) =>
            u.id === userId ? { ...u, ...data } : u
          );
          const updatedCurrent =
            s.currentUserData?.id === userId
              ? { ...s.currentUserData, ...data }
              : s.currentUserData;
          return { users: updatedUsers, currentUserData: updatedCurrent };
        });
        return { success: true };
      },

      setUserRole: async (userId, role) => {
        // 服务端鉴权：仅坛主的会话令牌能通过校验
        const { error } = await withRetry(() =>
          supabase.rpc('set_user_role', {
            p_user_id: userId,
            p_role: role,
          })
        );

        if (error) {
          const raw = error.message || '';
          const msg = raw && raw.length < 50 ? raw : '设置失败，请稍后重试';
          return { success: false, error: msg };
        }

        set((s) => {
          const updatedUsers = s.users.map((u) =>
            u.id === userId ? { ...u, role } : u
          );
          const updatedCurrent =
            s.currentUserData?.id === userId
              ? { ...s.currentUserData, role }
              : s.currentUserData;
          return { users: updatedUsers, currentUserData: updatedCurrent };
        });
        return { success: true };
      },

      getCurrentUser: () => {
        const id = get().currentUserId;
        if (!id) return undefined;
        // 优先用缓存的完整数据
        const cached = get().currentUserData;
        if (cached && cached.id === id) return cached;
        // 回退到 users 数组
        return get().users.find((u) => u.id === id);
      },

      getUser: (id) => {
        const cached = get().currentUserData;
        if (cached && cached.id === id) return cached;
        return get().users.find((u) => u.id === id);
      },
    }),
    {
      name: 'forum-current-user',
      // 存储完整用户数据 + 会话令牌，解决刷新后掉线
      partialize: (state) => ({
        currentUserId: state.currentUserId,
        currentUserData: state.currentUserData,
      }),
      // 恢复持久化状态后，重新挂载会话令牌；
      // 旧版本存档没有令牌 → 自动登出（安全升级后必须重新登录一次）
      onRehydrateStorage: () => (state) => {
        const token = localStorage.getItem('forum-session-token');
        if (token && state?.currentUserData) {
          setForumToken(token);
        } else if (state?.currentUserData) {
          useUserStore.setState({ currentUserId: null, currentUserData: null });
        }
      },
    }
  )
);
