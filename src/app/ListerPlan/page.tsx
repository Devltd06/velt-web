// src/app/ListerPlan/page.tsx
"use client";

import React, { JSX, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

declare global {
  interface Window {
    PaystackPop?: any;
    __velt_paystack_callback_named?: (resp: any) => void;
    __velt_paystack_onclose_named?: () => void;
    // alias
    callback?: (resp: any) => void;
    onClose?: () => void;
  }
}

const PRICE_GHS = 50;

export default function ListerPlanPage(): JSX.Element {
  const router = useRouter();
  const [profile, setProfile] = useState<{ full_name?: string | null; email?: string | null } | null>(null);
  const [scriptLoaded, setScriptLoaded] = useState(false);
  const [processing, setProcessing] = useState(false);

  const PAYSTACK_PUBLIC_KEY = process.env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY ?? "";

  // load user profile
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

  // load Paystack script
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
  const reference = useMemo(() => "VELT-LISTER-" + Date.now().toString() + "-" + Math.floor(Math.random() * 1e6).toString(), []);

  // keep the heavy DOM tweaks in a helper
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

  // inner async handler (not the global) — performs server notify
  const handlePayCallbackInner = async (resp: any) => {
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
        alert("Payment recorded. You can now publish listings 🎉");
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

  // create named global functions BEFORE calling Paystack.setup
  const ensureGlobalCallbacks = () => {
    // If global named function doesn't exist, create it as a synchronous named function
    if (typeof window.__velt_paystack_callback_named !== "function") {
      // named non-async function wrapper that calls the async inner handler
      // important: function is function declaration assigned to window (not arrow, not async)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window as any).__velt_paystack_callback_named = function (resp: any) {
        // call async inner but don't make this function async
        void handlePayCallbackInner(resp);
      };
      // alias for older expectations (some Paystack variants)
      window.callback = (window as any).__velt_paystack_callback_named;
    }

    if (typeof window.__velt_paystack_onclose_named !== "function") {
      (window as any).__velt_paystack_onclose_named = function () {
        console.log("Paystack checkout closed (global onclose)");
      };
      window.onClose = (window as any).__velt_paystack_onclose_named;
    }
  };

  const handlePay = async () => {
    if (!PAYSTACK_PUBLIC_KEY || !PAYSTACK_PUBLIC_KEY.startsWith("pk_")) {
      alert("Missing/invalid NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY. Use your Paystack publishable key (pk_...)");
      return;
    }
    if (typeof window === "undefined" || !window.PaystackPop) {
      alert("Payment system still loading. Try again in a moment.");
      return;
    }

    setProcessing(true);

    try {
      // ensure global named callbacks exist BEFORE setup
      ensureGlobalCallbacks();

      // confirm the global callback is a plain function
      if (typeof window.__velt_paystack_callback_named !== "function") {
        throw new Error("Global callback is not a function");
      }

      // Setup using the global named functions (not inline)
      const handler = window.PaystackPop.setup({
        key: PAYSTACK_PUBLIC_KEY,
        email: profile?.email ?? "",
        amount: amountInPesewas,
        currency: "GHS",
        ref: reference,
        metadata: { velt: { plan: "publisher_monthly" } },
        callback: window.__velt_paystack_callback_named,
        onClose: window.__velt_paystack_onclose_named,
      });

      // open and adjust presentation
      handler.openIframe();
      adjustIframePresentation();

      // clean up after a bit (leave callback long enough for Paystack to call it)
      setTimeout(() => {
        try {
          // keep callback for a short while longer, then remove
          setTimeout(() => {
            try {
              if ((window as any).__velt_paystack_callback_named) {
                try {
                  delete (window as any).__velt_paystack_callback_named;
                } catch {}
              }
              if ((window as any).__velt_paystack_onclose_named) {
                try {
                  delete (window as any).__velt_paystack_onclose_named;
                } catch {}
              }
              // remove aliases
              try {
                delete (window as any).callback;
                delete (window as any).onClose;
              } catch {}
            } catch {}
          }, 3000);
        } catch {}
      }, 500);
    } catch (err) {
      console.error("Paystack setup/open error:", err);
      alert("Could not open Paystack checkout. See console for details.");
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div style={{ minHeight: "100vh", background: "#ffffff", color: "#05233c", padding: 28, fontFamily: "system-ui, Arial, sans-serif" }}>
      <div style={{ maxWidth: 980, margin: "0 auto" }}>
        <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h1 style={{ margin: 0, fontSize: 28 }}>Lister Plan</h1>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 12, color: "#6b7280" }}>Monthly</div>
            <div style={{ fontWeight: 800, color: "#0b61d6" }}>GHS {PRICE_GHS.toFixed(2)}</div>
          </div>
        </header>

        <section style={{ marginTop: 18, border: "1px solid #e6eef3", padding: 16, borderRadius: 10, background: "#f8fbff" }}>
          <div style={{ display: "flex", gap: 24, alignItems: "center" }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12, color: "#64748b", marginBottom: 6 }}>Name</div>
              <div style={{ fontWeight: 700 }}>{profile?.full_name ?? "—"}</div>
            </div>

            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12, color: "#64748b", marginBottom: 6 }}>Email</div>
              <div style={{ fontWeight: 700 }}>{profile?.email ?? "—"}</div>
            </div>

            <div>
              <button
                onClick={handlePay}
                disabled={processing}
                style={{
                  background: processing ? "#93c5fd" : "#0b61d6",
                  color: "#fff",
                  padding: "12px 18px",
                  borderRadius: 10,
                  border: "none",
                  cursor: processing ? "not-allowed" : "pointer",
                  fontWeight: 800,
                }}
              >
                {processing ? "Processing..." : "Pay GHS " + PRICE_GHS.toFixed(2)}
              </button>
            </div>
          </div>
          <div style={{ marginTop: 12, fontSize: 13, color: "#475569" }}>Single subscription — after paying you can publish stays, cars or taxis.</div>
        </section>
      </div>
    </div>
  );
}







