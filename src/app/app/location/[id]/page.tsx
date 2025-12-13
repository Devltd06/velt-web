"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";

const VELT_ACCENT = "#D4AF37";

export default function LocationPostPage({ params }: { params: { id: string } }) {
  const { id } = params;
  const router = useRouter();
  const [post, setPost] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPost = async () => {
      const { data, error } = await supabase
        .from("location_posts")
        .select("*")
        .eq("id", id)
        .single();
      if (!error && data) setPost(data);
      setLoading(false);
    };
    fetchPost();
  }, [id]);

  if (loading) return <div className="min-h-screen bg-black text-white flex items-center justify-center">Loading...</div>;
  if (!post) return <div className="min-h-screen bg-black text-white flex items-center justify-center">Post not found</div>;

  return (
    <div className="min-h-screen bg-black text-white p-6">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold mb-4">{post.place}</h1>
        {post.images?.length > 0 && (
          <img src={post.images[0]} alt={post.place} className="w-full h-96 object-cover rounded-lg mb-4" />
        )}
        {post.caption && <p className="text-white/80 mb-4">{post.caption}</p>}
        <div className="flex items-center gap-3 text-white/60">
          <Link href={`/app/profile/${post.user_id}`}>View Author</Link>
        </div>
      </div>
    </div>
  );
}
