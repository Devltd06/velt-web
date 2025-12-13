// src/app/lister-plan/success/page.tsx
export default function Success() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-white text-black p-6">
      <div className="max-w-md w-full border-2 rounded-lg p-6 shadow text-center" style={{ borderColor: "#d4af37" }}>
        <h1 className="text-2xl font-bold mb-2 text-black">Payment Complete</h1>
        <p className="mb-4 text-gray-700">Thank you. Your Lister subscription is now active. You can create listings and manage your account.</p>
      </div>
    </div>
  );
}
