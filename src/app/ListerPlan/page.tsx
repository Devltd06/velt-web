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
  const [paidInfo, setPaidInfo] = useState<any | null>(null); // holds verification result
  const [logs, setLogs] = useState<string[]>([]);

  // Append to on-screen logs + console
  const addLog = (m: string) => {
    clientLog(m);
    setLogs((s) => [...s, `${new Date().toISOString()} ${m}`].slice(-40));
  };

  useEffect(() => {
    (async () => {
      setLoading(true);
      addLog("loading user");
      try {
        const { data } = await supabase.auth.getUser();
        const cur = data?.user ?? null;
        if (!cur) {
          addLog("no user signed in");
          setStatus("Not signed in. Please sign in on the site first.");
          setLoading(false);
          return;
        }
        setUser(cur);
        addLog("user loaded: " + cur.id);

        const { data: prof } = await supabase
          .from("profiles")
          .select("full_name,email")
          .eq("id", cur.id)
          .maybeSingle();

        setProfile(prof || { full_name: "", email: cur.email });
        addLog("profile loaded");
      } catch (err) {
        addLog("error loading user/profile: " + String(err));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // load Paystack inline script once
  useEffect(() => {
    if (typeof window === "undefined") return;
    if ((window as any).PaystackPop) {
      addLog("PaystackPop already present");
      setScriptLoaded(true);
      return;
    }
    const s = document.createElement("script");
    s.src = "https://js.paystack.co/v1/inline.js";
    s.async = true;
    s.onload = () => {
      addLog("Paystack script loaded");
      setScriptLoaded(true);
    };
    s.onerror = () => {
      addLog("Failed to load Paystack script");
      setScriptLoaded(false);
    };
    document.body.appendChild(s);
    addLog("Inserted Paystack script tag");
    return () => {
      try {
        if (s.parentNode) s.parentNode.removeChild(s);
      } catch {}
    };
  }, []);

  // Single page flow: create invoice -> open inline -> verify -> show result
  const handlePay = async () => {
    if (!user) {
      addLog("user missing; abort");
      setStatus("Please sign in first on the website.");
      return;
    }

    setProcessing(true);
    setStatus("Creating invoice...");

    // Validate public key quickly (client)
    const PK = process.env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY || "";
    if (!PK || !PK.startsWith("pk_")) {
      addLog("Missing or invalid NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY");
      setStatus("Configuration error: Paystack public key missing/invalid.");
      setProcessing(false);
      return;
    }

    try {
      // 1) Create pending invoice on server
      addLog("POST /api/lister/init");
      const initRes = await fetch("/api/lister/init", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id, plan: "publisher_monthly" }),
      });
      addLog("/api/lister/init status: " + initRes.status);
      if (!initRes.ok) {
        const txt = await initRes.text().catch(() => "no body");
        throw new Error("Invoice init failed: " + txt);
      }
      const initJson = await initRes.json();
      addLog("init json: " + JSON.stringify(initJson));
      const invoiceId = initJson?.invoiceId;
      const price = Number(initJson?.price ?? 50);
      const amount = Math.round(price * 100);
      if (!invoiceId) throw new Error("No invoiceId returned");

      // 2) Open Paystack inline
      if (!scriptLoaded || !(window as any).PaystackPop) {
        throw new Error("Paystack not ready");
      }
      setStatus("Opening Paystack checkout...");
      const ref = `VELT-LISTER-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
      addLog("Paystack setup ref=" + ref + " amount=" + amount);

      const handler = (window as any).PaystackPop.setup({
        key: PK,
        email: profile?.email || user?.email || "",
        amount,
        currency: "GHS",
        ref,
        metadata: { invoiceId, plan: "publisher_monthly", userId: user.id },
        callback: async (resp: any) => {
          addLog("Paystack callback received: " + JSON.stringify(resp));
          setStatus("Payment complete — verifying...");
          try {
            // 3) Verify server-side (required)
            addLog("POST /api/lister/verify");
            const verifyRes = await fetch("/api/lister/verify", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ reference: resp.reference, invoiceId }),
            });
            addLog("/api/lister/verify status: " + verifyRes.status);
            const vjson = await verifyRes.json().catch(() => null);
            addLog("/api/lister/verify body: " + JSON.stringify(vjson));
            if (verifyRes.ok && vjson?.paid) {
              setStatus("Payment verified — subscription active.");
              setPaidInfo({ paid: true, details: vjson });
            } else {
              setStatus("Verification failed. Check server logs.");
              setPaidInfo({ paid: false, details: vjson });
            }
          } catch (err) {
            addLog("Error verifying: " + String(err));
            setStatus("Verification error.");
            setPaidInfo({ paid: false, details: String(err) });
          }
        },
        onClose: () => {
          addLog("User closed Paystack checkout");
          setStatus("Checkout closed.");
        },
      });

      try {
        handler.openIframe();
        addLog("Paystack iframe opened");
      } catch (err) {
        addLog("openIframe error: " + String(err));
        throw err;
      }
    } catch (err: any) {
      addLog("Payment init error: " + String(err));
      setStatus("Payment initiation error: " + (err?.message ?? err));
    } finally {
      setProcessing(false);
    }
  };

  // UI
  if (loading) {
    return <div className="min-h-screen flex items-center justify-center p-6">Loading…</div>;
  }

  return (
    <div className="min-h-screen flex items-start justify-center bg-white text-slate-900 p-8">
      <div className="max-w-2xl w-full space-y-6">
        <div className="p-6 border rounded shadow">
          <h2 className="text-xl font-bold mb-2">Lister Plan — single page flow</h2>
          <p className="mb-2 text-sm text-slate-600">Make one payment to enable listing features (stays, cars, taxis).</p>

          <div className="mb-3">
            <div className="text-xs text-slate-500">Account</div>
            <div className="font-semibold">{profile?.full_name || "—"}</div>
            <div className="text-sm text-slate-600">{profile?.email}</div>
          </div>

          <div className="mb-3">
            <div className="text-xs text-slate-500">Price</div>
            <div className="text-lg font-semibold">GHS 50.00 / month (default)</div>
          </div>

          <button
            onClick={handlePay}
            disabled={processing}
            className={`px-6 py-3 rounded text-white ${processing ? "bg-blue-400" : "bg-blue-600 hover:bg-blue-700"}`}
            type="button"
          >
            {processing ? "Processing..." : "Pay with Paystack"}
          </button>

          {status && <div className="mt-3 text-sm text-slate-600">{status}</div>}

          {paidInfo && (
            <div className={`mt-4 p-3 rounded ${paidInfo.paid ? "bg-green-50 border border-green-100" : "bg-red-50 border border-red-100"}`}>
              <div className="font-semibold">{paidInfo.paid ? "Payment successful" : "Payment not verified"}</div>
              <pre style={{ whiteSpace: "pre-wrap", fontSize: 12 }}>{JSON.stringify(paidInfo.details, null, 2)}</pre>
            </div>
          )}
        </div>

        <div className="p-4 border rounded bg-gray-50">
          <h3 className="font-semibold mb-2">Client logs (latest)</h3>
          <div style={{ maxHeight: 240, overflow: "auto", fontFamily: "monospace", fontSize: 12 }}>
            {logs.length === 0 ? <div className="text-sm text-slate-500">No logs yet — click Pay to start.</div> : logs.map((l, i) => <div key={i} className="mb-1">{l}</div>)}
          </div>
        </div>
      </div>
    </div>
  );
}



