// src/app/page.tsx
"use client";

import Image from "next/image";
import Link from "next/link";
import { FaRocket, FaLock, FaWallet, FaTwitter, FaInstagram, FaEnvelope } from "react-icons/fa";
import ThemeToggle from "@/components/ThemeToggle";

export default function Home() {
  return (
    <div className="flex flex-col min-h-screen bg-white text-gray-900 dark:bg-gray-950 dark:text-white transition">
      {/* Navbar */}
      <nav className="fixed top-0 w-full z-50 backdrop-blur bg-white/70 dark:bg-black/40 border-b border-gray-200 dark:border-gray-800">
        <div className="flex items-center justify-between max-w-6xl mx-auto px-6 py-4">
          <div className="flex items-center space-x-3">
            <Image src="/favicon.ico" alt="VELT Logo" width={44} height={44} />
            <span className="font-bold text-xl tracking-wide">VELT</span>
          </div>
          <div className="hidden md:flex space-x-6">
            <Link href="/" className="hover:text-blue-500 transition">Home</Link>
            <a href="#features" className="hover:text-blue-500 transition">Features</a>
            <a href="#about" className="hover:text-blue-500 transition">About</a>
            <a href="#contact" className="hover:text-blue-500 transition">Contact</a>
          </div>
          <div className="flex items-center gap-4">
            <ThemeToggle />
            <Link
              href="/signup"
              className="ml-4 bg-blue-600 px-4 py-2 rounded-md hover:bg-blue-500 font-medium transition"
            >
              Sign Up
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="flex items-center justify-center min-h-screen pt-20">
        <div className="text-center px-6 max-w-3xl">
          <h1 className="text-6xl font-extrabold mb-6 leading-tight bg-gradient-to-r from-blue-400 to-purple-400 text-transparent bg-clip-text">
            Welcome to Velt
          </h1>
          <p className="text-lg text-gray-600 dark:text-gray-300 mb-8">
            The all-in-one platform to connect, monetize, and grow your audience. Pick a plan, sign up, and manage subscriptions effortlessly.
          </p>
          <div className="flex justify-center gap-4">
            <Link
              href="/signup"
              className="bg-blue-600 px-6 py-3 rounded-lg shadow-lg hover:bg-blue-500 transition"
            >
              Get Started
            </Link>
            <a
              href="#features"
              className="border border-blue-600 px-6 py-3 rounded-lg hover:bg-blue-600 hover:text-white transition"
            >
              Learn More
            </a>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-20 px-6 bg-gray-50 dark:bg-gray-900">
        <h2 className="text-4xl font-bold text-center mb-12">Features</h2>
        <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow hover:scale-105 transition">
            <FaRocket className="text-4xl text-blue-400 mb-4" />
            <h3 className="text-xl font-semibold mb-2">Seamless Sign Up</h3>
            <p className="text-gray-600 dark:text-gray-300">
              Fast, secure account creation and profile setup that syncs with the app.
            </p>
          </div>
          <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow hover:scale-105 transition">
            <FaLock className="text-4xl text-purple-400 mb-4" />
            <h3 className="text-xl font-semibold mb-2">Exclusive Plans</h3>
            <p className="text-gray-600 dark:text-gray-300">
              Flexible pricing tiers for creators, channels, and partnerships.
            </p>
          </div>
          <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow hover:scale-105 transition">
            <FaWallet className="text-4xl text-green-400 mb-4" />
            <h3 className="text-xl font-semibold mb-2">Secure Payments</h3>
            <p className="text-gray-600 dark:text-gray-300">
              Paystack integration for safe and reliable payments in GHS.
            </p>
          </div>
        </div>
      </section>

      {/* About */}
      <section id="about" className="py-20 px-6 text-center">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-3xl font-bold mb-4">About Velt</h2>
          <p className="text-gray-600 dark:text-gray-300">
            Velt helps creators monetize their work and manage subscriptions with ease. Connect with your audience and grow your brand.
          </p>
        </div>
      </section>

      {/* Contact */}
      <section id="contact" className="py-12 px-6 bg-gray-50 dark:bg-gray-900 text-center">
        <div className="max-w-3xl mx-auto">
          <h3 className="text-2xl font-semibold mb-2">Contact</h3>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            Questions? Email us at{" "}
            <a href="mailto:support@velt.com" className="text-blue-500">
              support@velt.com
            </a>
          </p>
          <div className="flex items-center justify-center gap-6 text-xl">
            <a href="https://twitter.com" target="_blank" className="hover:text-blue-500">
              <FaTwitter />
            </a>
            <a
              href="https://www.instagram.com/velt_app?igsh=MXc5ZWEwajR1bm81dw%3D%3D&utm_source=qr"
              target="_blank"
              className="hover:text-pink-500"
            >
              <FaInstagram />
            </a>
            <a href="mailto:atmosdevltd@gmail.com" className="hover:text-blue-500">
              <FaEnvelope />
            </a>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-100 dark:bg-gray-950 py-6 border-t border-gray-200 dark:border-gray-800 mt-auto">
        <div className="max-w-6xl mx-auto px-6 flex flex-col md:flex-row justify-between items-center">
          <div>&copy; {new Date().getFullYear()} VELT. All rights reserved.</div>
          <div className="flex gap-6 mt-4 md:mt-0">
            <Link href="/privacy" className="hover:text-blue-500">
              Privacy
            </Link>
            <Link href="/signup" className="hover:text-blue-500">
              Sign up
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

