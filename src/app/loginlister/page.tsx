// src/app/loginlister/page.tsx
import dynamic from "next/dynamic";

const LoginListerForm = dynamic(() => import("@/components/loginlisterclient"), { ssr: false });

export default function Page() {
  return <LoginListerForm />;
}

