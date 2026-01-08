"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { waitlistService } from "@/lib/waitlistService";
import { FaEnvelope, FaCheckCircle, FaExclamationCircle, FaArrowLeft, FaRocket, FaGift, FaUsers, FaMobile, FaPhone } from "react-icons/fa";
import { motion } from "framer-motion";
import VeltLogo from "@/components/VeltLogo";

// Country codes with flags - organized by region
const countryCodes = [
  // Africa
  { code: "+233", country: "GH", flag: "🇬🇭", name: "Ghana" },
  { code: "+234", country: "NG", flag: "🇳🇬", name: "Nigeria" },
  { code: "+254", country: "KE", flag: "🇰🇪", name: "Kenya" },
  { code: "+27", country: "ZA", flag: "🇿🇦", name: "South Africa" },
  { code: "+20", country: "EG", flag: "🇪🇬", name: "Egypt" },
  { code: "+212", country: "MA", flag: "🇲🇦", name: "Morocco" },
  { code: "+213", country: "DZ", flag: "🇩🇿", name: "Algeria" },
  { code: "+216", country: "TN", flag: "🇹🇳", name: "Tunisia" },
  { code: "+218", country: "LY", flag: "🇱🇾", name: "Libya" },
  { code: "+221", country: "SN", flag: "🇸🇳", name: "Senegal" },
  { code: "+223", country: "ML", flag: "🇲🇱", name: "Mali" },
  { code: "+224", country: "GN", flag: "🇬🇳", name: "Guinea" },
  { code: "+225", country: "CI", flag: "🇨🇮", name: "Ivory Coast" },
  { code: "+226", country: "BF", flag: "🇧🇫", name: "Burkina Faso" },
  { code: "+227", country: "NE", flag: "🇳🇪", name: "Niger" },
  { code: "+228", country: "TG", flag: "🇹🇬", name: "Togo" },
  { code: "+229", country: "BJ", flag: "🇧🇯", name: "Benin" },
  { code: "+230", country: "MU", flag: "🇲🇺", name: "Mauritius" },
  { code: "+231", country: "LR", flag: "🇱🇷", name: "Liberia" },
  { code: "+232", country: "SL", flag: "🇸🇱", name: "Sierra Leone" },
  { code: "+235", country: "TD", flag: "🇹🇩", name: "Chad" },
  { code: "+236", country: "CF", flag: "🇨🇫", name: "Central African Republic" },
  { code: "+237", country: "CM", flag: "🇨🇲", name: "Cameroon" },
  { code: "+238", country: "CV", flag: "🇨🇻", name: "Cape Verde" },
  { code: "+239", country: "ST", flag: "🇸🇹", name: "São Tomé and Príncipe" },
  { code: "+240", country: "GQ", flag: "🇬🇶", name: "Equatorial Guinea" },
  { code: "+241", country: "GA", flag: "🇬🇦", name: "Gabon" },
  { code: "+242", country: "CG", flag: "🇨🇬", name: "Congo" },
  { code: "+243", country: "CD", flag: "🇨🇩", name: "DR Congo" },
  { code: "+244", country: "AO", flag: "🇦🇴", name: "Angola" },
  { code: "+245", country: "GW", flag: "🇬🇼", name: "Guinea-Bissau" },
  { code: "+248", country: "SC", flag: "🇸🇨", name: "Seychelles" },
  { code: "+249", country: "SD", flag: "🇸🇩", name: "Sudan" },
  { code: "+250", country: "RW", flag: "🇷🇼", name: "Rwanda" },
  { code: "+251", country: "ET", flag: "🇪🇹", name: "Ethiopia" },
  { code: "+252", country: "SO", flag: "🇸🇴", name: "Somalia" },
  { code: "+253", country: "DJ", flag: "🇩🇯", name: "Djibouti" },
  { code: "+255", country: "TZ", flag: "🇹🇿", name: "Tanzania" },
  { code: "+256", country: "UG", flag: "🇺🇬", name: "Uganda" },
  { code: "+257", country: "BI", flag: "🇧🇮", name: "Burundi" },
  { code: "+258", country: "MZ", flag: "🇲🇿", name: "Mozambique" },
  { code: "+260", country: "ZM", flag: "🇿🇲", name: "Zambia" },
  { code: "+261", country: "MG", flag: "🇲🇬", name: "Madagascar" },
  { code: "+263", country: "ZW", flag: "🇿🇼", name: "Zimbabwe" },
  { code: "+264", country: "NA", flag: "🇳🇦", name: "Namibia" },
  { code: "+265", country: "MW", flag: "🇲🇼", name: "Malawi" },
  { code: "+266", country: "LS", flag: "🇱🇸", name: "Lesotho" },
  { code: "+267", country: "BW", flag: "🇧🇼", name: "Botswana" },
  { code: "+268", country: "SZ", flag: "🇸🇿", name: "Eswatini" },
  { code: "+269", country: "KM", flag: "🇰🇲", name: "Comoros" },
  { code: "+291", country: "ER", flag: "🇪🇷", name: "Eritrea" },
  { code: "+297", country: "AW", flag: "🇦🇼", name: "Aruba" },
  // Europe
  { code: "+44", country: "GB", flag: "🇬🇧", name: "United Kingdom" },
  { code: "+49", country: "DE", flag: "🇩🇪", name: "Germany" },
  { code: "+33", country: "FR", flag: "🇫🇷", name: "France" },
  { code: "+34", country: "ES", flag: "🇪🇸", name: "Spain" },
  { code: "+39", country: "IT", flag: "🇮🇹", name: "Italy" },
  { code: "+31", country: "NL", flag: "🇳🇱", name: "Netherlands" },
  { code: "+32", country: "BE", flag: "🇧🇪", name: "Belgium" },
  { code: "+41", country: "CH", flag: "🇨🇭", name: "Switzerland" },
  { code: "+43", country: "AT", flag: "🇦🇹", name: "Austria" },
  { code: "+45", country: "DK", flag: "🇩🇰", name: "Denmark" },
  { code: "+46", country: "SE", flag: "🇸🇪", name: "Sweden" },
  { code: "+47", country: "NO", flag: "🇳🇴", name: "Norway" },
  { code: "+48", country: "PL", flag: "🇵🇱", name: "Poland" },
  { code: "+351", country: "PT", flag: "🇵🇹", name: "Portugal" },
  { code: "+353", country: "IE", flag: "🇮🇪", name: "Ireland" },
  { code: "+358", country: "FI", flag: "🇫🇮", name: "Finland" },
  { code: "+30", country: "GR", flag: "🇬🇷", name: "Greece" },
  { code: "+380", country: "UA", flag: "🇺🇦", name: "Ukraine" },
  { code: "+7", country: "RU", flag: "🇷🇺", name: "Russia" },
  { code: "+90", country: "TR", flag: "🇹🇷", name: "Turkey" },
  // North America
  { code: "+1", country: "US", flag: "🇺🇸", name: "United States" },
  { code: "+1", country: "CA", flag: "🇨🇦", name: "Canada" },
  { code: "+52", country: "MX", flag: "🇲🇽", name: "Mexico" },
  // Central America & Caribbean
  { code: "+501", country: "BZ", flag: "🇧🇿", name: "Belize" },
  { code: "+502", country: "GT", flag: "🇬🇹", name: "Guatemala" },
  { code: "+503", country: "SV", flag: "🇸🇻", name: "El Salvador" },
  { code: "+504", country: "HN", flag: "🇭🇳", name: "Honduras" },
  { code: "+505", country: "NI", flag: "🇳🇮", name: "Nicaragua" },
  { code: "+506", country: "CR", flag: "🇨🇷", name: "Costa Rica" },
  { code: "+507", country: "PA", flag: "🇵🇦", name: "Panama" },
  { code: "+509", country: "HT", flag: "🇭🇹", name: "Haiti" },
  { code: "+1876", country: "JM", flag: "🇯🇲", name: "Jamaica" },
  { code: "+1868", country: "TT", flag: "🇹🇹", name: "Trinidad and Tobago" },
  // South America
  { code: "+55", country: "BR", flag: "🇧🇷", name: "Brazil" },
  { code: "+54", country: "AR", flag: "🇦🇷", name: "Argentina" },
  { code: "+56", country: "CL", flag: "🇨🇱", name: "Chile" },
  { code: "+57", country: "CO", flag: "🇨🇴", name: "Colombia" },
  { code: "+58", country: "VE", flag: "🇻🇪", name: "Venezuela" },
  { code: "+51", country: "PE", flag: "🇵🇪", name: "Peru" },
  { code: "+593", country: "EC", flag: "🇪🇨", name: "Ecuador" },
  { code: "+591", country: "BO", flag: "🇧🇴", name: "Bolivia" },
  { code: "+595", country: "PY", flag: "🇵🇾", name: "Paraguay" },
  { code: "+598", country: "UY", flag: "🇺🇾", name: "Uruguay" },
  // Asia
  { code: "+91", country: "IN", flag: "🇮🇳", name: "India" },
  { code: "+86", country: "CN", flag: "🇨🇳", name: "China" },
  { code: "+81", country: "JP", flag: "🇯🇵", name: "Japan" },
  { code: "+82", country: "KR", flag: "🇰🇷", name: "South Korea" },
  { code: "+65", country: "SG", flag: "🇸🇬", name: "Singapore" },
  { code: "+60", country: "MY", flag: "🇲🇾", name: "Malaysia" },
  { code: "+62", country: "ID", flag: "🇮🇩", name: "Indonesia" },
  { code: "+63", country: "PH", flag: "🇵🇭", name: "Philippines" },
  { code: "+66", country: "TH", flag: "🇹🇭", name: "Thailand" },
  { code: "+84", country: "VN", flag: "🇻🇳", name: "Vietnam" },
  { code: "+92", country: "PK", flag: "🇵🇰", name: "Pakistan" },
  { code: "+880", country: "BD", flag: "🇧🇩", name: "Bangladesh" },
  { code: "+94", country: "LK", flag: "🇱🇰", name: "Sri Lanka" },
  { code: "+977", country: "NP", flag: "🇳🇵", name: "Nepal" },
  // Middle East
  { code: "+971", country: "AE", flag: "🇦🇪", name: "UAE" },
  { code: "+966", country: "SA", flag: "🇸🇦", name: "Saudi Arabia" },
  { code: "+974", country: "QA", flag: "🇶🇦", name: "Qatar" },
  { code: "+973", country: "BH", flag: "🇧🇭", name: "Bahrain" },
  { code: "+968", country: "OM", flag: "🇴🇲", name: "Oman" },
  { code: "+965", country: "KW", flag: "🇰🇼", name: "Kuwait" },
  { code: "+962", country: "JO", flag: "🇯🇴", name: "Jordan" },
  { code: "+961", country: "LB", flag: "🇱🇧", name: "Lebanon" },
  { code: "+972", country: "IL", flag: "🇮🇱", name: "Israel" },
  { code: "+98", country: "IR", flag: "🇮🇷", name: "Iran" },
  { code: "+964", country: "IQ", flag: "🇮🇶", name: "Iraq" },
  // Oceania
  { code: "+61", country: "AU", flag: "🇦🇺", name: "Australia" },
  { code: "+64", country: "NZ", flag: "🇳🇿", name: "New Zealand" },
  { code: "+679", country: "FJ", flag: "🇫🇯", name: "Fiji" },
  { code: "+675", country: "PG", flag: "🇵🇬", name: "Papua New Guinea" },
];

