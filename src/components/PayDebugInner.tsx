"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";

export default function PayDebugInner() {
  const router = useRouter();
  const search = useSearchParams();
  const dataParam = search.get("data");

  interface PayData {
    email: string;
    plan: string;
    role: string;
    priceUSD: number;
    priceGHS: number;
    username: string;
    fullName: string;
  }

  const [payData, setPayData] = useState<PayData | null>(null);
  const [scriptLoaded, setScriptLoaded] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);

  const addLog = (m: unknown) => {
    const s =
      typeof m === "string"
        ? m
        : m instanceof Error
        ? `${m.message}\n${m.stack}`
        : JSON.stringify(m, null, 2);
    setLogs((l) => [...l, `[${new Date().toISOString()}] ${s}`]);
    console.log("[PayDebug]", m);
  };

  // parse incoming data
  useEffect(() => {
    if (!dataParam) return;
    try {
      const parsed = JSON.parse(decodeURIComponent(dataParam));
      setPayData(parsed);
      addLog({ msg: "Parsed payData", parsed });
    } catch (e) {
      addLog(`Failed to parse dataParam: ${String(e)}`);
    }
  }, [dataParam]);

  // load Paystack script
  useEffect(() => {
    const s = document.createElement("script");
    s.src = "https://js.paystack.co/v1/inline.js";
    s.async = true;
    s.onload = () => {
      setScriptLoaded(true);
      addLog(
        "Paystack script loaded (onload). window.PaystackPop available? " +
          !!((window as unknown as { PaystackPop?: unknown }).PaystackPop)
      );
    };
    s.onerror = () => {
      setScriptLoaded(false);
      addLog("Failed to load Paystack script (onerror).");
    };
    document.body.appendChild(s);
    addLog("Inserted Paystack script tag.");
    return () => {
      if (s.parentNode) s.parentNode.removeChild(s);
      addLog("Removed Paystack script tag on cleanup.");
    };
  }, []);

  const PAYSTACK_PUBLIC_KEY =
    process.env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY || "";
  useEffect(() => {
    const masked = PAYSTACK_PUBLIC_KEY
      ? `${PAYSTACK_PUBLIC_KEY.slice(0, 8)}...${PAYSTACK_PUBLIC_KEY.slice(-6)}`
      : "<EMPTY>";
    addLog("NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY (masked): " + masked);
  }, [PAYSTACK_PUBLIC_KEY]);

  const priceGHS = Number(payData?.priceGHS ?? 0);
  const amountInPesewas = useMemo(
    () => Math.round(priceGHS * 100),
    [priceGHS]
  );
  const reference = useMemo(
    () => `ATMOSDEV-${Date.now()}-${Math.floor(Math.random() * 1e6)}`,
    []
  );

  if (!payData) {
    return (
      <div className="min-h-screen flex items-start justify-center bg-white text-black p-8">
        <div className="max-w-2xl w-full">
          <h2 className="text-2xl font-bold mb-4">Missing Payment Details</h2>
          <p className="mb-4 text-gray-700">
            This page requires payment data from the subscription page. Go back and choose a plan.
          </p>
          <button
            onClick={() => router.back()}
            className="px-4 py-2 rounded font-semibold text-black"
            style={{ backgroundColor: "#d4af37" }}
          >
            Go Back
          </button>

          <div className="mt-6 bg-gray-100 p-4 rounded border border-gray-300">
            <h3 className="font-semibold mb-2 text-black">Debug Logs</h3>
            <div
              style={{
                maxHeight: 300,
                overflow: "auto",
                fontSize: 12,
                whiteSpace: "pre-wrap",
                color: "#000000",
                background: "#ffffff",
                padding: "8px",
                borderRadius: "4px",
                border: "1px solid #d4af37",
              }}
            >
              {logs.map((l, i) => (
                <div key={i} className="mb-1">
                  {l}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  const { email, plan, role, priceUSD, priceGHS: pghs, username, fullName } =
    payData;

  const validateKey = (k: string) =>
    !k ? "missing" : k.startsWith("pk_") ? "ok" : "not-pk";

  const handlePay = async () => {
    try {
      addLog("handlePay clicked");
      const keyStatus = validateKey(PAYSTACK_PUBLIC_KEY);
      addLog("keyStatus: " + keyStatus);
      addLog({
        PAYSTACK_PUBLIC_KEY_masked: PAYSTACK_PUBLIC_KEY
          ? `${PAYSTACK_PUBLIC_KEY.slice(0, 8)}...${PAYSTACK_PUBLIC_KEY.slice(-6)}`
          : "<EMPTY>",
      });
      addLog({
        scriptLoaded,
        PaystackPresent: !!((window as unknown as { PaystackPop?: unknown }).PaystackPop),
        amountInPesewas,
        reference,
      });

      if (keyStatus !== "ok") {
        const msg =
          keyStatus === "missing"
            ? "Paystack public key is missing. Add NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY in .env.local and restart dev server."
            : "Invalid key: looks like a secret key. Use publishable key (pk_...).";
        addLog("Aborting: " + msg);
        alert(msg);
        return;
      }

      if (!scriptLoaded || !((window as unknown as { PaystackPop?: unknown }).PaystackPop)) {
        addLog("Aborting: Paystack script not loaded or PaystackPop missing.");
        alert("Paystack checkout not ready yet. Please wait a moment and try again.");
        return;
      }

      if (!amountInPesewas || amountInPesewas <= 0) {
        addLog("Aborting: invalid amountInPesewas = " + amountInPesewas);
        alert("Invalid amount (0). Ensure priceGHS is a valid number greater than 0.");
        return;
      }

      let handler: { openIframe: () => void } | undefined;
      try {
        const PaystackPop = (window as unknown as { PaystackPop: { setup: (config: unknown) => { openIframe: () => void } } }).PaystackPop;
        handler = PaystackPop.setup({
          key: PAYSTACK_PUBLIC_KEY,
          email,
          amount: amountInPesewas,
          currency: "GHS",
          ref: reference,
          metadata: {
            custom_fields: [
              { display_name: "Plan", variable_name: "plan", value: plan },
              { display_name: "User", variable_name: "username", value: username },
            ],
          },
          callback: function (resp: { reference: string }) {
            addLog("Paystack callback success: " + JSON.stringify(resp));
            (async () => {
              try {
                const res = await fetch("/api/subscription", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    email,
                    role,
                    reference: resp.reference,
                  }),
                });
                addLog("API /api/subscription response status: " + res.status);
                const json = await res.json().catch(() => null);
                addLog({ apiResp: json });
              } catch (e) {
                addLog("API call error: " + String(e));
              }
              alert("Payment successful");
              router.push("/");
            })();
          },
          onClose: function () {
            addLog("Paystack onClose called by user (checkout closed).");
            alert("Payment cancelled.");
            router.back();
          },
        });
      } catch (err) {
        addLog("Error during PaystackPop.setup(): " + String(err));
        alert("Could not start transaction. See console for details.");
        return;
      }

      try {
        addLog("Opening Paystack iframe...");
        handler.openIframe();
      } catch (err) {
        addLog("Error when calling handler.openIframe(): " + String(err));
        alert("Could not start transaction. See console for details.");
      }
    } catch (fatal) {
      addLog("Unhandled error in handlePay: " + String(fatal));
      alert("Unexpected error. See console and debug logs below.");
    }
  };

  return (
    <div className="min-h-screen flex items-start justify-center bg-white text-black p-8 space-y-6">
      <div className="max-w-2xl w-full space-y-6">
        <div className="bg-white border border-gray-300 rounded p-6">
          <h2 className="text-2xl font-bold mb-2">Confirm Payment</h2>
          <p className="text-gray-700">Email: {email}</p>
          <p className="text-gray-700">
            {username} {fullName ? `(${fullName})` : ""}
          </p>
          <p className="text-gray-700">Plan: {plan}</p>
          <p className="text-gray-700 mb-3">
            ${Number(priceUSD).toFixed(2)} (GHS {Number(pghs).toFixed(2)})
          </p>

          <button
            onClick={handlePay}
            className="px-6 py-3 rounded font-semibold text-black"
            style={{ backgroundColor: "#d4af37" }}
          >
            Pay with Paystack
          </button>
        </div>

        <div className="bg-gray-100 p-4 rounded border border-gray-300">
          <h3 className="font-semibold mb-2 text-black">Debug Logs</h3>
          <div
            style={{
              maxHeight: 300,
              overflow: "auto",
              fontSize: 12,
              whiteSpace: "pre-wrap",
              color: "#000000",
              background: "#ffffff",
              padding: "8px",
              borderRadius: "4px",
              border: "1px solid #d4af37",
            }}
          >
            {logs.length === 0 ? (
              <div className="text-gray-600">
                No logs yet. Click Pay to start.
              </div>
            ) : (
              logs.map((l, i) => (
                <div key={i} className="mb-1">
                  {l}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
