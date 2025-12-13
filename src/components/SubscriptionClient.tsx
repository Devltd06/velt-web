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
    <div className="min-h-screen flex flex-col items-center justify-center bg-white p-6">
      <div className="text-center mb-6">
        <div className="text-sm text-gray-700">
          {userData?.email || "unknown@email.com"}
        </div>
        <div className="text-lg text-black font-semibold">{userData?.username || "---"}</div>
        <h2 className="text-3xl font-bold mt-3 text-black">Choose Your Plan</h2>
      </div>

      {loadingRate ? (
        <div className="text-gray-700">Loading rates...</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full max-w-2xl">
          {plans.map((p) => (
            <div
              key={p.name}
              onClick={() => handleSelect(p)}
              className="cursor-pointer bg-white border-2 border-gray-300 p-6 rounded-xl hover:border-yellow-500 transition"
              style={{ borderColor: "currentColor" }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = "#d4af37";
                e.currentTarget.style.boxShadow = "0 0 8px rgba(212, 175, 55, 0.3)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = "#d3d3d3";
                e.currentTarget.style.boxShadow = "none";
              }}
            >
              <div className="flex justify-between items-center">
                <div>
                  <div className="font-semibold text-lg text-black">{p.name}</div>
                </div>
                <div className="text-right">
                  <div className="font-bold text-black">
                    ${p.priceUSD.toFixed(2)}
                  </div>
                  {exchangeRate && (
                    <div className="text-sm text-gray-600">
                      GHS {(p.priceUSD * exchangeRate).toFixed(2)}
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