// Map browser locale to country code
const localeToCountry: Record<string, string> = {
  "en-GH": "+233", "en-NG": "+234", "en-KE": "+254", "en-ZA": "+27",
  "en-US": "+1", "en-GB": "+44", "de-DE": "+49", "fr-FR": "+33",
  "ar-AE": "+971", "hi-IN": "+91", "en-IN": "+91", "zh-CN": "+86",
  "ja-JP": "+81", "en-AU": "+61", "pt-BR": "+55", "ar-EG": "+20",
};

const benefits = [
  { icon: FaRocket, title: "Early Access", description: "Be the first to experience new features before anyone else" },
  { icon: FaGift, title: "Exclusive Perks", description: "Get special discounts and bonuses as an early supporter" },
];

export default function WaitlistPage() {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [countryCode, setCountryCode] = useState("+233"); // Default to Ghana
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<"idle" | "success" | "error">("idle");
  const [message, setMessage] = useState("");

  // Auto-detect country code based on browser locale
  useEffect(() => {
    try {
      const locale = navigator.language || (navigator as Navigator & { userLanguage?: string }).userLanguage;
      if (locale && localeToCountry[locale]) {
        setCountryCode(localeToCountry[locale]);
      } else {
        // Try to match just the country part (e.g., "en-US" -> check for any "-US")
        const countryPart = locale?.split("-")[1]?.toUpperCase();
        if (countryPart) {
          const match = countryCodes.find(c => c.country === countryPart);
          if (match) setCountryCode(match.code);
        }
      }
    } catch (e) {
      // Fallback to Ghana if detection fails
      console.log("Country detection failed, using default", e);
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setStatus("idle");

    try {
      const alreadyExists = await waitlistService.isOnWaitlist(email);
      if (alreadyExists) {
        setStatus("error");
        setMessage("This email is already on our waitlist!");
        setLoading(false);
        return;
      }

      // Combine country code with phone number
      const fullPhone = phone ? `${countryCode}${phone.replace(/^0+/, '')}` : undefined;

      const response = await waitlistService.subscribe(
        email,
        name || undefined,
        fullPhone,
        ["billboard", "sharing", "creating"]
      );

      if (response.error) {
        setStatus("error");
        setMessage(response.error.message || "Failed to join waitlist. Please try again.");
      } else {
        setStatus("success");
        setMessage("🎉 Welcome to the waitlist! We'll notify you when we launch.");
        setEmail("");
        setName("");
        setPhone("");
      }
    } catch (error) {
      setStatus("error");
      setMessage("Something went wrong. Please try again.");
      console.error("Waitlist error:", error);
    } finally {
      setLoading(false);
    }
  };

  const selectedCountry = countryCodes.find(c => c.code === countryCode);

  return (
    <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)] relative overflow-hidden">
      {/* Background Gradient Blobs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.15 }}
          transition={{ duration: 1 }}
          className="absolute -top-32 -left-32 w-96 h-96 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 blur-3xl"
        />
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.12 }}
          transition={{ duration: 1, delay: 0.2 }}
          className="absolute top-1/3 -right-32 w-80 h-80 rounded-full bg-gradient-to-bl from-cyan-400 to-blue-500 blur-3xl"
        />
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.1 }}
          transition={{ duration: 1, delay: 0.4 }}
          className="absolute bottom-0 left-1/4 w-72 h-72 rounded-full bg-gradient-to-tr from-pink-500 to-rose-500 blur-3xl"
        />
      </div>

      {/* Header */}
      <header className="border-b border-[var(--foreground)]/10 bg-[var(--background)]/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 md:px-12 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 text-[var(--foreground)]/60 hover:text-[var(--foreground)] transition">
            <FaArrowLeft size={14} />
            <span className="text-sm font-medium">Back Home</span>
          </Link>
          <Link href="/" className="font-bold text-xl">VELT</Link>
          <div className="w-20"></div>
        </div>
      </header>

      {/* Main Content */}
      <div className="max-w-6xl mx-auto px-6 md:px-12 py-16 md:py-24 relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          {/* Left side - Info */}
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6 }}
          >
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-violet-500/10 to-cyan-500/10 border border-violet-500/20 mb-6">
              <FaUsers className="text-violet-500" />
              <span className="text-sm font-medium">Join 2,000+ waiting</span>
            </div>

            <h1 className="text-4xl md:text-5xl font-bold mb-6 leading-tight">
              Be the First to Experience{" "}
              <span className="bg-gradient-to-r from-violet-500 via-pink-500 to-cyan-500 bg-clip-text text-transparent">VELT</span>
            </h1>

            <p className="text-lg text-[var(--foreground)]/60 mb-8 leading-relaxed">
              Join our exclusive waitlist and get early access to the future of creator monetization and billboard advertising. Don&apos;t miss out on special launch perks!
            </p>

            {/* Benefits Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {benefits.map((benefit, index) => (
                <motion.div
                  key={benefit.title}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 + index * 0.1 }}
                  className={`flex items-start gap-3 p-4 rounded-xl border border-[var(--foreground)]/10 ${
                    index === 0 ? "bg-gradient-to-br from-violet-500/10 to-purple-500/5" : "bg-gradient-to-br from-cyan-500/10 to-teal-500/5"
                  }`}
                >
                  <div 
                    className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 bg-[var(--foreground)]/10"
                  >
                    <benefit.icon className="text-[var(--foreground)]" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-sm">{benefit.title}</h3>
                    <p className="text-xs text-[var(--foreground)]/50 mt-1">{benefit.description}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>

          {/* Right side - Form */}
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            <div className="bg-[var(--background)] rounded-2xl shadow-2xl border border-[var(--foreground)]/10 p-8 md:p-10">
              <div className="text-center mb-8">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", delay: 0.3 }}
                  className="w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center bg-[var(--foreground)] text-[var(--background)]"
                >
                  <VeltLogo size={32} />
                </motion.div>
                <h2 className="text-2xl font-bold">Join the Waitlist</h2>
                <p className="text-[var(--foreground)]/50 mt-2">Get notified when we launch</p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Your Name</label>
                  <input
                    type="text"
                    placeholder="John Doe"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-4 py-3 bg-[var(--background)] border border-[var(--foreground)]/20 rounded-xl focus:outline-none focus:border-[var(--foreground)]/50 text-[var(--foreground)] placeholder-[var(--foreground)]/40 transition"
                    disabled={loading}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Email Address *</label>
                  <input
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="w-full px-4 py-3 bg-[var(--background)] border border-[var(--foreground)]/20 rounded-xl focus:outline-none focus:border-[var(--foreground)]/50 text-[var(--foreground)] placeholder-[var(--foreground)]/40 transition"
                    disabled={loading}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">
                    <span className="flex items-center gap-2">
                      <FaPhone className="text-xs" />
                      Phone Number
                    </span>
                  </label>
                  <div className="flex gap-2">
                    <select
                      value={countryCode}
                      onChange={(e) => setCountryCode(e.target.value)}
                      className="w-28 px-3 py-3 bg-[var(--background)] border border-[var(--foreground)]/20 rounded-xl focus:outline-none focus:border-[var(--foreground)]/50 text-[var(--foreground)] transition cursor-pointer"
                      disabled={loading}
                    >
                      {countryCodes.map((country) => (
                        <option key={country.country} value={country.code}>
                          {country.flag} {country.code}
                        </option>
                      ))}
                    </select>
                    <input
                      type="tel"
                      placeholder={selectedCountry?.country === "GH" ? "241234567" : "Phone number"}
                      value={phone}
                      onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
                      className="flex-1 px-4 py-3 bg-[var(--background)] border border-[var(--foreground)]/20 rounded-xl focus:outline-none focus:border-[var(--foreground)]/50 text-[var(--foreground)] placeholder-[var(--foreground)]/40 transition"
                      disabled={loading}
                      maxLength={15}
                    />
                  </div>
                  <p className="text-xs text-[var(--foreground)]/40 mt-1.5">
                    We&apos;ll send you SMS updates about the launch
                  </p>
                </div>

                <motion.button
                  type="submit"
                  disabled={loading}
                  whileHover={!loading ? { scale: 1.02 } : {}}
                  whileTap={!loading ? { scale: 0.98 } : {}}
                  className="w-full py-4 rounded-xl font-semibold transition flex items-center justify-center gap-2 disabled:opacity-50 bg-[var(--foreground)] text-[var(--background)]"
                >
                  {loading ? (
                    <div className="w-5 h-5 border-2 border-[var(--background)]/30 border-t-[var(--background)] rounded-full animate-spin" />
                  ) : (
                    <>
                      <FaEnvelope />
                      Join Waitlist
                    </>
                  )}
                </motion.button>

                {status === "success" && (
                  <motion.div
                    initial={{ y: -10, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    className="p-4 bg-green-500/10 border border-green-500/30 rounded-xl flex items-start gap-3"
                  >
                    <FaCheckCircle className="text-green-500 text-lg mt-0.5 flex-shrink-0" />
                    <p className="text-green-500 text-sm">{message}</p>
                  </motion.div>
                )}

                {status === "error" && (
                  <motion.div
                    initial={{ y: -10, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl flex items-start gap-3"
                  >
                    <FaExclamationCircle className="text-red-500 text-lg mt-0.5 flex-shrink-0" />
                    <p className="text-red-500 text-sm">{message}</p>
                  </motion.div>
                )}
              </form>

              <p className="text-center text-xs text-[var(--foreground)]/40 mt-6">
                We respect your privacy. Unsubscribe at any time.
              </p>
            </div>

            {/* App Store badges */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              className="mt-8 text-center"
            >
              <p className="text-sm text-[var(--foreground)]/50 mb-3 flex items-center justify-center gap-2">
                <FaMobile className="text-[var(--foreground)]" />
                Coming soon to mobile
              </p>
              <div className="flex justify-center gap-4">
                <div className="px-4 py-2 bg-[var(--foreground)]/10 rounded-lg text-xs text-[var(--foreground)]/50">App Store</div>
                <div className="px-4 py-2 bg-[var(--foreground)]/10 rounded-lg text-xs text-[var(--foreground)]/50">Google Play</div>
              </div>
            </motion.div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}