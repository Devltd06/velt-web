"use client";
import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";

const plans = [
  { name: "Pro Plan", priceUSD: 2.5 },
  { name: "Celebrity Plan", priceUSD: 3.5 },
  { name: "Channel Plan", priceUSD: 3.0 },
  { name: "Partnership Plan", priceUSD: 2.5 },
];

interface UserData {
  email?: string;
  username?: string;
  fullName?: string;
}

interface Plan {
  name: string;
  priceUSD: number;
}

export default function SubscriptionClient() {
  const router = useRouter();
  const search = useSearchParams();
  const dataParam = search.get("data");

  const [userData, setUserData] = useState<UserData>({});
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

  const handleSelect = (plan: Plan) => {
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
    <div className="min-h-screen flex flex-col items-center justify-center bg-[var(--background)] p-6">
      <div className="text-center mb-6">
        <div className="text-sm text-[var(--foreground)]/70">
          {userData?.email || "unknown@email.com"}
        </div>
        <div className="text-lg text-[var(--foreground)] font-semibold">{userData?.username || "---"}</div>
        <h2 className="text-3xl font-bold mt-3 text-[var(--foreground)]">Choose Your Plan</h2>
      </div>

      {loadingRate ? (
        <div className="text-[var(--foreground)]/70">Loading rates...</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full max-w-2xl">
          {plans.map((p) => (
            <div
              key={p.name}
              onClick={() => handleSelect(p)}
              className="cursor-pointer bg-[var(--background)] border-2 border-[var(--foreground)]/20 p-6 rounded-xl hover:border-[var(--foreground)] transition"
            >
              <div className="flex justify-between items-center">
                <div>
                  <div className="font-semibold text-lg text-[var(--foreground)]">{p.name}</div>
                </div>
                <div className="text-right">
                  <div className="font-bold text-[var(--foreground)]">
                    ${p.priceUSD.toFixed(2)}
                  </div>
                  {exchangeRate && (
                    <div className="text-sm text-[var(--foreground)]/60">
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
