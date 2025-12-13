"use client";

import React, { useState, useRef, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  FaArrowLeft,
  FaImage,
  FaVideo,
  FaTimes,
  FaMapMarkerAlt,
  FaUserTag,
  FaClock,
  FaPlus,
  FaTrash,
  FaCheck,
  FaPlay,
  FaPause,
  FaExpand,
} from "react-icons/fa";
import { supabase } from "@/lib/supabaseClient";

const VELT_ACCENT = "#D4AF37";
const MAX_MEDIA_ITEMS = 10;

// Predefined labels matching mobile
const PREDEFINED_LABELS = [
  "Lifestyle", "Daily Vlog", "Day in Life", "Morning Routine", "Night Routine",
  "Self Care", "Wellness", "Fitness", "Workout", "Health",
  "Fashion", "OOTD", "Style", "Beauty", "Makeup", "Skincare", "Hair",
  "Food", "Foodie", "Recipe", "Cooking", "Baking", "Drinks", "Coffee",
  "Travel", "Adventure", "Explore", "Vacation", "Road Trip", "City Tour",
  "Music", "Dance", "Art", "Photography", "Film", "Gaming", "Movies",
  "Business", "Promo", "Drop", "Launch", "Sale", "Brand", "Work",
  "Event", "Party", "Celebration", "Birthday", "Wedding", "Holiday",
  "Vibes", "Mood", "Chill", "Fun", "Inspiration", "Motivation",
  "DIY", "Tips", "Tutorial", "Review", "Unboxing", "Haul", "Other"
];

// Expiry options
const EXPIRY_OPTIONS = [
  { value: "24h", label: "24 Hours" },
  { value: "2d", label: "2 Days" },
  { value: "3d", label: "3 Days" },
  { value: "7d", label: "7 Days" },
  { value: "30d", label: "30 Days" },
];

type MediaItem = {
  id: string;
  uri: string;
  type: "image" | "video";
  file: File;
  thumbnail?: string;
};

type Profile = {
  id: string;
  username?: string | null;
  full_name?: string | null;
  avatar_url?: string | null;
};

