import { create } from "zustand";
import { supabase } from "@/lib/supabase";

interface Profile {
  id: string;
  full_name: string;
  bio: string;
  avatar_url: string;
  role?: string;
}

interface ProfileState {
  user: any | null; // Supabase Auth user
  profile: Profile | null; // Profile row from "profiles" table
  setUser: (user: any | null) => void;
  setProfile: (profile: Profile | null) => void;
  loadProfile: (userId: string) => Promise<void>;
}

export const useProfileStore = create<ProfileState>((set) => ({
  user: null,
  profile: null,

  setUser: (user) => set({ user }),
  setProfile: (profile) => set({ profile }),

  loadProfile: async (userId: string) => {
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .single();

    if (data && !error) {
      set({ profile: data });
    } else {
      console.log("Error loading profile:", error);
      set({ profile: null });
    }
  },
}));
