import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface SiteState {
  siteName: string;
  setSiteName: (name: string) => void;
}

export const useSiteStore = create<SiteState>()(
  persist(
    (set) => ({
      siteName: '江江的论坛',
      setSiteName: (name) => set({ siteName: name }),
    }),
    { name: 'forum-site-settings' }
  )
);
