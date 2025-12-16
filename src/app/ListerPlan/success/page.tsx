// src/app/lister-plan/success/page.tsx
export default function Success() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--background)] text-[var(--foreground)] p-6">
      <div className="max-w-md w-full border-2 border-[var(--foreground)]/20 rounded-lg p-6 shadow text-center">
        <h1 className="text-2xl font-bold mb-2">Payment Complete</h1>
        <p className="mb-4 text-[var(--foreground)]/70">Thank you. Your Lister subscription is now active. You can create listings and manage your account.</p>
      </div>
    </div>
  );
}
