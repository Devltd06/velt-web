import { create } from 'zustand';

type Profile = {
  id: string;
  email?: string;
  full_name?: string;
  username?: string;
  bio?: string;
  avatar_url?: string;
  role?: "Pro Plan" | "Celebrity Plan" | "Channel Plan" | "Partnership Plan" | string; // ✅ role
  verified?: boolean; // ✅ verification badge
  subscription_start?: string | null; // ✅ ISO date string
  subscription_end?: string | null;   // ✅ ISO date string
};

type State = {
  profile: Profile | null;
  setProfile: (profile: Profile | null) => void;
};

export const useUserStore = create<State>((set) => ({
  profile: null,
  setProfile: (profile) => set({ profile }),
}));
