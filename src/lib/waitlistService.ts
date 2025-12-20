import { supabase } from "@/lib/supabaseClient";
import { WaitlistEntry, WaitlistResponse } from "@/types/waitlist";

export const waitlistService = {
  /**
   * Subscribe email to waitlist
   */
  async subscribe(email: string, full_name?: string, phone_number?: string, interests?: string[]): Promise<WaitlistResponse> {
    try {
      const { data, error } = await supabase
        .from("waitlist")
        .insert([
          {
            email: email.toLowerCase(),
            full_name: full_name || null,
            phone_number: phone_number || null,
            interests: interests || ["billboard", "sharing", "creating"],
            status: "pending",
          },
        ])
        .select()
        .single();

      if (error) {
        return {
          error: {
            message: error.message,
            code: error.code,
          },
        };
      }

      return { data };
    } catch (error) {
      console.error("Error subscribing to waitlist:", error);
      return {
        error: {
          message: "Failed to subscribe to waitlist",
        },
      };
    }
  },

  /**
   * Check if email is already on waitlist
   */
  async isOnWaitlist(email: string): Promise<boolean> {
    try {
      const { data, error } = await supabase
        .from("waitlist")
        .select("id")
        .eq("email", email.toLowerCase())
        .single();

      if (error && error.code !== "PGRST116") {
        console.error("Error checking waitlist:", error);
        return false;
      }

      return !!data;
    } catch (error) {
      console.error("Error checking waitlist:", error);
      return false;
    }
  },

  /**
   * Get total waitlist count
   */
  async getWaitlistCount(): Promise<number> {
    try {
      const { count, error } = await supabase
        .from("waitlist")
        .select("*", { count: "exact" });

      if (error) {
        console.error("Error getting count:", error);
        return 0;
      }

      return count || 0;
    } catch (error) {
      console.error("Error getting count:", error);
      return 0;
    }
  },

  /**
   * Get entry by email (requires authentication)
   */
  async getByEmail(email: string): Promise<WaitlistEntry | null> {
    try {
      const { data, error } = await supabase
        .from("waitlist")
        .select("*")
        .eq("email", email.toLowerCase())
        .single();

      if (error && error.code !== "PGRST116") {
        console.error("Error fetching entry:", error);
        return null;
      }

      return data || null;
    } catch (error) {
      console.error("Error fetching entry:", error);
      return null;
    }
  },

  /**
   * Subscribe with custom interests
   */
  async subscribeWithInterests(
    email: string,
    full_name: string,
    interests: string[]
  ): Promise<WaitlistResponse> {
    return this.subscribe(email, full_name, interests);
  },
};
