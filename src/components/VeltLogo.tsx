"use client";

import Image from "next/image";
import veltLogo from "@/public/velt-logo.png";

interface VeltLogoProps {
  size?: number;
  className?: string;
}

export default function VeltLogo({ size = 40, className = "" }: VeltLogoProps) {
  return (
    <Image
      src={veltLogo}
      alt="VELT"
      width={size}
      height={size}
      className={`object-cover w-full h-full ${className}`}
    />
  );
}
