// src/app/loginlister/page.tsx
import React from "react";
import dynamic from "next/dynamic";

const LoginListerForm = dynamic(
  () => import("@/components/LoginListerForm"),
  {
    loading: () => <div className="min-h-[50vh] flex items-center justify-center">Loading…</div>,
    ssr: true,
  }
);

export default function Page() {
  return <LoginListerForm />;
}


