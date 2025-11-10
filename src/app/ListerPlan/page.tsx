// src/app/ListerPlan/page.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

/**
 * ListerPlan (single-page, light theme)
 * - Uses a global window function for Paystack callback to avoid "Attribute callback must be a valid function"
 * - Fixed price GHS 50, shows user's full_name & email, verifies server-side by POST /api/lister/verify
 */

export default function ListerPlanPage() {
  const [user, setUser] = useState<any | null>(null);
  const [profile, setProfile] = useState<any | null>(null);
  const [scriptLoaded, setScriptLoaded] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [processing, setProcessing] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [paidInfo, setPaidInfo] = useState<any | null>(null);

  const PRICE_GHS = 50;
  const PAYSTACK_PUBLIC_KEY = process.env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY || "";

  const appendLog = (m: any) => {
    const s =
      typeof m === "string"
        ? m
        : m instanceof Error
        ? `${m.message}\n${m.stack}`
        : JSON.stringify(m, null, 2);
    const line = `[${new Date().toISOString()}] ${s}`;
    setLogs((p) => [...p, line].slice(-80));
    console.log("[ListerPlan]", s);
  };

  useEffect(() => {
    (async () => {
      appendLog("loading user from supabase client");
      try {
        const { data } = await supabase.auth.getUser();
        const cur = data?.user ?? null;
        if (!cur) {
          appendLog("no signed-in user");
          setStatus("Not signed in — sign in on the website first.");
          return;
        }
        setUser(cur);
        appendLog(`user loaded: ${cur.id}`);

        const { data: prof } = await supabase
          .from("profiles")
          .select("full_name,email")
          .eq("id", cur.id)
          .maybeSingle();
        setProfile(prof || { full_name: "", email: cur?.email || "" });
        appendLog("profile loaded");
      } catch (err) {
        appendLog("error loading user/profile: " + String(err));
        setStatus("Error loading profile — check console.");
      }
    })();
  }, []);

  // Load Paystack script
  useEffect(() => {
    if (typeof window === "undefined") return;
    if ((window as any).PaystackPop) {
      appendLog("PaystackPop already available");
      setScriptLoaded(true);
      return;
    }
    const s = document.createElement("script");
    s.src = "https://js.paystack.co/v1/inline.js";
    s.async = true;
    s.onload = () => {
      appendLog("Paystack script loaded (onload). window.PaystackPop? " + !!(window as any).PaystackPop);
      setScriptLoaded(true);
    };
    s.onerror = (e) => {
      appendLog("Paystack script failed to load: " + String(e));
      setScriptLoaded(false);
    };
    document.body.appendChild(s);
    appendLog("Inserted Paystack script tag.");
    return () => {
      try {
        if (s.parentNode) s.parentNode.removeChild(s);
      } catch {}
    };
  }, []);

  const amountInPesewas = useMemo(() => Math.round(PRICE_GHS * 100), [PRICE_GHS]);
  const reference = useMemo(() => `VELT-LISTER-${Date.now()}-${Math.floor(Math.random() * 1e6)}`, []);

  // Safe wrapper to call verify endpoint
  async function serverVerify(referenceStr: string) {
    try {
      const res = await fetch("/api/lister/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reference: referenceStr }),
      });
      const json = await res.json().catch(() => null);
      appendLog("/api/lister/verify status: " + res.status);
      appendLog({ apiResp: json });
      return { ok: res.ok, body: json };
    } catch (e) {
      appendLog("verify call error: " + String(e));
      return { ok: false, body: null };
    }
  }

  // Attach global handlers so Paystack receives a plain function reference
  useEffect(() => {
    // assign plain function to window for callback and onClose
    (window as any).__veltPayCallback = function (resp: any) {
      appendLog("Global callback invoked: " + JSON.stringify(resp));
      setStatus("Payment complete — verifying on server...");
      serverVerify(resp.reference).then((r) => {
        if (r.ok && r.body?.paid) {
          setStatus("Payment verified — subscription active.");
          setPaidInfo(r.body);
        } else {
          setStatus("Verification failed — check server logs.");
          setPaidInfo(r.body);
        }
      });
    };

    (window as any).__veltPayOnClose = function () {
      appendLog("Global onClose invoked (user closed checkout).");
      setStatus("Checkout closed by user.");
    };

    return () => {
      try {
        delete (window as any).__veltPayCallback;
        delete (window as any).__veltPayOnClose;
      } catch {}
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handlePay = async () => {
    setPaidInfo(null);
    appendLog("handlePay clicked");
    setProcessing(true);
    setStatus("Starting payment...");

    const keyStatus = !PAYSTACK_PUBLIC_KEY ? "missing" : PAYSTACK_PUBLIC_KEY.startsWith("pk_") ? "ok" : "not-pk";
    appendLog("keyStatus: " + keyStatus);
    if (keyStatus !== "ok") {
      const msg =
        keyStatus === "missing"
          ? "Paystack public key missing — set NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY (pk_...) and rebuild."
          : "Invalid key: looks like a secret key. Use publishable key (pk_...).";
      setStatus(msg);
      appendLog(msg);
      alert(msg);
      setProcessing(false);
      return;
    }

    if (!scriptLoaded || !(window as any).PaystackPop) {
      setStatus("Payment system loading or blocked. Check console/Network/CSP/adblock.");
      appendLog("PaystackPop missing even after script load.");
      setProcessing(false);
      return;
    }

    appendLog({ reference, amountInPesewas, email: profile?.email || user?.email });

    try {
      // PASS PLAIN function references (global) — Paystack expects callable attributes
      const handler = (window as any).PaystackPop.setup({
        key: PAYSTACK_PUBLIC_KEY,
        email: profile?.email || user?.email || "",
        amount: amountInPesewas,
        currency: "GHS",
        ref: reference,
        metadata: {
          velt: {
            userId: user?.id ?? null,
            fullName: profile?.full_name ?? "",
            email: profile?.email ?? user?.email ?? "",
            plan: "publisher_monthly",
          },
        },
        callback: (window as any).__veltPayCallback,
        onClose: (window as any).__veltPayOnClose,
      });

      appendLog("Opening Paystack iframe...");
      handler.openIframe();

      // try to force overlay visible if hidden
      setTimeout(() => {
        try {
          const iframes = Array.from(document.querySelectorAll("iframe"));
          const payIframe = iframes.find((f) => ((f as HTMLIFrameElement).src || "").includes("paystack"));
          if (payIframe) {
            (payIframe as HTMLElement).style.zIndex = "999999999";
            (payIframe as HTMLElement).style.opacity = "1";
            (payIframe as HTMLElement).style.display = "block";
            appendLog("Forced z-index/visibility on Paystack iframe.");
          }
        } catch (e) {
          appendLog("overlay force error: " + String(e));
        }
      }, 600);
    } catch (err: any) {
      appendLog("Paystack setup threw: " + String(err));
      setStatus("Payment setup error (see console).");
    } finally {
      setProcessing(false);
    }
  };

  // Light-theme UI
  return (
    <div className="min-h-screen bg-white text-slate-900 p-8">
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="p-6 border rounded-lg shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-slate-900">Lister Plan</h2>
              <p className="text-sm text-slate-600">One-time monthly payment to enable listing (stays, cars, taxis).</p>
            </div>
            <div className="text-right">
              <div className="text-xs text-slate-500">Price</div>
              <div className="text-lg font-semibold text-blue-700">GHS {PRICE_GHS.toFixed(2)}</div>
            </div>
          </div>

          <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <div className="text-xs text-slate-500">Name</div>
              <div className="font-semibold">{profile?.full_name || "—"}</div>
            </div>
            <div>
              <div className="text-xs text-slate-500">Email</div>
              <div className="font-semibold">{profile?.email || "—"}</div>
            </div>
          </div>

          <div className="mt-6">
            <button
              onClick={handlePay}
              disabled={processing}
              className={`px-6 py-3 rounded-md text-white ${processing ? "bg-blue-300" : "bg-blue-600 hover:bg-blue-700"}`}
            >
              {processing ? "Processing..." : `Pay GHS ${PRICE_GHS.toFixed(2)}`}
            </button>
            {status && <div className="mt-3 text-sm text-slate-600">{status}</div>}
            <p className="mt-4 text-xs text-slate-500">After payment your subscription will be activated automatically. Return to the app and refresh Explore if needed.</p>
          </div>
        </div>

        <div className="p-4 border rounded-lg bg-gray-50">
          <h3 className="font-semibold mb-2 text-slate-800">Debug logs (latest)</h3>
          <div style={{ maxHeight: 260, overflow: "auto", fontFamily: "monospace", fontSize: 13 }} className="text-slate-700">
            {logs.length === 0 ? <div className="text-slate-400">No logs yet — click Pay to start.</div> : logs.map((l, i) => <div key={i} className="mb-1">{l}</div>)}
          </div>
        </div>

        {paidInfo && (
          <div className="p-4 border rounded-lg">
            <div className="font-semibold mb-2">{paidInfo.paid ? "Payment successful" : "Payment not verified"}</div>
            <pre style={{ whiteSpace: "pre-wrap", fontSize: 12 }}>{JSON.stringify(paidInfo.raw ?? paidInfo, null, 2)}</pre>
          </div>
        )}
      </div>
    </div>
  );
}




