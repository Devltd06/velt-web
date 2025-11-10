// src/app/ListerPlan/page.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";

export default function ListerPlanPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [scriptLoaded, setScriptLoaded] = useState(false);

  // fixed plan fee (fallback). Server init will confirm canonical price.
  const planPriceGHS = 50;
  const amountPesewas = useMemo(() => Math.round(planPriceGHS * 100), [planPriceGHS]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const { data } = await supabase.auth.getUser();
        const cur = data?.user ?? null;
        if (!cur) {
          // redirect to Lister login
          router.push(`/loginlister?next=${encodeURIComponent("/lister-plan")}`);
          return;
        }
        setUser(cur);

        // fetch profile (full_name + email)
        const { data: prof } = await supabase.from("profiles").select("full_name,email").eq("id", cur.id).maybeSingle();
        setProfile(prof || { full_name: "", email: cur.email });
      } catch (e) {
        console.warn("load user/profile err", e);
      } finally {
        setLoading(false);
      }
    })();
  }, [router]);

  // lazy-load Paystack inline script
  useEffect(() => {
    if (typeof window === "undefined") return;
    if ((window as any).PaystackPop) {
      setScriptLoaded(true);
      return;
    }
    const s = document.createElement("script");
    s.src = "https://js.paystack.co/v1/inline.js";
    s.async = true;
    s.onload = () => setScriptLoaded(true);
    s.onerror = () => {
      setScriptLoaded(false);
      console.error("Paystack script failed to load");
    };
    document.body.appendChild(s);
    return () => {
      try {
        if (s.parentNode) s.parentNode.removeChild(s);
      } catch {}
    };
  }, []);

  // create invoice server-side then open Paystack inline with invoice metadata
  const handlePay = async () => {
    if (!user) {
      router.push(`/loginlister?next=${encodeURIComponent("/lister-plan")}`);
      return;
    }
    setProcessing(true);
    setStatus("Creating invoice...");

    try {
      const res = await fetch("/api/lister/init", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id, plan: "publisher_monthly" }),
      });

      if (!res.ok) {
        const txt = await res.text().catch(() => "server error");
        throw new Error(txt || "Could not create invoice");
      }

      const json = await res.json();
      const invoiceId = json?.invoiceId;
      const priceGHS = Number(json?.price ?? planPriceGHS);
      const amount = Math.round(priceGHS * 100);

      if (!invoiceId) throw new Error("No invoice created");

      setStatus("Opening payment window...");

      if (!scriptLoaded || !(window as any).PaystackPop) {
        throw new Error("Paystack checkout not ready; refresh and try again.");
      }

      const ref = `VELT-LISTER-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;

      const handler = (window as any).PaystackPop.setup({
        key: process.env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY || "",
        email: profile?.email || user?.email || "",
        amount,
        currency: "GHS",
        ref,
        metadata: {
          invoiceId,
          plan: "publisher_monthly",
          userId: user.id,
        },
        callback: async (resp: any) => {
          // resp.reference
          try {
            setStatus("Verifying payment...");
            const verifyRes = await fetch("/api/lister/verify", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ reference: resp.reference, invoiceId }),
            });
            const vjson = await verifyRes.json().catch(() => null);

            if (verifyRes.ok && vjson?.paid) {
              setStatus("Payment verified — subscription active.");
              // redirect to success or display confirmation
              router.push("/lister-plan/success");
            } else {
              setStatus("Verification failed — check your email or contact support.");
            }
          } catch (err) {
            console.error("verify err", err);
            setStatus("Verification error — please refresh the app.");
          }
        },
        onClose: () => {
          setStatus("Payment cancelled.");
        },
      });

      try {
        handler.openIframe();
      } catch (err) {
        console.error("open iframe err", err);
        setStatus("Could not open payment window.");
      }
    } catch (err: any) {
      console.error("init+pay err", err);
      setStatus(err?.message || "Payment initiation failed");
    } finally {
      setProcessing(false);
    }
  };

  if (loading || !profile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white text-slate-900">
        <div>Loading…</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-white text-slate-900 p-6">
      <div className="max-w-md w-full border rounded-lg p-6 shadow">
        <h1 className="text-2xl font-bold mb-2">Lister Plan</h1>
        <p className="text-slate-600 mb-4">One monthly payment to become a Lister and publish stays, cars or taxis.</p>

        <div className="mb-4">
          <div className="text-xs text-slate-500">Account</div>
          <div className="font-semibold">{profile.full_name || "—"}</div>
          <div className="text-sm text-slate-600">{profile.email}</div>
        </div>

        <div className="mb-4">
          <div className="text-xs text-slate-500">Price</div>
          <div className="text-xl font-semibold">GHS {planPriceGHS.toFixed(2)} / month</div>
        </div>

        <button
          onClick={handlePay}
          disabled={processing}
          className={`w-full py-3 rounded text-white ${processing ? "bg-blue-400" : "bg-blue-600 hover:bg-blue-700"}`}
        >
          {processing ? "Processing..." : `Pay GHS ${planPriceGHS.toFixed(2)}`}
        </button>

        {status && <div className="mt-4 text-sm text-slate-600">{status}</div>}
        <div className="mt-6 text-xs text-slate-400">
          After payment your subscription will be activated automatically. Return to the app and refresh Explore to gain Lister access.
        </div>
      </div>
    </div>
  );
}


