// src/app/ListerPlan/page.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

/**
 * Single-page ListerPlan:
 * - Loads current user & profile from supabase client
 * - Loads Paystack inline script (injects if missing)
 * - Opens Paystack inline for fixed GHS 50
 * - On callback -> POST /api/lister/verify { reference }
 * - Shows verification result on the same page and logs debug info
 */

export default function ListerPlanPage() {
  const router = useRouter();
  const [user, setUser] = useState<any | null>(null);
  const [profile, setProfile] = useState<any | null>(null);
  const [scriptLoaded, setScriptLoaded] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [processing, setProcessing] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [paidInfo, setPaidInfo] = useState<any | null>(null);

  const PRICE_GHS = 50;

  const appendLog = (m: any) => {
    const s =
      typeof m === "string"
        ? m
        : m instanceof Error
        ? `${m.message}\n${m.stack}`
        : JSON.stringify(m, null, 2);
    const line = `[${new Date().toISOString()}] ${s}`;
    setLogs((p) => [...p, line].slice(-80));
    // also console
    // eslint-disable-next-line no-console
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

  // load Paystack inline script (same as your debug file)
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

  const PAYSTACK_PUBLIC_KEY = process.env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY || "";

  const amountInPesewas = useMemo(() => Math.round(PRICE_GHS * 100), [PRICE_GHS]);
  const reference = useMemo(() => `VELT-LISTER-${Date.now()}-${Math.floor(Math.random() * 1e6)}`, []);

  const validateKey = (k: string) => (!k ? "missing" : k.startsWith("pk_") ? "ok" : "not-pk");

  const handlePay = async () => {
    setPaidInfo(null);
    appendLog("handlePay clicked");
    setProcessing(true);
    setStatus("Starting payment...");

    const keyStatus = validateKey(PAYSTACK_PUBLIC_KEY);
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

    // Setup Paystack
    appendLog({ reference, amountInPesewas, email: profile?.email || user?.email });
    let handler;
    try {
      handler = (window as any).PaystackPop.setup({
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
        callback: async (resp: any) => {
          appendLog("Paystack callback success: " + JSON.stringify(resp));
          setStatus("Payment complete — verifying on server...");
          try {
            const res = await fetch("/api/lister/verify", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ reference: resp.reference }),
            });
            appendLog("/api/lister/verify status: " + res.status);
            const json = await res.json().catch(() => null);
            appendLog({ apiResp: json });
            if (res.ok && json?.paid) {
              setStatus("Payment verified — subscription active.");
              setPaidInfo(json);
            } else {
              setStatus("Verification failed — check server logs.");
              setPaidInfo(json);
            }
          } catch (e) {
            appendLog("API verify error: " + String(e));
            setStatus("Verification error — see console.");
          }
        },
        onClose: () => {
          appendLog("Paystack onClose called by user (checkout closed).");
          setStatus("Checkout closed.");
        },
      });
    } catch (err) {
      appendLog("Paystack setup threw: " + String(err));
      setStatus("Payment setup error (see console).");
      setProcessing(false);
      return;
    }

    try {
      appendLog("Opening Paystack iframe...");
      handler.openIframe();

      // Attempt to force overlay visible if CSS hides it (same tactic as your debug file)
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
    } catch (err) {
      appendLog("openIframe error: " + String(err));
      setStatus("Could not open checkout (see console).");
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="min-h-screen flex items-start justify-center bg-gray-900 text-white p-8">
      <div className="max-w-2xl w-full space-y-6">
        <div className="bg-gray-800 rounded p-6">
          <h2 className="text-2xl font-bold mb-2">Confirm Payment</h2>
          <p className="text-gray-300 mb-4">One-time monthly payment to enable listing (stays, cars, taxis)</p>

          <div className="text-gray-300 mb-2">Name: <span className="font-semibold text-white">{profile?.full_name || "—"}</span></div>
          <div className="text-gray-300 mb-3">Email: <span className="font-semibold text-white">{profile?.email || "—"}</span></div>

          <div className="text-gray-300 mb-6">Price: <span className="text-xl font-semibold">GHS {PRICE_GHS.toFixed(2)}</span></div>

          <button onClick={handlePay} className={`bg-blue-600 px-6 py-3 rounded font-semibold ${processing ? "opacity-70" : "hover:bg-blue-700"}`} disabled={processing}>
            {processing ? "Processing..." : `Pay GHS ${PRICE_GHS.toFixed(2)}`}
          </button>

          <p className="text-xs text-gray-400 mt-4">After payment your subscription will be activated automatically. Return to the app and refresh Explore if needed.</p>
        </div>

        <div className="bg-black/40 p-4 rounded">
          <h3 className="font-semibold mb-2">Debug logs (latest)</h3>
          <div style={{ maxHeight: 280, overflow: "auto", fontSize: 12, whiteSpace: "pre-wrap" }}>
            {logs.length === 0 ? <div className="text-gray-400">No logs yet — click Pay to start.</div> : logs.map((l, i) => <div key={i} className="mb-1">{l}</div>)}
          </div>
        </div>

        {paidInfo && (
          <div className={`p-3 rounded ${paidInfo.paid ? "bg-green-50 border border-green-100 text-green-800" : "bg-red-50 border border-red-100 text-red-800"}`}>
            <div className="font-semibold mb-2">{paidInfo.paid ? "Payment successful" : "Payment not verified"}</div>
            <pre style={{ fontSize: 12, whiteSpace: "pre-wrap" }}>{JSON.stringify(paidInfo.raw ?? paidInfo, null, 2)}</pre>
          </div>
        )}
      </div>
    </div>
  );
}




