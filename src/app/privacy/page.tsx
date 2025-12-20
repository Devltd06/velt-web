"use client";
import React from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { FaArrowLeft, FaShieldAlt, FaLock, FaUserShield, FaDatabase, FaCookieBite, FaEnvelope, FaGavel } from 'react-icons/fa';

export default function PrivacyPolicyPage() {
  const sections = [
    {
      icon: FaDatabase,
      title: "1. Information We Collect",
      intro: "We collect information necessary to operate our platform and provide you with the best experience:",
      items: [
        { label: "Account Information", desc: "Name, email address, and phone number for account creation and verification" },
        { label: "Content Data", desc: "Billboard content, media uploads, and associated metadata" },
        { label: "Payment Information", desc: "Transaction details processed securely via Paystack" },
        { label: "Usage Analytics", desc: "Device information, browsing patterns, and feature usage" },
        { label: "Technical Data", desc: "IP address, browser type, and location data" },
      ]
    },
    {
      icon: FaUserShield,
      title: "2. How We Use Your Information",
      intro: "Your information enables us to deliver and improve our services:",
      items: [
        { label: "Service Delivery", desc: "Manage your account and provide billboard management services" },
        { label: "Transaction Processing", desc: "Handle payments, subscriptions, and refunds securely" },
        { label: "Platform Improvement", desc: "Analyze usage patterns to enhance user experience" },
        { label: "Security & Fraud Prevention", desc: "Protect accounts and detect unauthorized activities" },
        { label: "Communications", desc: "Send essential service updates and notifications" },
      ]
    },
    {
      icon: FaShieldAlt,
      title: "3. Data Sharing & Third Parties",
      intro: "We partner with trusted service providers to deliver our platform:",
      items: [
        { label: "Supabase", desc: "Secure database hosting and user authentication services" },
        { label: "Paystack", desc: "PCI-compliant payment processing and transaction handling" },
        { label: "Analytics Partners", desc: "Anonymized usage data for platform insights" },
        { label: "Legal Compliance", desc: "Disclosure when required by law or legal proceedings" },
      ]
    },
    {
      icon: FaLock,
      title: "4. Data Security",
      intro: "We implement comprehensive security measures to protect your information:",
      items: [
        { label: "Encryption", desc: "All data transmitted using TLS/SSL encryption protocols" },
        { label: "Access Controls", desc: "Role-based access and multi-factor authentication" },
        { label: "Regular Audits", desc: "Periodic security assessments and vulnerability testing" },
        { label: "Secure Storage", desc: "Data stored in SOC 2 compliant cloud infrastructure" },
      ]
    },
    {
      icon: FaGavel,
      title: "5. Your Rights",
      intro: "You have control over your personal data with the following rights:",
      items: [
        { label: "Access", desc: "Request a copy of all personal data we hold about you" },
        { label: "Rectification", desc: "Correct inaccurate or incomplete information" },
        { label: "Erasure", desc: "Request deletion of your personal data" },
        { label: "Portability", desc: "Receive your data in a machine-readable format" },
        { label: "Objection", desc: "Opt-out of marketing and certain data processing" },
      ]
    },
    {
      icon: FaCookieBite,
      title: "6. Cookies & Tracking",
      intro: "We use cookies and similar technologies to enhance your experience:",
      items: [
        { label: "Essential Cookies", desc: "Required for basic platform functionality and security" },
        { label: "Analytics Cookies", desc: "Help us understand how users interact with our platform" },
        { label: "Preference Cookies", desc: "Remember your settings and personalization choices" },
      ]
    },
  ];

  return (
    <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
      {/* HEADER */}
      <header className="border-b border-[var(--foreground)]/10 sticky top-0 bg-[var(--background)]/80 backdrop-blur-sm z-50">
        <div className="max-w-7xl mx-auto px-6 md:px-12 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 text-[var(--foreground)]/60 hover:text-[var(--foreground)] transition">
            <FaArrowLeft size={14} />
            <span className="text-sm font-medium">Back Home</span>
          </Link>
          <Link href="/" className="font-bold text-xl">VELT</Link>
          <div className="w-20"></div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 md:px-12 py-16 md:py-20">
        {/* Hero Section */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }} 
          animate={{ opacity: 1, y: 0 }} 
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-[var(--foreground)]/10 mb-6">
            <FaShieldAlt className="text-2xl text-[var(--foreground)]" />
          </div>
          <h1 className="text-4xl md:text-5xl font-bold mb-4">Privacy Policy</h1>
          <p className="text-[var(--foreground)]/60 text-lg max-w-2xl mx-auto">
            Your privacy is fundamental to our service. This policy explains how we collect, use, and protect your personal information.
          </p>
          <div className="mt-6 inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[var(--foreground)]/5 text-sm text-[var(--foreground)]/70">
            <span className="w-2 h-2 rounded-full bg-green-500"></span>
            Last updated: December 2025
          </div>
        </motion.div>

        {/* Table of Contents */}
        <motion.div 
          initial={{ opacity: 0 }} 
          animate={{ opacity: 1 }} 
          transition={{ delay: 0.2 }}
          className="mb-12 p-6 rounded-xl border border-[var(--foreground)]/10 bg-[var(--foreground)]/[0.02]"
        >
          <h2 className="text-sm font-semibold uppercase tracking-wider text-[var(--foreground)]/50 mb-4">Contents</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {sections.map((section, idx) => (
              <a 
                key={idx}
                href={`#section-${idx + 1}`}
                className="flex items-center gap-3 p-3 rounded-lg hover:bg-[var(--foreground)]/5 transition text-sm"
              >
                <section.icon className="text-[var(--foreground)]/40" />
                <span>{section.title}</span>
              </a>
            ))}
          </div>
        </motion.div>

        {/* Policy Sections */}
        <div className="space-y-8">
          {sections.map((section, idx) => (
            <motion.section
              key={idx}
              id={`section-${idx + 1}`}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-50px" }}
              transition={{ duration: 0.5 }}
              className="scroll-mt-24"
            >
              <div className="p-6 md:p-8 rounded-2xl border border-[var(--foreground)]/10 bg-[var(--background)] hover:border-[var(--foreground)]/20 transition-colors">
                <div className="flex items-start gap-4 mb-6">
                  <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-[var(--foreground)]/10 flex items-center justify-center">
                    <section.icon className="text-xl text-[var(--foreground)]" />
                  </div>
                  <div>
                    <h2 className="text-xl md:text-2xl font-bold text-[var(--foreground)]">{section.title}</h2>
                    <p className="text-[var(--foreground)]/60 mt-1">{section.intro}</p>
                  </div>
                </div>
                
                <div className="space-y-3 ml-0 md:ml-16">
                  {section.items.map((item, itemIdx) => (
                    <div 
                      key={itemIdx}
                      className="flex gap-3 p-4 rounded-xl bg-[var(--foreground)]/[0.03] hover:bg-[var(--foreground)]/[0.05] transition"
                    >
                      <div className="flex-shrink-0 w-1.5 h-1.5 rounded-full bg-[var(--foreground)]/40 mt-2"></div>
                      <div>
                        <span className="font-semibold text-[var(--foreground)]">{item.label}</span>
                        <span className="text-[var(--foreground)]/60"> — {item.desc}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </motion.section>
          ))}
        </div>

        {/* Contact Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mt-12 p-8 rounded-2xl bg-[var(--foreground)] text-[var(--background)]"
        >
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <FaEnvelope className="text-lg" />
                <h3 className="text-xl font-bold">Questions About Your Privacy?</h3>
              </div>
              <p className="text-[var(--background)]/70">
                Our team is here to help with any privacy-related concerns or data requests.
              </p>
            </div>
            <a 
              href="mailto:privacy@velt.app"
              className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-[var(--background)] text-[var(--foreground)] font-semibold hover:opacity-90 transition whitespace-nowrap"
            >
              Contact Privacy Team
            </a>
          </div>
        </motion.div>

        {/* Legal Notice */}
        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="mt-8 text-center text-sm text-[var(--foreground)]/50"
        >
          VELT reserves the right to update this Privacy Policy at any time.{' '}
          <Link 
            href="/admin/login" 
            className="hidden md:inline cursor-text hover:cursor-text select-text"
            style={{ color: 'inherit', textDecoration: 'none' }}
          >
            Continued use of our platform constitutes acceptance of any modifications.
          </Link>
          <span className="md:hidden">
            Continued use of our platform constitutes acceptance of any modifications.
          </span>
          {' '}This policy is governed by the laws of Ghana.
        </motion.p>
      </main>

      {/* FOOTER */}
      <footer className="w-full border-t border-[var(--foreground)]/10 mt-12">
        <div className="max-w-7xl mx-auto px-6 md:px-12 py-8 flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-[var(--foreground)]/60">
          <p>© {new Date().getFullYear()} VELT. All rights reserved.</p>
          <div className="flex items-center gap-6">
            <Link href="/support" className="hover:text-[var(--foreground)] transition">Support</Link>
            <Link href="/investors" className="hover:text-[var(--foreground)] transition">Investors</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
