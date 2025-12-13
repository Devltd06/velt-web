// lib/store/profile.ts
import { create } from 'zustand';
import { supabase } from '../supabase';

type Profile = {
  id: string;
  full_name: string;
  username: string;
  bio: string;
  avatar_url: string;
};

type ProfileStore = {
  profile: Profile | null;
  loading: boolean;
  fetchProfile: () => Promise<void>;
  updateProfile: (updates: Partial<Profile>) => Promise<void>;
};

export const useProfileStore = create<ProfileStore>((set) => ({
  profile: null,
  loading: true,

  fetchProfile: async () => {
    set({ loading: true });
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return set({ loading: false });

    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    if (!error) set({ profile: data });
    set({ loading: false });
  },

  updateProfile: async (updates) => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', user.id);

    if (!error) {
      set((state) => ({
        profile: { ...state.profile, ...updates } as Profile,
      }));
    }
  },
}));
