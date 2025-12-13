// app/providers/AuthProvider.tsx
import React, { useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useProfileStore } from "@/lib/store/profile";

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const profileStore = useProfileStore(); // ✅ grab the full store object
  const { setUser, setProfile, loadProfile } = profileStore;

  useEffect(() => {
    const init = async () => {
      const { data } = await supabase.auth.getUser();
      if (data?.user) {
        setUser(data.user);
        await loadProfile(data.user.id);
      } else {
        setUser(null);
        setProfile(null);
      }
    };
    init();

    // 🔄 Listen for login/logout events
    const { data: subscription } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        if (session?.user) {
          setUser(session.user);
          await loadProfile(session.user.id);
        } else {
          setUser(null);
          setProfile(null);
        }
      }
    );

    return () => {
      subscription?.subscription?.unsubscribe();
    };
  }, []);

  return <>{children}</>;
};
