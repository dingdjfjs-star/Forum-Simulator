import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import type { Character } from '../types';

function generateId(): string {
  return crypto.randomUUID
    ? crypto.randomUUID()
    : Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
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

interface CharacterState {
  characters: Character[];
  loading: boolean;
  loadCharacters: () => Promise<void>;
  addCharacter: (userId: string, c: Omit<Character, 'id' | 'userId' | 'createdAt'>) => Promise<Character>;
  updateCharacter: (id: string, data: Partial<Omit<Character, 'id' | 'userId' | 'createdAt'>>) => Promise<void>;
  deleteCharacter: (id: string) => Promise<void>;
  getCharacter: (id: string | null) => Character | undefined;
  getUserCharacters: (userId: string) => Character[];
}

export const useCharacterStore = create<CharacterState>()(
  (set, get) => ({
    characters: [],
    loading: false,

    loadCharacters: async () => {
      set({ loading: true });
      const { data, error } = await withRetry(() =>
        supabase
          .from('characters')
          .select('*')
          .order('created_at', { ascending: false })
      );

      if (error) {
        console.error('加载角色失败:', error);
        set({ loading: false });
        return;
      }

      if (data) {
        set({
          characters: data.map((c: any) => ({
            id: c.id,
            userId: c.user_id,
            name: c.name,
            description: c.description || '',
            avatar: c.avatar || '😊',
            signature: c.signature || '',
            createdAt: new Date(c.created_at).getTime(),
          })),
        });
      }
      set({ loading: false });
    },

    addCharacter: async (userId, c) => {
      const row = {
        id: generateId(),
        user_id: userId,
        name: c.name,
        description: c.description || '',
        avatar: c.avatar || '😊',
        signature: c.signature || '',
      };

      const { data, error } = await withRetry(() =>
        supabase
          .from('characters')
          .insert(row)
          .select()
          .single()
      );

      if (error || !data) throw new Error('创建角色失败: ' + (error?.message || ''));

      const character: Character = {
        id: data.id,
        userId: data.user_id,
        name: data.name,
        description: data.description || '',
        avatar: data.avatar || '😊',
        signature: data.signature || '',
        createdAt: new Date(data.created_at).getTime(),
      };

      set((s) => ({ characters: [character, ...s.characters] }));
      return character;
    },

    updateCharacter: async (id, updates) => {
      const dbUpdates: any = {};
      if (updates.name !== undefined) dbUpdates.name = updates.name;
      if (updates.description !== undefined) dbUpdates.description = updates.description;
      if (updates.avatar !== undefined) dbUpdates.avatar = updates.avatar;
      if (updates.signature !== undefined) dbUpdates.signature = updates.signature;

      const { error } = await withRetry(() =>
        supabase
          .from('characters')
          .update(dbUpdates)
          .eq('id', id)
      );

      if (error) throw new Error('更新失败');

      set((s) => ({
        characters: s.characters.map((ch) =>
          ch.id === id ? { ...ch, ...updates } : ch
        ),
      }));
    },

    deleteCharacter: async (id) => {
      const { error } = await withRetry(() =>
        supabase
          .from('characters')
          .delete()
          .eq('id', id)
      );

      if (error) throw new Error('删除失败');

      set((s) => ({
        characters: s.characters.filter((ch) => ch.id !== id),
      }));
    },

    getCharacter: (id) => {
      if (!id) return undefined;
      return get().characters.find((ch) => ch.id === id);
    },

    getUserCharacters: (userId) =>
      get().characters.filter((ch) => ch.userId === userId),
  })
);
