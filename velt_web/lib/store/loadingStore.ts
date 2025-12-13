import { create } from 'zustand';

interface LoadingState {
  // Track loading states from different screens
  contentLoading: boolean;
  setContentLoading: (loading: boolean) => void;
  
  // Can add more loading states for other screens
  isAnyLoading: () => boolean;
}

export const useLoadingStore = create<LoadingState>((set, get) => ({
  contentLoading: false,
  setContentLoading: (loading: boolean) => set({ contentLoading: loading }),
  
  isAnyLoading: () => {
    const state = get();
    return state.contentLoading;
  },
}));
