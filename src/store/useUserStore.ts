import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface UserState {
  searchCount: number;
  lastSearchDate: string | null;
  vipExpiry: string | null;
  
  incrementSearch: () => boolean; // Returns true if allowed, false if limit reached
  activateVip: (days: number) => void;
  isVip: () => boolean;
}

export const useUserStore = create<UserState>()(
  persist(
    (set, get) => ({
      searchCount: 0,
      lastSearchDate: null,
      vipExpiry: null,

      isVip: () => {
        const expiry = get().vipExpiry;
        if (!expiry) return false;
        return new Date(expiry).getTime() > new Date().getTime();
      },

      incrementSearch: () => {
        const state = get();
        if (state.isVip()) return true; // VIP has no limit

        const today = new Date().toDateString();
        
        // Reset count if it's a new day
        if (state.lastSearchDate !== today) {
          set({ searchCount: 1, lastSearchDate: today });
          return true;
        }

        // Check limit
        if (state.searchCount < 3) {
          set({ searchCount: state.searchCount + 1 });
          return true;
        }

        return false; // Limit reached
      },

      activateVip: (days: number) => {
        const currentExpiry = get().vipExpiry;
        const now = new Date();
        
        let newExpiryDate = new Date();
        if (currentExpiry && new Date(currentExpiry).getTime() > now.getTime()) {
          // Add to existing expiry
          newExpiryDate = new Date(new Date(currentExpiry).getTime() + days * 24 * 60 * 60 * 1000);
        } else {
          // Start fresh from today
          newExpiryDate = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
        }

        set({ vipExpiry: newExpiryDate.toISOString() });
      }
    }),
    {
      name: 'geoland-user-storage', // Key in localStorage
    }
  )
);
