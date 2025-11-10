"use client";
import { Suspense } from "react";
import SubscriptionClient from "@/components/SubscriptionClient";

export default function SubscriptionPage() {
  return (
    <Suspense fallback={<div className="text-gray-400 p-6">Loading subscription...</div>}>
      <SubscriptionClient />
    </Suspense>
  );
}