export default function CreateStoryPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  // Auth & Profile
  const [userId, setUserId] = useState<string | null>(null);

  // Media
  const [mediaItems, setMediaItems] = useState<MediaItem[]>([]);
  const [activeMediaIndex, setActiveMediaIndex] = useState(0);
  const [isVideoPlaying, setIsVideoPlaying] = useState(false);

  // Form state
  const [caption, setCaption] = useState("");
  const [label, setLabel] = useState("");
  const [labelSheetOpen, setLabelSheetOpen] = useState(false);
  const [expiryChoice, setExpiryChoice] = useState("24h");
  const [location, setLocation] = useState("");
  const [locationSheetOpen, setLocationSheetOpen] = useState(false);
  const [partnerSheetOpen, setPartnerSheetOpen] = useState(false);
  const [partnerSearch, setPartnerSearch] = useState("");
  const [partnerResults, setPartnerResults] = useState<Profile[]>([]);
  const [selectedPartners, setSelectedPartners] = useState<Profile[]>([]);
  const [publishQuality, setPublishQuality] = useState<"hd" | "compressed">("hd");

  // Upload state
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  // Check auth
  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push("/app/welcome");
        return;
      }
      setUserId(session.user.id);
    };
    checkAuth();
  }, [router]);

  // Partner search
  useEffect(() => {
    if (!partnerSheetOpen || !partnerSearch.trim()) {
      setPartnerResults([]);
      return;
    }
    const timeout = setTimeout(async () => {
      const { data } = await supabase
        .from("profiles")
        .select("id, full_name, avatar_url, username")
        .or(`full_name.ilike.%${partnerSearch}%,username.ilike.%${partnerSearch}%`)
        .limit(10);
      if (data) setPartnerResults(data);
    }, 300);
    return () => clearTimeout(timeout);
  }, [partnerSearch, partnerSheetOpen]);

  // Handle file selection
  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const newItems: MediaItem[] = [];
    Array.from(files).forEach((file) => {
      if (mediaItems.length + newItems.length >= MAX_MEDIA_ITEMS) return;
      
      const isVideo = file.type.startsWith("video/");
      const id = crypto.randomUUID();
      const uri = URL.createObjectURL(file);
      
      newItems.push({
        id,
        uri,
        type: isVideo ? "video" : "image",
        file,
      });
    });

    setMediaItems((prev) => [...prev, ...newItems]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, [mediaItems.length]);

  // Remove media item
  const removeMediaItem = (id: string) => {
    setMediaItems((prev) => {
      const filtered = prev.filter((it) => it.id !== id);
      if (activeMediaIndex >= filtered.length && filtered.length > 0) {
        setActiveMediaIndex(filtered.length - 1);
      }
      return filtered;
    });
  };

  // Toggle video playback
  const toggleVideoPlay = () => {
    if (!videoRef.current) return;
    if (isVideoPlaying) {
      videoRef.current.pause();
    } else {
      videoRef.current.play();
    }
    setIsVideoPlaying(!isVideoPlaying);
  };

  // Calculate expiry date
  const getExpiryDate = () => {
    const now = new Date();
    switch (expiryChoice) {
      case "24h": return new Date(now.getTime() + 24 * 60 * 60 * 1000);
      case "2d": return new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000);
      case "3d": return new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
      case "7d": return new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
      case "30d": return new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
      default: return new Date(now.getTime() + 24 * 60 * 60 * 1000);
    }
  };

  // Handle publish
  const handlePublish = async () => {
    if (!userId || !mediaItems.length || !label.trim()) {
      alert("Please select media and a label");
      return;
    }

    setUploading(true);
    setUploadProgress(0);

    try {
      const totalItems = mediaItems.length;
      let uploaded = 0;

      for (const item of mediaItems) {
        // Upload to Supabase storage
        const ext = item.file.name.split(".").pop() || (item.type === "video" ? "mp4" : "jpg");
        const filePath = `${userId}/${Date.now()}_${crypto.randomUUID()}.${ext}`;

        const { error: uploadError } = await supabase.storage
          .from("stories")
          .upload(filePath, item.file, {
            cacheControl: "3600",
            upsert: false,
          });

        if (uploadError) throw uploadError;

        // Get public URL
        const { data: { publicUrl } } = supabase.storage
          .from("stories")
          .getPublicUrl(filePath);

        // Create story record
        const expireAt = getExpiryDate();
        const { error: insertError } = await supabase
          .from("stories")
          .insert({
            user_id: userId,
            media_url: publicUrl,
            media_type: item.type,
            caption: caption.trim() || null,
            label: label.trim(),
            expire_at: expireAt.toISOString(),
            is_hd: publishQuality === "hd",
            visibility: "public",
            partners: selectedPartners.length > 0 ? selectedPartners.map((p) => p.id) : null,
            location: location.trim() || null,
          });

        if (insertError) throw insertError;

        uploaded++;
        setUploadProgress(Math.round((uploaded / totalItems) * 100));
      }

      // Success - redirect to home
      router.push("/app/home");
    } catch (err) {
      console.error("Upload failed:", err);
      alert("Upload failed. Please try again.");
    } finally {
      setUploading(false);
    }
  };

  const activeMedia = mediaItems[activeMediaIndex];
  const canPublish = mediaItems.length > 0 && label.trim() && !uploading;

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-black/80 backdrop-blur-sm border-b border-white/10">
        <div className="flex items-center justify-between px-4 py-3">
          <button
            onClick={() => router.back()}
            className="p-2 rounded-full hover:bg-white/10 transition"
          >
            <FaArrowLeft size={20} />
          </button>
          <h1 className="font-bold text-lg">Create Story</h1>
          <button
            onClick={handlePublish}
            disabled={!canPublish}
            className={`px-4 py-2 rounded-full font-semibold transition ${
              canPublish
                ? "text-black hover:opacity-90"
                : "bg-white/20 text-white/40 cursor-not-allowed"
            }`}
            style={{ backgroundColor: canPublish ? VELT_ACCENT : undefined }}
          >
            {uploading ? `${uploadProgress}%` : "Publish"}
          </button>
        </div>
      </header>

      <div className="pt-16 pb-24 flex flex-col lg:flex-row max-w-6xl mx-auto">
        {/* Media Preview Area */}
        <div className="lg:w-1/2 p-4">
          <div className="aspect-[9/16] max-h-[70vh] bg-white/5 rounded-2xl overflow-hidden relative mx-auto">
            {activeMedia ? (
              <>
                {activeMedia.type === "video" ? (
                  <div className="relative w-full h-full">
                    <video
                      ref={videoRef}
                      src={activeMedia.uri}
                      className="w-full h-full object-cover"
                      loop
                      playsInline
                      onClick={toggleVideoPlay}
                    />
                    <button
                      onClick={toggleVideoPlay}
                      className="absolute inset-0 flex items-center justify-center bg-black/20 opacity-0 hover:opacity-100 transition"
                    >
                      {isVideoPlaying ? (
                        <FaPause size={48} className="text-white/80" />
                      ) : (
                        <FaPlay size={48} className="text-white/80" />
                      )}
                    </button>
                  </div>
                ) : (
                  <img
                    src={activeMedia.uri}
                    alt=""
                    className="w-full h-full object-cover"
                  />
                )}
                
                {/* Remove button */}
                <button
                  onClick={() => removeMediaItem(activeMedia.id)}
                  className="absolute top-3 right-3 p-2 bg-black/60 rounded-full hover:bg-red-500/80 transition"
                >
                  <FaTrash size={14} />
                </button>
              </>
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center gap-4">
                <div className="text-white/40">
                  <FaImage size={64} />
                </div>
                <p className="text-white/60">Select media to upload</p>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="px-6 py-3 rounded-xl font-semibold transition hover:opacity-90"
                  style={{ backgroundColor: VELT_ACCENT, color: "#000" }}
                >
                  <FaPlus className="inline mr-2" />
                  Add Media
                </button>
              </div>
            )}
          </div>

          {/* Media thumbnails */}
          {mediaItems.length > 0 && (
            <div className="flex gap-2 mt-4 overflow-x-auto pb-2">
              {mediaItems.map((item, index) => (
                <button
                  key={item.id}
                  onClick={() => setActiveMediaIndex(index)}
                  className={`flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden relative ${
                    index === activeMediaIndex ? "opacity-100" : "opacity-60"
                  }`}
                  style={{ 
                    outline: index === activeMediaIndex ? `2px solid ${VELT_ACCENT}` : "none",
                    outlineOffset: 2,
                  }}
                >
                  {item.type === "video" ? (
                    <video src={item.uri} className="w-full h-full object-cover" />
                  ) : (
                    <img src={item.uri} alt="" className="w-full h-full object-cover" />
                  )}
                  {item.type === "video" && (
                    <div className="absolute bottom-1 right-1 bg-black/60 p-1 rounded">
                      <FaVideo size={8} />
                    </div>
                  )}
                </button>
              ))}
              
              {mediaItems.length < MAX_MEDIA_ITEMS && (
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="flex-shrink-0 w-16 h-16 rounded-lg border border-dashed border-white/20 flex items-center justify-center hover:border-white/40 transition"
                >
                  <FaPlus size={20} className="text-white/40" />
                </button>
              )}
            </div>
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,video/*"
            multiple
            onChange={handleFileSelect}
            className="hidden"
          />
        </div>

        {/* Form Area */}
        <div className="lg:w-1/2 p-4 space-y-4">
          {/* Caption */}
          <div className="bg-white/5 rounded-xl p-4">
            <label className="text-sm text-white/60 mb-2 block">Caption</label>
            <textarea
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              placeholder="Write a caption..."
              className="w-full bg-transparent border-none outline-none resize-none text-white placeholder-white/30 min-h-[100px]"
              maxLength={500}
            />
            <p className="text-right text-xs text-white/40">{caption.length}/500</p>
          </div>

          {/* Label (Required) */}
          <button
            onClick={() => setLabelSheetOpen(true)}
            className="w-full bg-white/5 rounded-xl p-4 flex items-center justify-between hover:bg-white/10 transition"
          >
            <div className="flex items-center gap-3">
              <FaPlus size={16} style={{ color: VELT_ACCENT }} />
              <span className="text-white/60">Label</span>
            </div>
            <span className={label ? "text-white" : "text-white/40"}>
              {label || "Required"}
            </span>
          </button>

          {/* Expiry */}
          <div className="bg-white/5 rounded-xl p-4">
            <div className="flex items-center gap-3 mb-3">
              <FaClock size={16} style={{ color: VELT_ACCENT }} />
              <span className="text-white/60">Expires after</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {EXPIRY_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setExpiryChoice(opt.value)}
                  className={`px-4 py-2 rounded-full text-sm transition ${
                    expiryChoice === opt.value
                      ? "text-black font-semibold"
                      : "bg-white/10 text-white/60 hover:bg-white/20"
                  }`}
                  style={{ backgroundColor: expiryChoice === opt.value ? VELT_ACCENT : undefined }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Quality Toggle */}
          <div className="bg-white/5 rounded-xl p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <FaExpand size={16} style={{ color: VELT_ACCENT }} />
                <span className="text-white/60">Quality</span>
              </div>
              <div className="flex bg-white/10 rounded-full p-1">
                <button
                  onClick={() => setPublishQuality("hd")}
                  className={`px-4 py-1 rounded-full text-sm transition ${
                    publishQuality === "hd" ? "text-black font-semibold" : "text-white/60"
                  }`}
                  style={{ backgroundColor: publishQuality === "hd" ? VELT_ACCENT : undefined }}
                >
                  HD
                </button>
                <button
                  onClick={() => setPublishQuality("compressed")}
                  className={`px-4 py-1 rounded-full text-sm transition ${
                    publishQuality === "compressed" ? "text-black font-semibold" : "text-white/60"
                  }`}
                  style={{ backgroundColor: publishQuality === "compressed" ? VELT_ACCENT : undefined }}
                >
                  Compressed
                </button>
              </div>
            </div>
          </div>

          {/* Location */}
          <button
            onClick={() => setLocationSheetOpen(true)}
            className="w-full bg-white/5 rounded-xl p-4 flex items-center justify-between hover:bg-white/10 transition"
          >
            <div className="flex items-center gap-3">
              <FaMapMarkerAlt size={16} style={{ color: VELT_ACCENT }} />
              <span className="text-white/60">Location</span>
            </div>
            <span className={location ? "text-white truncate max-w-[200px]" : "text-white/40"}>
              {location || "Add location"}
            </span>
          </button>

          {/* Tag Partners */}
          <button
            onClick={() => setPartnerSheetOpen(true)}
            className="w-full bg-white/5 rounded-xl p-4 flex items-center justify-between hover:bg-white/10 transition"
          >
            <div className="flex items-center gap-3">
              <FaUserTag size={16} style={{ color: VELT_ACCENT }} />
              <span className="text-white/60">Tag People</span>
            </div>
            <span className={selectedPartners.length ? "text-white" : "text-white/40"}>
              {selectedPartners.length > 0 ? `${selectedPartners.length} tagged` : "Add"}
            </span>
          </button>

          {/* Tagged Partners Display */}
          {selectedPartners.length > 0 && (
            <div className="flex flex-wrap gap-2 px-4">
              {selectedPartners.map((p) => (
                <div
                  key={p.id}
                  className="flex items-center gap-2 bg-white/10 rounded-full px-3 py-1"
                >
                  <span className="text-sm">{p.full_name || p.username}</span>
                  <button
                    onClick={() => setSelectedPartners((prev) => prev.filter((x) => x.id !== p.id))}
                    className="text-white/40 hover:text-white"
                  >
                    <FaTimes size={12} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Label Sheet */}
      <AnimatePresence>
        {labelSheetOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 z-50 flex items-end justify-center"
            onClick={() => setLabelSheetOpen(false)}
          >
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25 }}
              className="bg-zinc-900 rounded-t-2xl w-full max-w-lg max-h-[70vh] overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-4 border-b border-white/10 flex items-center justify-between">
                <h3 className="font-bold text-lg">Select Label</h3>
                <button onClick={() => setLabelSheetOpen(false)}>
                  <FaTimes />
                </button>
              </div>
              <div className="p-4 overflow-y-auto max-h-[50vh]">
                <div className="flex flex-wrap gap-2">
                  {PREDEFINED_LABELS.map((l) => (
                    <button
                      key={l}
                      onClick={() => {
                        setLabel(l);
                        setLabelSheetOpen(false);
                      }}
                      className={`px-4 py-2 rounded-full text-sm transition ${
                        label === l
                          ? "text-black font-semibold"
                          : "bg-white/10 text-white/80 hover:bg-white/20"
                      }`}
                      style={{ backgroundColor: label === l ? VELT_ACCENT : undefined }}
                    >
                      {l}
                    </button>
                  ))}
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Location Sheet */}
      <AnimatePresence>
        {locationSheetOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 z-50 flex items-end justify-center"
            onClick={() => setLocationSheetOpen(false)}
          >
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25 }}
              className="bg-zinc-900 rounded-t-2xl w-full max-w-lg max-h-[70vh] overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-4 border-b border-white/10">
                <h3 className="font-bold text-lg mb-3">Add Location</h3>
                <input
                  type="text"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="Enter location..."
                  className="w-full bg-white/10 rounded-xl px-4 py-3 outline-none placeholder-white/40"
                />
              </div>
              <div className="p-4 flex justify-end gap-3">
                <button
                  onClick={() => {
                    setLocation("");
                    setLocationSheetOpen(false);
                  }}
                  className="px-4 py-2 text-white/60 hover:text-white"
                >
                  Clear
                </button>
                <button
                  onClick={() => setLocationSheetOpen(false)}
                  className="px-6 py-2 rounded-full font-semibold"
                  style={{ backgroundColor: VELT_ACCENT, color: "#000" }}
                >
                  Done
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Partner Sheet */}
      <AnimatePresence>
        {partnerSheetOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 z-50 flex items-end justify-center"
            onClick={() => setPartnerSheetOpen(false)}
          >
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25 }}
              className="bg-zinc-900 rounded-t-2xl w-full max-w-lg max-h-[70vh] overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-4 border-b border-white/10">
                <h3 className="font-bold text-lg mb-3">Tag People</h3>
                <input
                  type="text"
                  value={partnerSearch}
                  onChange={(e) => setPartnerSearch(e.target.value)}
                  placeholder="Search by name or username..."
                  className="w-full bg-white/10 rounded-xl px-4 py-3 outline-none placeholder-white/40"
                />
              </div>
              <div className="p-4 overflow-y-auto max-h-[40vh] space-y-2">
                {partnerResults.map((p) => {
                  const isSelected = selectedPartners.some((x) => x.id === p.id);
                  return (
                    <button
                      key={p.id}
                      onClick={() => {
                        if (isSelected) {
                          setSelectedPartners((prev) => prev.filter((x) => x.id !== p.id));
                        } else if (selectedPartners.length < 5) {
                          setSelectedPartners((prev) => [...prev, p]);
                        }
                      }}
                      className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-white/10 transition"
                    >
                      <div className="w-10 h-10 rounded-full overflow-hidden bg-white/10">
                        {p.avatar_url ? (
                          <img src={p.avatar_url} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center" style={{ backgroundColor: VELT_ACCENT }}>
                            <span className="text-black font-bold">{(p.full_name || p.username || "?").charAt(0)}</span>
                          </div>
                        )}
                      </div>
                      <div className="flex-1 text-left">
                        <p className="font-medium">{p.full_name || p.username}</p>
                        {p.username && <p className="text-sm text-white/40">@{p.username}</p>}
                      </div>
                      {isSelected && (
                        <FaCheck style={{ color: VELT_ACCENT }} />
                      )}
                    </button>
                  );
                })}
                {partnerSearch && partnerResults.length === 0 && (
                  <p className="text-center text-white/40 py-4">No users found</p>
                )}
              </div>
              <div className="p-4 border-t border-white/10 flex justify-end">
                <button
                  onClick={() => setPartnerSheetOpen(false)}
                  className="px-6 py-2 rounded-full font-semibold"
                  style={{ backgroundColor: VELT_ACCENT, color: "#000" }}
                >
                  Done
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Upload Progress Overlay */}
      <AnimatePresence>
        {uploading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/90 z-50 flex flex-col items-center justify-center gap-4"
          >
            <div className="relative w-24 h-24">
              <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                <circle
                  cx="50"
                  cy="50"
                  r="45"
                  fill="none"
                  stroke="rgba(255,255,255,0.1)"
                  strokeWidth="8"
                />
                <circle
                  cx="50"
                  cy="50"
                  r="45"
                  fill="none"
                  stroke={VELT_ACCENT}
                  strokeWidth="8"
                  strokeLinecap="round"
                  strokeDasharray={`${uploadProgress * 2.83} 283`}
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-xl font-bold">{uploadProgress}%</span>
              </div>
            </div>
            <p className="text-white/60">Uploading your story...</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
