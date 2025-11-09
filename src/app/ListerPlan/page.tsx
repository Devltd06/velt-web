// src/app/ListerPlan/page.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";

export default function ListerPlanPage() {
  const router = useRouter();
  const search = useSearchParams();
  const dataParam = search.get("data");

  const [payData, setPayData] = useState<any>(null);
  const [scriptLoaded, setScriptLoaded] = useState(false);

  // Parse data passed from the mobile app
  useEffect(() => {
    if (!dataParam) return;
    try {
      const parsed = JSON.parse(decodeURIComponent(dataParam));
      setPayData(parsed);
    } catch (e) {
      console.error("Failed to parse data param", e);
    }
  }, [dataParam]);

  // Load Paystack script
  useEffect(() => {
    if ((window as any).PaystackPop) {
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
      if (s.parentNode) s.parentNode.removeChild(s);
    };
  }, []);

  const PAYSTACK_PUBLIC_KEY = process.env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY || "";

  // Data from app payload
  const priceGHS = Number(payData?.priceGHS ?? 50);
  const amountInPesewas = useMemo(() => Math.round(priceGHS * 100), [priceGHS]);
  const reference = useMemo(() => `VELT-LISTER-${Date.now()}-${Math.floor(Math.random() * 1e6)}`, []);

  const { email, username, fullName, invoiceId, returnDeepLink } = payData || {};

  const handlePay = () => {
    if (!scriptLoaded || !(window as any).PaystackPop) {
      alert("Paystack is still loading. Please wait a few seconds.");
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
          const json = await res.json();
          const paid = json?.paid ?? false;
          const deep = json?.data?.metadata?.returnDeepLink || returnDeepLink || "";
          const status = paid ? "paid" : "unknown";

          if (deep) {
            const appUrl = `${deep}?status=${status}&invoiceId=${invoiceId || ""}&reference=${resp.reference}`;
            window.location.href = appUrl;
          } else {
            router.push("/ListerPlan/success");
          }
        } catch (err) {
          console.error(err);
          alert("Verification failed. Please return to the app and refresh.");
        }
      },
      onClose: () => alert("Payment cancelled."),
    });

    handler.openIframe();
  };

  if (!payData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900 text-white">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-2">Missing payment details</h1>
          <p>Open this page through the Velt app.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-900 text-white">
      <div className="bg-gray-800 p-8 rounded-md text-center w-full max-w-md">
        <h1 className="text-3xl font-bold mb-2">Lister Plan</h1>
        <p className="text-gray-300 mb-4">Monthly Subscription (Publish Listings)</p>
        <p className="text-2xl font-semibold mb-2">GHS {priceGHS.toFixed(2)}</p>
        <p className="text-gray-400 mb-6">for {email}</p>
        <button onClick={handlePay} className="bg-blue-600 w-full py-3 rounded font-semibold">
          Pay with Paystack
        </button>
        <p className="text-xs text-gray-500 mt-4">Powered by Velt & Paystack</p>
      </div>
    </div>
  );
}
