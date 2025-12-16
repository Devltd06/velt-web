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
          role: "Pro Plan",
        },
      ], { onConflict: "id" });
    } catch (e) {
      console.warn("profiles.upsert non-fatal", e);
    }
  }

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!email || !password || !username) {
      alert("Email, Password, and Username are required.");
      return;
    }
    if (!agreed) {
      alert("You must agree to the Terms and Privacy Policy.");
      return;
    }

    setLoading(true);
    const trimmedEmail = email.trim().toLowerCase();
    const trimmedUsername = username.trim();

    const ok = await checkUsernameAvailable(trimmedUsername);
    if (!ok) {
      setLoading(false);
      alert("Username taken. Choose another one.");
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
    <div className="min-h-screen flex items-center justify-center bg-[var(--background)] py-16 px-6">
      <div className="bg-[var(--background)] border border-[var(--foreground)]/20 p-8 rounded-2xl w-full max-w-md shadow-lg">
        <div className="text-center mb-6">
          <h2 className="text-2xl font-bold text-[var(--foreground)]">Create an Account</h2>
          <p className="mt-2 text-[var(--foreground)]/60">Sign up to continue</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-[var(--foreground)] mb-1">Username</label>
            <input
              name="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Choose a username"
              className="w-full p-3 rounded border border-[var(--foreground)]/20 placeholder-[var(--foreground)]/40 text-[var(--foreground)] bg-[var(--background)]"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-[var(--foreground)] mb-1">Full Name</label>
            <input
              name="fullName"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Your name (optional)"
              className="w-full p-3 rounded border border-[var(--foreground)]/20 placeholder-[var(--foreground)]/40 text-[var(--foreground)] bg-[var(--background)]"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-[var(--foreground)] mb-1">Bio</label>
            <input
              name="bio"
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Tell us about yourself (optional)"
              className="w-full p-3 rounded border border-[var(--foreground)]/20 placeholder-[var(--foreground)]/40 text-[var(--foreground)] bg-[var(--background)]"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-[var(--foreground)] mb-1">Email</label>
            <input
              name="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full p-3 rounded border border-[var(--foreground)]/20 placeholder-[var(--foreground)]/40 text-[var(--foreground)] bg-[var(--background)]"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-[var(--foreground)] mb-1">Password</label>
            <input
              name="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Create a strong password"
              className="w-full p-3 rounded border border-[var(--foreground)]/20 placeholder-[var(--foreground)]/40 text-[var(--foreground)] bg-[var(--background)]"
            />
          </div>

          <label className="flex items-center gap-3 text-sm text-[var(--foreground)]/70">
            <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} />
            <span>I agree to the <a href="/privacy" className="underline text-[var(--foreground)]">Privacy Policy</a></span>
          </label>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded font-semibold transition hover:opacity-80 bg-[var(--foreground)] text-[var(--background)]"
          >
            {loading ? "Creating account..." : "Next: Subscription"}
          </button>
        </form>

        <p className="text-center text-[var(--foreground)]/70 mt-4">
          Already have an account?
          <a href="/loginlister" className="underline ml-1 text-[var(--foreground)]">
            Sign in
          </a>
        </p>
      </div>
    </div>
  );
}

