// lib/store/profile.ts
import { create } from "zustand";
import { supabase } from "@/lib/supabase";

export interface Profile {
  email: string | null | undefined;
  id: string;
  username?: string;
  full_name?: string;
  avatar_url?: string;
  bio?: string;
  website?: string;
}

export interface ProfileState {
  user: any | null;
  profile: Profile | null;
  setUser: (u: any | null) => void;
  setProfile: (p: Profile | null) => void;
  loadProfile: (userId: string) => Promise<void>; // ✅ add loadProfile
}

export const useProfileStore = create<ProfileState>((set) => ({
  user: null,
  profile: null,

  setUser: (u) => set({ user: u }),
  setProfile: (p) => set({ profile: p }),

  // ✅ actually implement loadProfile
  loadProfile: async (userId: string) => {
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .single();

    if (data && !error) {
      set({ profile: data });
    } else {
      console.log("[useProfileStore] error loading profile:", error);
      set({ profile: null });
    }
  },
}));

