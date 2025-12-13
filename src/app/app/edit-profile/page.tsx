"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  FaArrowLeft,
  FaCamera,
  FaUser,
  FaAt,
  FaBriefcase,
  FaMapMarkerAlt,
  FaGlobe,
  FaBirthdayCake,
  FaStore,
} from "react-icons/fa";
import { supabase } from "@/lib/supabaseClient";

const VELT_ACCENT = "#D4AF37";

interface Profile {
  id: string;
  username?: string | null;
  full_name?: string | null;
  avatar_url?: string | null;
  cover_photo_url?: string | null;
  bio?: string | null;
  website?: string | null;
  location?: string | null;
  profession?: string | null;
  date_of_birth?: string | null;
  business_name?: string | null;
}

export default function EditProfilePage() {
  const router = useRouter();
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);

  // Form state
  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [bio, setBio] = useState("");
  const [profession, setProfession] = useState("");
  const [location, setLocation] = useState("");
  const [website, setWebsite] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [businessName, setBusinessName] = useState("");

  // Image preview URLs
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [coverFile, setCoverFile] = useState<File | null>(null);

  // Load profile
  useEffect(() => {
    const loadProfile = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push("/app/welcome");
        return;
      }

      const { data: profileData } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", session.user.id)
        .single();

      if (profileData) {
        setProfile(profileData);
        setFullName(profileData.full_name || "");
        setUsername(profileData.username || "");
        setBio(profileData.bio || "");
        setProfession(profileData.profession || "");
        setLocation(profileData.location || "");
        setWebsite(profileData.website || "");
        setDateOfBirth(profileData.date_of_birth || "");
        setBusinessName(profileData.business_name || "");
        setAvatarPreview(profileData.avatar_url || null);
        setCoverPreview(profileData.cover_photo_url || null);
      }
      setLoading(false);
    };
    loadProfile();
  }, [router]);

  // Handle avatar selection
  const handleAvatarSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setAvatarFile(file);
      setAvatarPreview(URL.createObjectURL(file));
    }
  };

  // Handle cover selection
  const handleCoverSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setCoverFile(file);
      setCoverPreview(URL.createObjectURL(file));
    }
  };

  // Save profile
  const handleSave = async () => {
    if (!profile) return;
    setSaving(true);

    try {
      let avatarUrl = profile.avatar_url;
      let coverUrl = profile.cover_photo_url;

      // Upload avatar if changed
      if (avatarFile) {
        const ext = avatarFile.name.split(".").pop() || "jpg";
        const filePath = `${profile.id}/avatar_${Date.now()}.${ext}`;
        
        const { error: uploadError } = await supabase.storage
          .from("avatars")
          .upload(filePath, avatarFile, { upsert: true });

        if (!uploadError) {
          const { data: { publicUrl } } = supabase.storage
            .from("avatars")
            .getPublicUrl(filePath);
          avatarUrl = publicUrl;
        }
      }

      // Upload cover if changed
      if (coverFile) {
        const ext = coverFile.name.split(".").pop() || "jpg";
        const filePath = `${profile.id}/cover_${Date.now()}.${ext}`;
        
        const { error: uploadError } = await supabase.storage
          .from("covers")
          .upload(filePath, coverFile, { upsert: true });

        if (!uploadError) {
          const { data: { publicUrl } } = supabase.storage
            .from("covers")
            .getPublicUrl(filePath);
          coverUrl = publicUrl;
        }
      }

      // Update profile
      const { error: updateError } = await supabase
        .from("profiles")
        .update({
          full_name: fullName.trim() || null,
          username: username.trim() || null,
          bio: bio.trim() || null,
          profession: profession.trim() || null,
          location: location.trim() || null,
          website: website.trim() || null,
          date_of_birth: dateOfBirth || null,
          business_name: businessName.trim() || null,
          avatar_url: avatarUrl,
          cover_photo_url: coverUrl,
        })
        .eq("id", profile.id);

      if (updateError) {
        alert("Failed to save profile. Please try again.");
      } else {
        router.push("/app/profile");
      }
    } catch (err) {
      console.error("Save profile error:", err);
      alert("Failed to save profile. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-black/80 backdrop-blur-sm border-b border-white/10">
        <div className="flex items-center justify-between px-4 py-3 max-w-2xl mx-auto">
          <button
            onClick={() => router.back()}
            className="p-2 rounded-full hover:bg-white/10 transition"
          >
            <FaArrowLeft size={20} />
          </button>
          <h1 className="font-bold text-lg">Edit Profile</h1>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 rounded-full font-semibold transition disabled:opacity-50"
            style={{ backgroundColor: VELT_ACCENT, color: "#000" }}
          >
            {saving ? "Saving..." : "Save"}
          </button>
        </div>
      </header>

      <div className="pt-16 pb-8 max-w-2xl mx-auto">
        {/* Cover Photo */}
        <div className="relative h-48 bg-white/5">
          {coverPreview ? (
            <img
              src={coverPreview}
              alt="Cover"
              className="w-full h-full object-cover"
            />
          ) : (
            <div
              className="w-full h-full"
              style={{ background: `linear-gradient(135deg, ${VELT_ACCENT}40, #1a1a1a)` }}
            />
          )}
          <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
            <button
              onClick={() => coverInputRef.current?.click()}
              className="flex items-center gap-2 px-4 py-2 bg-black/60 rounded-full hover:bg-black/80 transition"
            >
              <FaCamera size={16} />
              <span className="text-sm">Change Cover</span>
            </button>
          </div>
          <input
            ref={coverInputRef}
            type="file"
            accept="image/*"
            onChange={handleCoverSelect}
            className="hidden"
          />
        </div>

        {/* Avatar */}
        <div className="px-4 -mt-16 relative z-10">
          <div className="relative w-32 h-32">
            <div
              className="w-full h-full rounded-full overflow-hidden border-4 border-black"
              style={{ boxShadow: `0 0 0 3px ${VELT_ACCENT}` }}
            >
              {avatarPreview ? (
                <img
                  src={avatarPreview}
                  alt="Avatar"
                  className="w-full h-full object-cover"
                />
              ) : (
                <div
                  className="w-full h-full flex items-center justify-center text-black text-4xl font-bold"
                  style={{ backgroundColor: VELT_ACCENT }}
                >
                  {(fullName || username || "?").charAt(0).toUpperCase()}
                </div>
              )}
            </div>
            <button
              onClick={() => avatarInputRef.current?.click()}
              className="absolute bottom-0 right-0 p-2 rounded-full"
              style={{ backgroundColor: VELT_ACCENT }}
            >
              <FaCamera size={14} className="text-black" />
            </button>
          </div>
          <input
            ref={avatarInputRef}
            type="file"
            accept="image/*"
            onChange={handleAvatarSelect}
            className="hidden"
          />
        </div>

        {/* Form */}
        <div className="px-4 mt-6 space-y-4">
          {/* Full Name */}
          <div className="bg-white/5 rounded-xl p-4">
            <label className="flex items-center gap-2 text-sm text-white/60 mb-2">
              <FaUser size={14} style={{ color: VELT_ACCENT }} />
              Full Name
            </label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Your full name"
              className="w-full bg-transparent border-none outline-none text-white placeholder-white/30"
            />
          </div>

          {/* Username */}
          <div className="bg-white/5 rounded-xl p-4">
            <label className="flex items-center gap-2 text-sm text-white/60 mb-2">
              <FaAt size={14} style={{ color: VELT_ACCENT }} />
              Username
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))}
              placeholder="username"
              className="w-full bg-transparent border-none outline-none text-white placeholder-white/30"
            />
          </div>

          {/* Bio */}
          <div className="bg-white/5 rounded-xl p-4">
            <label className="text-sm text-white/60 mb-2 block">Bio</label>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Tell us about yourself..."
              rows={3}
              maxLength={300}
              className="w-full bg-transparent border-none outline-none text-white placeholder-white/30 resize-none"
            />
            <p className="text-right text-xs text-white/40">{bio.length}/300</p>
          </div>

          {/* Profession */}
          <div className="bg-white/5 rounded-xl p-4">
            <label className="flex items-center gap-2 text-sm text-white/60 mb-2">
              <FaBriefcase size={14} style={{ color: VELT_ACCENT }} />
              Profession
            </label>
            <input
              type="text"
              value={profession}
              onChange={(e) => setProfession(e.target.value)}
              placeholder="What do you do?"
              className="w-full bg-transparent border-none outline-none text-white placeholder-white/30"
            />
          </div>

          {/* Location */}
          <div className="bg-white/5 rounded-xl p-4">
            <label className="flex items-center gap-2 text-sm text-white/60 mb-2">
              <FaMapMarkerAlt size={14} style={{ color: VELT_ACCENT }} />
              Location
            </label>
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Where are you based?"
              className="w-full bg-transparent border-none outline-none text-white placeholder-white/30"
            />
          </div>

          {/* Website */}
          <div className="bg-white/5 rounded-xl p-4">
            <label className="flex items-center gap-2 text-sm text-white/60 mb-2">
              <FaGlobe size={14} style={{ color: VELT_ACCENT }} />
              Website
            </label>
            <input
              type="url"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              placeholder="https://yourwebsite.com"
              className="w-full bg-transparent border-none outline-none text-white placeholder-white/30"
            />
          </div>

          {/* Date of Birth */}
          <div className="bg-white/5 rounded-xl p-4">
            <label className="flex items-center gap-2 text-sm text-white/60 mb-2">
              <FaBirthdayCake size={14} style={{ color: VELT_ACCENT }} />
              Date of Birth
            </label>
            <input
              type="date"
              value={dateOfBirth}
              onChange={(e) => setDateOfBirth(e.target.value)}
              className="w-full bg-transparent border-none outline-none text-white placeholder-white/30"
              style={{ colorScheme: "dark" }}
            />
          </div>

          {/* Business Name */}
          <div className="bg-white/5 rounded-xl p-4">
            <label className="flex items-center gap-2 text-sm text-white/60 mb-2">
              <FaStore size={14} style={{ color: VELT_ACCENT }} />
              Business Name (optional)
            </label>
            <input
              type="text"
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
              placeholder="Your business name"
              className="w-full bg-transparent border-none outline-none text-white placeholder-white/30"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
