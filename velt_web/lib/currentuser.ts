// lib/currentUser.ts
import { supabase } from './supabase';

export async function getCurrentUserIdAsync(): Promise<string | null> {
  try {
    const { data, error } = await supabase.auth.getUser();
    if (error) {
      console.error('Error getting user:', error);
      return null;
    }
    return data?.user?.id ?? null;
  } catch (e) {
    console.error('Exception getting user:', e);
    return null;
  }
}

