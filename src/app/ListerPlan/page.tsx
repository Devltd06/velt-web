// src/app/ListerPlan/page.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";

type Listing = { id: string; title?: string | null; listing_type?: string | null };

export default function ListerPlanPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [listings, setListings] = useState<Listing[]>([]);
  const [selectedListingId, setSelectedListingId] = useState<string | null>(null);
  const [mode, setMode] = useState<"account" | "listing">("account");
  const [processing, setProcessing] = useState(false);
  const [statusLabel, setStatusLabel] = useState<string | null>(null);

  // Fetch current user + subscription status
  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const {
          data: { user: curUser },
        } = await supabase.auth.getUser();
        if (!curUser) {
          router.push(`/loginlister?next=${encodeURIComponent("/lister-plan")}`);
          return;
        }
        setUser(curUser);

        // check publisher_subscriptions
        try {
          const { data: subs } = await supabase
            .from("publisher_subscriptions")
            .select("id,status,expires_at")
            .eq("user_id", curUser.id)
            .order("expires_at", { ascending: false })
            .limit(1);
          if (subs && subs.length) {
            const s = subs[0];
            const exp = s.expires_at ? new Date(s.expires_at) : null;
            if (s.status === "active" && exp && exp > new Date()) {
              setStatusLabel(`Active until ${exp.toDateString()}`);
            } else {
              setStatusLabel("No active subscription");
            }
          } else {
            // fallback: look for a recent paid invoice (30 days)
            const thirty = new Date(Date.now() - 1000 * 60 * 60 * 24 * 30).toISOString();
            const { data: invoices } = await supabase
              .from("invoices")
              .select("id,status,created_at")
              .eq("user_id", curUser.id)
              .eq("status", "paid")
              .gte("created_at", thirty)
              .order("created_at", { ascending: false })
              .limit(1);
            if (invoices && invoices.length) setStatusLabel("Active (recent payment)");
            else setStatusLabel("No active subscription");
          }
        } catch (e) {
          console.warn("subs check err", e);
          setStatusLabel("Unknown");
        }

        // fetch user's listings (cars, stays, taxis)
        try {
          const [carsRes, staysRes, taxisRes] = await Promise.all([
            supabase.from("cars").select("id,title").eq("owner_id", curUser.id).limit(200),
            supabase.from("stays").select("id,title").eq("owner_id", curUser.id).limit(200),
            supabase.from("taxis").select("id,title").eq("owner_id", curUser.id).limit(200),
          ]);
          const merged: Listing[] = [];
          if (carsRes.data) merged.push(...(carsRes.data as any).map((r: any) => ({ id: r.id, title: r.title, listing_type: "cars" })));
          if (staysRes.data) merged.push(...(staysRes.data as any).map((r: any) => ({ id: r.id, title: r.title, listing_type: "stays" })));
          if (taxisRes.data) merged.push(...(taxisRes.data as any).map((r: any) => ({ id: r.id, title: r.title, listing_type: "taxis" })));
          setListings(merged);
          if (merged.length) setSelectedListingId(merged[0].id);
        } catch (e) {
          console.warn("listings fetch err", e);
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [router]);

  const planPrice = 50; // fallback display price; server will authoritative price

  const startOrRenew = async () => {
    if (!user) {
      router.push(`/loginlister?next=${encodeURIComponent("/lister-plan")}`);
      return;
    }
    setProcessing(true);
    setStatusLabel("Creating invoice...");

    try {
      const payload = {
        userId: user.id,
        plan: "publisher_monthly",
        // if user chose listing mode attach listing
        listingId: mode === "listing" ? selectedListingId : null,
      };

      const res = await fetch("/api/lister/init", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const txt = await res.text().catch(() => "failed");
        throw new Error(txt || "Server error");
      }

      const json = await res.json();
      // expected { invoiceId, payUrl }
      if (json?.payUrl) {
        setStatusLabel("Opening payment page...");
        // open in new tab so user can return to app
        window.open(json.payUrl, "_blank");
        setStatusLabel("Payment page opened — complete payment on the website. Return to the app and refresh Explore.");
      } else {
        throw new Error("No payUrl returned");
      }
    } catch (err: any) {
      console.error("init err", err);
      setStatusLabel(`Error: ${err?.message || "Could not start payment"}`);
    } finally {
      setProcessing(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white text-slate-900">
        <div>Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-white text-slate-900 p-6">
      <div className="max-w-xl w-full bg-white border rounded-lg p-6 shadow">
        <h1 className="text-2xl font-bold mb-2">Lister Plan</h1>
        <p className="text-slate-600 mb-4">Start or renew your monthly Lister plan to create listings and use publisher features.</p>

        <div className="mb-4">
          <div className="text-sm text-slate-500">Current status</div>
          <div className="font-semibold">{statusLabel ?? "Unknown"}</div>
        </div>

        <div className="mb-4">
          <div className="flex gap-4 items-center">
            <label className="inline-flex items-center gap-2">
              <input type="radio" checked={mode === "account"} onChange={() => setMode("account")} />
              <span>Start for account (publisher subscription)</span>
            </label>

            <label className="inline-flex items-center gap-2">
              <input type="radio" checked={mode === "listing"} onChange={() => setMode("listing")} />
              <span>Start for a listing (tie payment to a car/stay/taxi)</span>
            </label>
          </div>
        </div>

        {mode === "listing" && (
          <div className="mb-4">
            <label className="block text-sm text-slate-600 mb-2">Select listing</label>
            {listings.length === 0 ? (
              <div className="text-sm text-slate-500">No listings found. Create a listing in the app first.</div>
            ) : (
              <select className="w-full border p-2 rounded" value={selectedListingId ?? ""} onChange={(e) => setSelectedListingId(e.target.value)}>
                {listings.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.title ?? `${l.listing_type ?? "listing"} • ${l.id}`}
                  </option>
                ))}
              </select>
            )}
          </div>
        )}

        <div className="mb-4">
          <div className="text-sm text-slate-500">Price</div>
          <div className="font-semibold text-lg">GHS {planPrice.toFixed(2)} / month</div>
        </div>

        <button disabled={processing} onClick={startOrRenew} className={`w-full py-3 rounded text-white ${processing ? "bg-blue-400" : "bg-blue-600 hover:bg-blue-700"}`}>
          {processing ? "Processing..." : "Start / Renew on website"}
        </button>

        <div className="mt-4 text-sm text-slate-500">{/* helpful note */}If you pay on the website we’ll update your subscription automatically — return to the app and refresh Explore to gain access.</div>

        {statusLabel && <div className="mt-4 text-xs text-slate-500">{statusLabel}</div>}
      </div>
    </div>
  );
}

