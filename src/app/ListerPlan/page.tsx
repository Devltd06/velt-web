// src/app/ListerPlan/page.tsx
"use client";

import React, { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

function clientLog(msg: string) {
  console.log("[ListerPlan]", msg);
  if (typeof window !== "undefined") {
    if (!(window as any).__listerLogs) (window as any).__listerLogs = [];
    (window as any).__listerLogs.push(`${new Date().toISOString()} ${msg}`);
  }
}

export default function ListerPlanSinglePage() {
  const [user, setUser] = useState<any | null>(null);
  const [profile, setProfile] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [scriptLoaded, setScriptLoaded] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [paidInfo, setPaidInfo] = useState<any | null>(null);
  const PRICE_GHS = 50;

  useEffect(() => {
    (async () => {
      setLoading(true);
      clientLog("loading user");
      try {
        const { data } = await supabase.auth.getUser();
        const cur = data?.user ?? null;
        if (!cur) {
          clientLog("no user signed in");
          setStatus("Please sign in on the website first.");
          setLoading(false);
          return;
        }
        setUser(cur);
        const { data: prof } = await supabase
          .from("profiles")
          .select("full_name,email")
          .eq("id", cur.id)
          .maybeSingle();
        setProfile(prof || { full_name: "", email: cur.email });
        clientLog("profile loaded");
      } catch (err) {
        clientLog("error loading user/profile: " + String(err));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // load Paystack inline script
  useEffect(() => {
    if (typeof window === "undefined") return;
    if ((window as any).PaystackPop) {
      clientLog("PaystackPop already loaded");
      setScriptLoaded(true);
      return;
    }
    const s = document.createElement("script");
    s.src = "https://js.paystack.co/v1/inline.js";
    s.async = true;
    s.onload = () => {
      clientLog("Paystack script loaded");
      setScriptLoaded(true);
    };
    s.onerror = () => {
      clientLog("Failed to load Paystack script");
      setScriptLoaded(false);
    };
    document.body.appendChild(s);
    clientLog("Inserted Paystack script tag");
    return () => {
      try {
        if (s.parentNode) s.parentNode.removeChild(s);
      } catch {}
    };
  }, []);

  const handlePay = async () => {
    if (!user) {
      setStatus("Sign in required.");
      return;
    }
    setProcessing(true);
    setStatus("Opening checkout...");

    const PK = process.env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY || "";
    if (!PK || !PK.startsWith("pk_")) {
      setStatus("Paystack public key missing or invalid.");
      setProcessing(false);
      alert("NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY must be set (pk_...)");
      return;
    }

    if (!scriptLoaded || !(window as any).PaystackPop) {
      setStatus("Payment system still loading. Try again in a second.");
      setProcessing(false);
      return;
    }

    const amountPesewas = Math.round(PRICE_GHS * 100);
    const reference = `VELT-LISTER-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;

    const handler = (window as any).PaystackPop.setup({
      key: PK,
      email: profile?.email || user?.email || "",
      amount: amountPesewas,
      currency: "GHS",
      ref: reference,
      metadata: {
        velt: {
          userId: user.id,
          fullName: profile?.full_name || "",
          email: profile?.email || user?.email || "",
          plan: "publisher_monthly",
        },
      },
      callback: async (resp: any) => {
        clientLog("Paystack callback: " + JSON.stringify(resp));
        setStatus("Payment complete — verifying...");
        try {
          const res = await fetch("/api/lister/verify", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ reference: resp.reference }),
          });
          const json = await res.json().catch(() => null);
          clientLog("/api/lister/verify result: " + JSON.stringify(json));
          if (res.ok && json?.paid) {
            setStatus("Payment verified. Subscription active.");
            setPaidInfo(json);
          } else {
            setStatus("Payment verification failed. Contact support.");
            setPaidInfo(json);
          }
        } catch (err) {
          clientLog("verify call error: " + String(err));
          setStatus("Server verification error.");
        }
      },
      onClose: () => {
        clientLog("Paystack closed by user");
        setStatus("Checkout closed.");
      },
    });

    try {
      handler.openIframe();
      clientLog("opened iframe");
    } catch (err) {
      clientLog("openIframe error: " + String(err));
      setStatus("Could not open checkout.");
    } finally {
      setProcessing(false);
    }
  };

  if (loading) return <div className="p-8">Loading…</div>;

  return (
    <div className="min-h-screen p-8 bg-white text-slate-900">
      <div className="max-w-xl mx-auto space-y-6">
        <div className="p-6 border rounded">
          <h2 className="text-xl font-bold">Lister Plan</h2>
          <p className="text-sm text-slate-600">One payment (GHS {PRICE_GHS}) to enable listing (stays/cars/taxis).</p>

          <div className="mt-4">
            <div className="text-xs text-slate-500">Account</div>
            <div className="font-semibold">{profile?.full_name || "—"}</div>
            <div className="text-sm text-slate-600">{profile?.email}</div>
          </div>

          <div className="mt-4">
            <div className="text-xs text-slate-500">Price</div>
            <div className="text-lg font-semibold">GHS {PRICE_GHS.toFixed(2)}</div>
          </div>

          <button
            type="button"
            onClick={handlePay}
            disabled={processing}
            className={`mt-4 px-6 py-3 rounded text-white ${processing ? "bg-blue-400" : "bg-blue-600 hover:bg-blue-700"}`}
          >
            {processing ? "Processing..." : `Pay GHS ${PRICE_GHS}`}
          </button>

          {status && <div className="mt-3 text-sm text-slate-600">{status}</div>}
          {paidInfo && (
            <pre className="mt-3 p-3 bg-gray-50 text-xs rounded">{JSON.stringify(paidInfo, null, 2)}</pre>
          )}
        </div>

        <div className="p-4 bg-gray-50 rounded">
          <div className="font-semibold mb-2">Client logs</div>
          <div style={{ fontFamily: "monospace", fontSize: 12 }}>
            {((typeof window !== "undefined" && (window as any).__listerLogs) || []).slice(-20).map((l: any, i: number) => (
              <div key={i} className="mb-1">{l}</div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}




