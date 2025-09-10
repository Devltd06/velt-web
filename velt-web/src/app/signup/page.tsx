// src/app/signup/page.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

export default function Signup() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [bio, setBio] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [loading, setLoading] = useState(false);

  async function checkUsernameAvailable(name: string): Promise<boolean> {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("id")
        .ilike("username", name)
        .limit(1);
      if (error) return true;
      return (data?.length ?? 0) === 0;
    } catch {
      return true;
    }
  }

  async function upsertProfile(params: { id: string; email: string; username: string; full_name?: string; bio?: string; }) {
    try {
      await supabase.from("profiles").upsert([
        {
          id: params.id,
          email: params.email,
          username: params.username,
          full_name: params.full_name ?? null,
          bio: params.bio ?? null,
          role: "free",
        },
      ], { onConflict: "id" });
    } catch (e) {
      console.warn("profiles.upsert non-fatal", e);
    }
  }

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!email || !password || !username) {
      alert("Email, Password and Username are required.");
      return;
    }
    if (!agreed) {
      alert("You must agree to the Terms & Privacy Policy.");
      return;
    }

    setLoading(true);
    const trimmedEmail = email.trim().toLowerCase();
    const trimmedUsername = username.trim();

    const ok = await checkUsernameAvailable(trimmedUsername);
    if (!ok) {
      setLoading(false);
      alert("Username taken — choose another one.");
      return;
    }

    const { data, error } = await supabase.auth.signUp({
      email: trimmedEmail,
      password,
    });

    if (error) {
      setLoading(false);
      alert("Sign up error: " + error.message);
      return;
    }

    const user = data.user;
    if (!user) {
      setLoading(false);
      alert("No user was created. Check email confirmation requirement.");
      return;
    }

    await upsertProfile({
      id: user.id,
      email: trimmedEmail,
      username: trimmedUsername,
      full_name: fullName.trim(),
      bio: bio.trim(),
    });

    setLoading(false);

    // redirect to subscription with encoded data
    const payload = {
      id: user.id,
      email: trimmedEmail,
      password,
      fullName,
      username: trimmedUsername,
      bio,
    };
    router.push(`/subscription?data=${encodeURIComponent(JSON.stringify(payload))}`);
  };

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ backgroundImage: "url('/signup-bg.jpg')", backgroundSize: "cover" }}>
      <div className="bg-black/60 p-8 rounded-2xl w-full max-w-md text-white shadow-lg">
        <img src="/favicon.ico" alt="VELT" className="mx-auto w-20 mb-4" />
        <h2 className="text-2xl font-bold text-center mb-2">Create an account</h2>
        <p className="text-center text-gray-300 mb-4">Sign up to continue</p>

        <form onSubmit={handleSubmit} className="space-y-3">
          <input name="username" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Username" className="w-full p-3 rounded bg-black/30 placeholder-gray-400" />
          <input name="fullName" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Full Name (optional)" className="w-full p-3 rounded bg-black/30 placeholder-gray-400" />
          <input name="bio" value={bio} onChange={(e) => setBio(e.target.value)} placeholder="Bio (optional)" className="w-full p-3 rounded bg-black/30 placeholder-gray-400" />
          <input name="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" className="w-full p-3 rounded bg-black/30 placeholder-gray-400" />
          <input name="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" className="w-full p-3 rounded bg-black/30 placeholder-gray-400" />

          <label className="flex items-center gap-3">
            <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} />
            <span className="text-sm text-gray-300">I agree to the <a href="/legal/terms" className="underline text-blue-400">Terms</a> and <a href="/legal/privacy" className="underline text-blue-400">Privacy Policy</a></span>
          </label>

          <button type="submit" disabled={loading} className="w-full bg-blue-600 py-3 rounded font-semibold hover:bg-blue-700 transition">
            {loading ? "Creating account..." : "Next: Subscription"}
          </button>
        </form>

        <p className="text-center text-gray-300 mt-4">Already have an account? <a href="/" className="text-blue-400 underline">Log in via the app</a></p>
      </div>
    </div>
  );
}

