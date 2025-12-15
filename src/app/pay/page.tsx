"use client";

import { Suspense } from "react";
import PayDebugInner from "@/components/PayDebugInner";

export default function PayDebugPage() {
  return (
    <Suspense fallback={<div className="p-8 text-white">Loading payment page...</div>}>
      <PayDebugInner />
    </Suspense>
  );
}

