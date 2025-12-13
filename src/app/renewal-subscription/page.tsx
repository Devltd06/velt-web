"use client";

import React, { JSX, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { motion } from "framer-motion";
import Link from "next/link";

declare global {
  interface Window {
    PaystackPop?: {
      setup: (config: Record<string, unknown>) => void;
      openIframe: () => void;
    };
    __velt_paystack_callback_named?: (resp: Record<string, unknown>) => void;
    __velt_paystack_onclose_named?: () => void;
  }
}

const PRICE_GHS = 50;

export default function RenewalSubscriptionPage(): JSX.Element {
  const router = useRouter();
  const [profile, setProfile] = useState<{ full_name?: string | null; email?: string | null } | null>(null);
  const [scriptLoaded, setScriptLoaded] = useState(false);
  const [processing, setProcessing] = useState(false);

  const PAYSTACK_PUBLIC_KEY = process.env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY ?? "";

  useEffect(() => {
    (async () => {
      try {
        const { data } = await supabase.auth.getUser();
        const user = data?.user ?? null;
        if (!user) return;
        const { data: prof } = await supabase
          .from("profiles")
          .select("full_name,email")
          .eq("id", user.id)
          .maybeSingle();
        setProfile(prof ?? { full_name: user.user_metadata?.full_name ?? "", email: user.email ?? "" });
      } catch (e) {
        console.error("Failed to load profile:", e);
      }
    })();
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.PaystackPop) {
      setScriptLoaded(true);
      return;
    }
    const s = document.createElement("script");
    s.src = "https://js.paystack.co/v1/inline.js";
    s.async = true;
    s.onload = () => setScriptLoaded(true);
    s.onerror = () => setScriptLoaded(false);
    document.body.appendChild(s);
    return () => {
      try {
        s.parentNode?.removeChild(s);
      } catch {}
    };
  }, []);

  const amountInPesewas = useMemo(() => Math.round(PRICE_GHS * 100), []);
  const reference = useMemo(() => "VELT-RENEWAL-" + Date.now().toString() + "-" + Math.floor(Math.random() * 1e6).toString(), []);

  const adjustIframePresentation = () => {
    setTimeout(() => {
      try {
        const iframes = Array.from(document.getElementsByTagName("iframe"));
        const payIframe = iframes.find((f) => {
          try {
            return !!(f && f.src && f.src.includes("paystack"));
          } catch {
            return false;
          }
        }) as HTMLIFrameElement | undefined;

        if (payIframe) {
          payIframe.style.zIndex = "2147483647";
          payIframe.style.position = "fixed";
          payIframe.style.left = "0";
          payIframe.style.top = "0";
        }

        const divs = Array.from(document.getElementsByTagName("div"));
        for (const d of divs) {
          try {
            const rect = d.getBoundingClientRect();
            if (rect.width >= window.innerWidth - 2 && rect.height >= window.innerHeight - 2) {
              if (!(payIframe && d.contains(payIframe))) {
                (d as HTMLElement).style.pointerEvents = "none";
                (d as HTMLElement).style.background = "transparent";
              }
            }
          } catch {}
        }
      } catch (err) {
        console.warn("adjustIframePresentation error", err);
      }
    }, 120);
  };

  const handlePayCallbackInner = async (resp: Record<string, unknown>) => {
    try {
      const { data } = await supabase.auth.getUser();
      const userId = data?.user?.id ?? null;

      const payload = {
        reference: resp?.reference,
        userId,
        email: profile?.email ?? "",
        full_name: profile?.full_name ?? "",
        amount: PRICE_GHS,
      };

      const r = await fetch("/api/lister/markPaid", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (r.ok) {
        alert("Subscription renewed successfully. You can now upload billboard content 🎉");
        router.push("/");
      } else {
        const txt = await r.text().catch(() => "");
        console.warn("markPaid non-ok", r.status, txt);
        alert("Payment recorded but server returned an error. Check logs.");
        router.push("/");
      }
    } catch (err) {
      console.error("notify server error", err);
      alert("Payment succeeded but notifying server failed. Check logs.");
      router.push("/");
    }
  };

  const ensureGlobalCallbacks = () => {
    if (typeof window.__velt_paystack_callback_named !== "function") {
      (window as unknown as Record<string, unknown>).__velt_paystack_callback_named = function (resp: Record<string, unknown>) {
        handlePayCallbackInner(resp).catch(console.error);
      };
    }
    if (typeof window.__velt_paystack_onclose_named !== "function") {
      (window as unknown as Record<string, unknown>).__velt_paystack_onclose_named = function () {
        console.log("Paystack payment window closed");
      };
    }
  };

  const startPayment = () => {
    if (!scriptLoaded) {
      alert("Paystack is loading. Please try again.");
      return;
    }
    if (processing) {
      return;
    }

    setProcessing(true);
    ensureGlobalCallbacks();

    const emailVal = profile?.email || "";

    try {
      window.PaystackPop!.setup({
        key: PAYSTACK_PUBLIC_KEY,
        email: emailVal,
        amount: amountInPesewas,
        ref: reference,
        onClose: window.__velt_paystack_onclose_named!,
        callback: window.__velt_paystack_callback_named!,
      });
      window.PaystackPop!.openIframe();
      adjustIframePresentation();
    } catch (err) {
      console.error("startPayment error", err);
      alert("Error starting payment");
      setProcessing(false);
    }
  };

  return (
    <div className="min-h-screen bg-white text-black">
      <div className="max-w-4xl mx-auto px-6 md:px-12 py-20">
        <Link href="/" className="text-sm text-gray-600 hover:text-black mb-10 inline-block">
          ← Back Home
        </Link>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
          <h1 className="text-5xl md:text-6xl font-bold mb-6">Renew Your Subscription</h1>
          <p className="text-xl text-gray-600 mb-12">Continue uploading billboard content with an active subscription.</p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
          {/* PRICING CARD */}
          <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 }} className="p-8 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl border-2" style={{ borderColor: "#d4af37" }}>
            <h2 className="text-2xl font-bold mb-6">Subscription Renewal</h2>

            <div className="space-y-6 mb-8">
              <div className="flex items-center gap-4">
                <div className="text-3xl">✓</div>
                <div>
                  <div className="font-semibold">Unlimited Uploads</div>
                  <div className="text-sm text-gray-600">Upload as much billboard content as you need</div>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <div className="text-3xl">✓</div>
                <div>
                  <div className="font-semibold">Live Tracking</div>
                  <div className="text-sm text-gray-600">Real-time analytics and performance metrics</div>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <div className="text-3xl">✓</div>
                <div>
                  <div className="font-semibold">24/7 Support</div>
                  <div className="text-sm text-gray-600">Get help anytime you need it</div>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <div className="text-3xl">✓</div>
                <div>
                  <div className="font-semibold">Priority Placement</div>
                  <div className="text-sm text-gray-600">Your content gets featured placement</div>
                </div>
              </div>
            </div>

            <div className="p-6 bg-white rounded-lg border-l-4 mb-8" style={{ borderColor: "#d4af37" }}>
              <div className="text-sm text-gray-600">Monthly Renewal Cost</div>
              <div className="text-4xl font-bold mt-2">GHS {PRICE_GHS}</div>
              <div className="text-xs text-gray-600 mt-2">One-time monthly charge</div>
            </div>

            <motion.button
              onClick={startPayment}
              disabled={!scriptLoaded || processing}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="w-full py-4 rounded-lg font-bold text-lg disabled:opacity-50 transition"
              style={{ backgroundColor: "#d4af37", color: "#000000" }}
            >
              {processing ? "Processing..." : `Renew GHS ${PRICE_GHS}`}
            </motion.button>

            <div className="mt-4 text-xs text-gray-600 text-center">
              Powered by Paystack • Secure Payment
            </div>
          </motion.div>

          {/* INFO SECTION */}
          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 }} className="space-y-8">
            <div>
              <h3 className="text-2xl font-bold mb-4">Why Renew?</h3>
              <p className="text-gray-600 leading-relaxed mb-4">
                Keep your billboard content active and running. Your subscription ensures uninterrupted display across all billboard locations.
              </p>
              <p className="text-gray-600 leading-relaxed">
                Renew monthly to maintain your presence and reach audiences nationwide.
              </p>
            </div>

            <div className="space-y-4">
              <h4 className="font-bold text-lg">Subscription Benefits</h4>
              <ul className="space-y-3">
                <li className="flex gap-3 items-start">
                  <span style={{ color: "#d4af37" }}>●</span>
                  <span>Content stays live on all billboards</span>
                </li>
                <li className="flex gap-3 items-start">
                  <span style={{ color: "#d4af37" }}>●</span>
                  <span>Full access to dashboard and analytics</span>
                </li>
                <li className="flex gap-3 items-start">
                  <span style={{ color: "#d4af37" }}>●</span>
                  <span>Upload new content anytime</span>
                </li>
                <li className="flex gap-3 items-start">
                  <span style={{ color: "#d4af37" }}>●</span>
                  <span>Professional support team</span>
                </li>
              </ul>
            </div>

            <div className="p-6 bg-gray-50 rounded-lg border border-gray-200">
              <h4 className="font-bold mb-3">Need Help?</h4>
              <p className="text-sm text-gray-600 mb-4">
                Have questions about renewing your subscription?
              </p>
              <Link href="/support" className="text-sm font-semibold hover:opacity-80 transition" style={{ color: "#d4af37" }}>
                Contact Support →
              </Link>
            </div>
          </motion.div>
        </div>

        {/* USER INFO */}
        {profile && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }} className="mt-12 p-6 bg-gray-50 rounded-lg border border-gray-200">
            <div className="text-sm text-gray-600 mb-2">Renewing as:</div>
            <div className="font-bold text-lg">{profile.full_name || "User"}</div>
            <div className="text-sm text-gray-600">{profile.email}</div>
          </motion.div>
        )}
      </div>
    </div>
  );
}
