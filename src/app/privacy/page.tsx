"use client";
import React from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { FaArrowLeft } from 'react-icons/fa';

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-white text-black">
      {/* HEADER */}
      <header className="border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 md:px-12 py-6 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 text-gray-600 hover:text-black transition">
            <FaArrowLeft size={16} />
            <span className="text-sm">Back Home</span>
          </Link>
          <div className="font-bold text-xl">VELT</div>
          <div className="w-20"></div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 md:px-12 py-20">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
          <h1 className="text-5xl md:text-6xl font-bold mb-2">Privacy Policy</h1>
          <p className="text-gray-600 mb-12">Effective Date: December 2025</p>
        </motion.div>

        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }} className="prose prose-lg max-w-none text-gray-700">
          <p className="mb-8 text-lg leading-relaxed">
            Your privacy is important to us. This Privacy Policy explains how VELT collects, uses, and protects your personal data when you use our platform.
          </p>

          <motion.div initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} className="mb-12 p-8 bg-gray-50 rounded-lg border border-gray-200">
            <h2 className="text-2xl font-bold text-black mb-4">1. Information We Collect</h2>
            <p className="mb-4">We collect information necessary to operate our platform and provide you with the best experience:</p>
            <ul className="space-y-3 list-disc list-inside">
              <li>Account information (name, email, phone)</li>
              <li>Billboard content and uploads</li>
              <li>Payment information (via Paystack)</li>
              <li>Device and usage analytics</li>
              <li>IP address and location data</li>
              <li>Cookies and tracking technologies</li>
            </ul>
          </motion.div>

          <motion.div initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} className="mb-12 p-8 bg-gray-50 rounded-lg border border-gray-200">
            <h2 className="text-2xl font-bold text-black mb-4">2. How We Use Your Information</h2>
            <p className="mb-4">We use your information to:</p>
            <ul className="space-y-3 list-disc list-inside">
              <li>Manage and maintain your account</li>
              <li>Provide billboard management services</li>
              <li>Process payments and subscriptions</li>
              <li>Analyze usage and improve our platform</li>
              <li>Prevent fraud and ensure security</li>
              <li>Send service updates and communications</li>
            </ul>
          </motion.div>

          <motion.div initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} className="mb-12 p-8 bg-gray-50 rounded-lg border border-gray-200">
            <h2 className="text-2xl font-bold text-black mb-4">3. Data Sharing</h2>
            <p className="mb-4">We may share your data with trusted third-party service providers:</p>
            <ul className="space-y-3 list-disc list-inside">
              <li><strong>Supabase</strong> - Database and authentication services</li>
              <li><strong>Paystack</strong> - Payment processing</li>
              <li><strong>Analytics providers</strong> - Usage insights</li>
              <li><strong>Legal authorities</strong> - When required by law</li>
            </ul>
          </motion.div>

          <motion.div initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} className="mb-12 p-8 bg-gray-50 rounded-lg border border-gray-200">
            <h2 className="text-2xl font-bold text-black mb-4">4. Data Security</h2>
            <p className="mb-4">
              We implement industry-standard security measures including encryption, secure authentication, and regular security audits. However, no transmission over the internet is 100% secure. You are responsible for maintaining the confidentiality of your account credentials.
            </p>
          </motion.div>

          <motion.div initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} className="mb-12 p-8 bg-gray-50 rounded-lg border border-gray-200">
            <h2 className="text-2xl font-bold text-black mb-4">5. Your Rights</h2>
            <p className="mb-4">You have the right to:</p>
            <ul className="space-y-3 list-disc list-inside">
              <li>Access your personal data</li>
              <li>Request correction or deletion of your data</li>
              <li>Opt-out of marketing communications</li>
              <li>Request data portability</li>
              <li>File a complaint with relevant authorities</li>
            </ul>
          </motion.div>

          <motion.div initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} className="mb-12 p-8 bg-gray-50 rounded-lg border border-gray-200">
            <h2 className="text-2xl font-bold text-black mb-4">6. Cookies</h2>
            <p>
              We use cookies to enhance your experience. You can control cookie settings through your browser. Disabling cookies may limit your ability to use certain features of our platform.
            </p>
          </motion.div>

          <motion.div initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} className="mb-12 p-8 bg-gray-50 rounded-lg border border-gray-200">
            <h2 className="text-2xl font-bold text-black mb-4">7. Contact Us</h2>
            <p className="mb-4">
              If you have questions about this Privacy Policy or your personal data, please contact us:
            </p>
            <p className="font-semibold">
              <a href="mailto:privacy@velt.app" style={{ color: "#d4af37" }} className="hover:opacity-80 transition">
                privacy@velt.app
              </a>
            </p>
          </motion.div>

          <motion.div initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} className="mt-16 p-8 bg-gradient-to-r from-gray-900 to-black text-white rounded-lg">
            <p className="text-sm">
              Last updated: December {new Date().getFullYear()}. VELT reserves the right to update this Privacy Policy at any time. Continued use of our platform indicates acceptance of any changes.
            </p>
          </motion.div>
        </motion.div>
      </main>

      {/* FOOTER */}
      <footer className="w-full border-t border-gray-200 bg-white mt-20">
        <div className="max-w-7xl mx-auto px-6 md:px-12 py-8 text-sm text-gray-600 text-center">
          <p>© {new Date().getFullYear()} VELT. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
