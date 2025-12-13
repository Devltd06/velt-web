// supabase/functions/send-push-notification/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(supabaseUrl, supabaseKey);

// Expo push API endpoint
const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

serve(async (req) => {
  try {
    const { userId, title, body } = await req.json();

    // 1. Look up the recipient’s Expo token
    const { data: user, error } = await supabase
      .from("profiles")
      .select("expo_push_token")
      .eq("id", userId)
      .single();

    if (error || !user?.expo_push_token) {
      return new Response(
        JSON.stringify({ error: "No push token found for this user" }),
        { status: 400 }
      );
    }

    // 2. Send push via Expo API
    const message = {
      to: user.expo_push_token,
      sound: "default",
      title,
      body,
    };

    const response = await fetch(EXPO_PUSH_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(message),
    });

    const result = await response.json();
    console.log("Expo push response:", result);

    return new Response(JSON.stringify({ success: true, result }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error(err);
    return new Response(
      JSON.stringify({ error: "Failed to send notification" }),
      { status: 500 }
    );
  }
});


