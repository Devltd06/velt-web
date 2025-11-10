// src/app/ListerPlan/page.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

/**
 * ListerPlan client page
 * - Uses window.location search to read the `data` param in a useEffect (safe for client)
 * - Avoids useSearchParams() to prevent the CSR-bailout / Suspense requirement
 */

export default function ListerPlanPage() {
  const router = useRouter();
  const [payData, setPayData] = useState<any>(null);
  const [scriptLoaded, setScriptLoaded] = useState(false);

  // parse payload from query string (client-only, inside useEffect)
  useEffect(() => {
    try {
      if (typeof window === "undefined") return;
      const params = new URLSearchParams(window.location.search);
      const dataParam = params.get("data");
      if (!dataParam) return;
      const parsed = JSON.parse(decodeURIComponent(dataParam));
      setPayData(parsed);
    } catch (e) {
      console.error("Failed to parse ListerPlan data param:", e);
      setPayData(null);
    }
  }, []);

  // lazy-load Paystack inline script on client
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

  const PAYSTACK_PUBLIC_KEY = process.env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY || "";

  const priceGHS = Number(payData?.priceGHS ?? 50);
  const amountInPesewas = useMemo(() => Math.round(priceGHS * 100), [priceGHS]);
  const reference = useMemo(() => `VELT-LISTER-${Date.now()}-${Math.floor(Math.random() * 1e6)}`, []);

  const { email, username, fullName, invoiceId, returnDeepLink } = payData || {};

  const handlePay = () => {
    if (typeof window === "undefined") {
      alert("Payment must be initiated in a browser environment.");
      return;
    }

    if (!scriptLoaded || !(window as any).PaystackPop) {
      alert("Payment system still loading. Please wait a second and try again.");
      return;
    }

    const handler = (window as any).PaystackPop.setup({
      key: PAYSTACK_PUBLIC_KEY,
      email,
      amount: amountInPesewas,
      currency: "GHS",
      ref: reference,
      metadata: {
        plan: "publisher_monthly",
        invoiceId,
        email,
        username,
        fullName,
        returnDeepLink,
      },
      callback: async (resp: any) => {
        try {
          const res = await fetch("/api/verify", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ reference: resp.reference }),
          });
          const json = await res.json().catch(() => null);
          const paid = json?.paid ?? false;
          const deep = (json?.data?.metadata?.returnDeepLink) || returnDeepLink || "";
          const status = paid ? "paid" : "unknown";

          if (deep) {
            const appUrl = `${deep}${deep.includes("?") ? "&" : "?"}status=${encodeURIComponent(status)}&invoiceId=${encodeURIComponent(invoiceId || "")}&reference=${encodeURIComponent(resp.reference)}`;
            window.location.href = appUrl;
            return;
          } else {
            router.push("/ListerPlan/success");
            return;
          }
        } catch (err) {
          console.error("Error verifying payment:", err);
          alert("Verification failed — return to the app and refresh.");
        }
      },
      onClose: () => {
        /* user closed checkout */
      },
    });

    try {
      handler.openIframe();
    } catch (err) {
      console.error("Error opening Paystack iframe:", err);
      alert("Could not open payment window.");
    }
  };

  if (!payData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900 text-white">
        <div className="text-center p-6">
          <h1 className="text-2xl font-bold mb-2">Lister Plan</h1>
          <p className="text-sm text-gray-300">Open this page through the app to pay for the Lister plan.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-900 text-white">
      <div className="bg-gray-800 p-8 rounded-md text-center w-full max-w-md">
        <h1 className="text-3xl font-bold mb-2">Lister Plan</h1>
        <p className="text-gray-300 mb-4">Monthly subscription to publish listings</p>
        <p className="text-2xl font-semibold mb-2">GHS {priceGHS.toFixed(2)}</p>
        <p className="text-gray-400 mb-6">for {email}</p>
        <button onClick={handlePay} className="bg-blue-600 w-full py-3 mt-2 rounded font-semibold">
          Pay with Paystack
        </button>
        <p className="text-xs text-gray-500 mt-4">Powered by Velt & Paystack</p>
      </div>
    </div>
  );
}
