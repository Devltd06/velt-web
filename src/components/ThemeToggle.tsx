// src/components/ThemeToggle.tsx
"use client";
import { FaLock } from "react-icons/fa";

export default function ThemeToggle() {
  return (
    <div
      className="p-2 rounded-full text-gray-500 cursor-default"
      aria-label="Fixed Theme"
      title="Theme is locked to ATMOS DEV"
    >
      <FaLock className="text-gray-400" />
    </div>
  );
}
