"use client";

import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";

const plans = [
  { name: "Pro Plan", priceUSD: 2.5 },
  { name: "Celebrity Plan", priceUSD: 3.5 },
  { name: "Channel Plan", priceUSD: 3.0 },
  { name: "Partnership Plan", priceUSD: 2.5 },
];

export default function SubscriptionClient() {
  const router = useRouter();
  const search = useSearchParams();
  const dataParam = search.get("data");

  const [userData, setUserData] = useState<any>({});
  const [exchangeRate, setExchangeRate] = useState<number | null>(null);
  const [loadingRate, setLoadingRate] = useState(true);

  useEffect(() => {
    if (dataParam) {
      try {
        setUserData(JSON.parse(decodeURIComponent(dataParam)));
      } catch (e) {
        console.warn("Could not parse user data", e);
      }
    }
  }, [dataParam]);

  const fetchRate = async () => {
    setLoadingRate(true);
    try {
      const key = process.env.NEXT_PUBLIC_CURRENCY_API_KEY;
      const res = await fetch(
        `https://api.currencyapi.com/v3/latest?apikey=${key}&currencies=GHS&base_currency=USD`
      );
      const json = await res.json();
      const value = json?.data?.GHS?.value;
      if (value) setExchangeRate(value);
    } catch (e) {
      console.error("Currency API", e);
    }
    setLoadingRate(false);
  };

  useEffect(() => {
    fetchRate();
    const iv = setInterval(fetchRate, 60000);
    return () => clearInterval(iv);
  }, []);

  const handleSelect = (plan: any) => {
    const payload = {
      ...userData,
      role: plan.name,
      plan: plan.name,
      priceUSD: plan.priceUSD,
      priceGHS: exchangeRate
        ? (plan.priceUSD * exchangeRate).toFixed(2)
        : plan.priceUSD,
    };
    router.push(`/pay?data=${encodeURIComponent(JSON.stringify(payload))}`);
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-900 p-6">
      <div className="text-center mb-6">
        <div className="text-sm text-gray-400">
          {userData?.email || "unknown@email.com"}
        </div>
        <div className="text-lg text-white">{userData?.username || "---"}</div>
        <h2 className="text-2xl font-bold mt-3">Choose Your Plan</h2>
      </div>

      {loadingRate ? (
        <div className="text-gray-400">Loading rates…</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full max-w-2xl">
          {plans.map((p) => (
            <div
              key={p.name}
              onClick={() => handleSelect(p)}
              className="cursor-pointer bg-gray-800 p-6 rounded-xl hover:bg-gray-700 transition"
            >
              <div className="flex justify-between items-center">
                <div>
                  <div className="font-semibold text-lg">{p.name}</div>
                </div>
                <div className="text-right">
                  <div className="font-medium">
                    ${p.priceUSD.toFixed(2)}
                  </div>
                  {exchangeRate && (
                    <div className="text-sm text-gray-400">
                      ≈ GHS {(p.priceUSD * exchangeRate).toFixed(2)}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
