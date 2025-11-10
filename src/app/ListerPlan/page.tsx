// src/app/ListerPlan/page.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient"; // your browser supabase client

export default function ListerPlanPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [scriptLoaded, setScriptLoaded] = useState(false);

  // Fallback display price; server returns canonical price on init
  const fallbackPriceGHS = 50;

  // load signed-in user + profile
  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const { data } = await supabase.auth.getUser();
        const cur = data?.user ?? null;
        if (!cur) {
          router.push(`/loginlister?next=${encodeURIComponent("/lister-plan")}`);
          return;
        }
        setUser(cur);

        const { data: prof } = await supabase
          .from("profiles")
          .select("full_name,email")
          .eq("id", cur.id)
          .maybeSingle();

        setProfile(prof || { full_name: "", email: cur.email });
      } catch (e) {
        console.warn("load user/profile err", e);
      } finally {
        setLoading(false);
      }
    })();
  }, [router]);

  // load Paystack inline script (client-only)
  useEffect(() => {
    if (typeof window === "undefined") return;
    if ((window as any).PaystackPop) {
      setScriptLoaded(true);
      return;
    }
    const s = document.createElement("script");
    s.src = "https://js.paystack.co/v1/inline.js";
    s.async = true;
    s.onload = () => {
      console.info("Paystack script loaded");
      setScriptLoaded(true);
    };
    s.onerror = () => {
      console.error("Failed to load Paystack script");
      setScriptLoaded(false);
    };
    document.body.appendChild(s);
    return () => {
      try {
        if (s.parentNode) s.parentNode.removeChild(s);
      } catch {}
    };
  }, []);

  // create invoice (server) then open inline checkout
  const handlePay = async () => {
    if (!user) {
      router.push(`/loginlister?next=${encodeURIComponent("/lister-plan")}`);
      return;
    }
    setProcessing(true);
    setStatus("Creating invoice...");

    // guard Paystack key presence
    const PK = process.env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY || "";
    if (!PK) {
      setStatus("Configuration error: missing Paystack public key.");
      setProcessing(false);
      alert("Missing Paystack public key. Ask admin to set NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY.");
      return;
    }
    if (!PK.startsWith("pk_")) {
      setStatus("Configuration error: Paystack public key invalid (should start with pk_).");
      setProcessing(false);
      alert("Invalid Paystack public key (use publishable key pk_...).");
      return;
    }

    try {
      // call server to create pending invoice and get canonical price + invoiceId
      const initRes = await fetch("/api/lister/init", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id, plan: "publisher_monthly" }),
      });

      if (!initRes.ok) {
        const txt = await initRes.text().catch(() => "server error");
        throw new Error(txt || "Could not create invoice");
      }
      const initJson = await initRes.json();
      const invoiceId = initJson?.invoiceId;
      const priceGHS = Number(initJson?.price ?? fallbackPriceGHS);
      const amountPesewas = Math.round(priceGHS * 100);

      if (!invoiceId) throw new Error("Missing invoiceId from server");

      setStatus("Opening Paystack checkout...");

      // Inline checkout guard
      if (!scriptLoaded || !(window as any).PaystackPop) {
        throw new Error("Paystack checkout not ready. Wait and try again.");
      }

      const reference = `VELT-LISTER-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;

      const handler = (window as any).PaystackPop.setup({
        key: PK,
        email: profile?.email || user?.email || "",
        amount: amountPesewas,
        currency: "GHS",
        ref: reference,
        metadata: {
          invoiceId,
          plan: "publisher_monthly",
          userId: user.id,
        },
        callback: async (resp: any) => {
          // called after successful payment in checkout
          setStatus("Payment complete — verifying...");
          try {
            const verifyRes = await fetch("/api/lister/verify", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ reference: resp.reference, invoiceId }),
            });

            const vjson = await verifyRes.json().catch(() => null);
            if (verifyRes.ok && vjson?.paid) {
              setStatus("Payment verified — subscription active.");
              // redirect to success (or show UI)
              router.push("/lister-plan/success");
            } else {
              setStatus("Verification failed. Contact support.");
              console.error("verify failed", vjson);
              alert("Payment made but verification failed. Contact support.");
            }
          } catch (err) {
            console.error("verify err", err);
            setStatus("Verification error. Check logs.");
            alert("Verification error. Check console or contact support.");
          }
        },
        onClose: () => {
          setStatus("Checkout closed.");
        },
      });

      // open iframe
      try {
        handler.openIframe();
      } catch (err) {
        console.error("openIframe error", err);
        setStatus("Could not open payment window.");
        alert("Could not open payment window. Try again in a moment.");
      }
    } catch (err: any) {
      console.error("init+pay error", err);
      setStatus(err?.message || "Payment initiation failed");
      alert(err?.message || "Payment initiation failed");
    } finally {
      setProcessing(false);
    }
  };

  if (loading) {
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
          <div className="font-semibold">{profile?.full_name || "—"}</div>
          <div className="text-sm text-slate-600">{profile?.email}</div>
        </div>

        <div className="mb-4">
          <div className="text-xs text-slate-500">Price</div>
          <div className="text-xl font-semibold">GHS {fallbackPriceGHS.toFixed(2)} / month</div>
        </div>

        <button
          type="button"
          onClick={handlePay}
          disabled={processing}
          className={`w-full py-3 rounded text-white ${processing ? "bg-blue-400" : "bg-blue-600 hover:bg-blue-700"}`}
        >
          {processing ? "Processing..." : `Pay GHS ${fallbackPriceGHS.toFixed(2)}`}
        </button>

        {status && <div className="mt-4 text-sm text-slate-600">{status}</div>}
        <div className="mt-6 text-xs text-slate-400">
          After payment your subscription is activated automatically. Return to the app and refresh Explore if needed.
        </div>
      </div>
    </div>
  );
}



