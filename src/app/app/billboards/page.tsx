"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  FaHome,
  FaCompass,
  FaShoppingCart,
  FaBullhorn,
  FaUser,
  FaFilter,
  FaMapMarkerAlt,
  FaCalendar,
  FaEye,
  FaStar,
  FaArrowRight,
  FaTimes,
} from "react-icons/fa";
import { supabase } from "@/lib/supabaseClient";

const VELT_ACCENT = "#D4AF37";

const navItems = [
  { icon: FaHome, label: "Home", href: "/app/home" },
  { icon: FaCompass, label: "Explore", href: "/app/explore" },
  { icon: FaShoppingCart, label: "Marketplace", href: "/app/marketplace" },
  { icon: FaBullhorn, label: "Billboards", href: "/app/billboards", active: true },
  { icon: FaUser, label: "Profile", href: "/app/profile" },
];

const REGIONS = [
  "All Regions",
  "Greater Accra",
  "Ashanti",
  "Northern",
  "Western",
  "Eastern",
  "Volta",
  "Central",
  "Upper East",
  "Upper West",
];

// Mock billboard data
const mockBillboards = [
  {
    id: "1",
    name: "Accra Mall Premium",
    location: "Accra Mall, Spintex Road",
    region: "Greater Accra",
    size: "48x14 ft",
    pricePerDay: 850,
    impressions: 125000,
    rating: 4.8,
    available: true,
  },
  {
    id: "2",
    name: "Kumasi City Center",
    location: "Adum, Kumasi",
    region: "Ashanti",
    size: "32x10 ft",
    pricePerDay: 650,
    impressions: 98000,
    rating: 4.6,
    available: true,
  },
  {
    id: "3",
    name: "Airport Roundabout",
    location: "Kotoka International Airport",
    region: "Greater Accra",
    size: "64x20 ft",
    pricePerDay: 1200,
    impressions: 180000,
    rating: 4.9,
    available: false,
  },
  {
    id: "4",
    name: "Tema Motorway",
    location: "Tema Motorway Junction",
    region: "Greater Accra",
    size: "48x14 ft",
    pricePerDay: 750,
    impressions: 145000,
    rating: 4.7,
    available: true,
  },
  {
    id: "5",
    name: "Takoradi Market Circle",
    location: "Market Circle, Takoradi",
    region: "Western",
    size: "24x8 ft",
    pricePerDay: 450,
    impressions: 65000,
    rating: 4.4,
    available: true,
  },
  {
    id: "6",
    name: "Ho Municipal Center",
    location: "Ho Town Center",
    region: "Volta",
    size: "32x10 ft",
    pricePerDay: 400,
    impressions: 52000,
    rating: 4.3,
    available: true,
  },
];

export default function BillboardsPage() {
  const router = useRouter();
  const [, setUser] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"marketplace" | "bookings">("marketplace");
  const [showFilters, setShowFilters] = useState(false);
  const [selectedRegion, setSelectedRegion] = useState("All Regions");
  const [selectedBillboard, setSelectedBillboard] = useState<typeof mockBillboards[0] | null>(null);
  const [bookingModal, setBookingModal] = useState(false);
  const [bookingDates, setBookingDates] = useState({ start: "", end: "" });

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push("/app/welcome");
        return;
      }
      setUser(session.user as unknown as Record<string, unknown>);
      setLoading(false);
    };
    checkAuth();
  }, [router]);

  const filteredBillboards = mockBillboards.filter((b) =>
    selectedRegion === "All Regions" ? true : b.region === selectedRegion
  );

  const formatCurrency = (value: number) => `GHS ${value.toLocaleString()}`;

  if (loading) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="flex">
        {/* Sidebar */}
        <aside className="fixed left-0 top-0 h-screen w-64 bg-black border-r border-white/10 p-6 flex flex-col">
          <Link href="/app/home" className="text-2xl font-bold mb-10" style={{ color: VELT_ACCENT }}>
            VELT
          </Link>
          <nav className="flex-1 space-y-2">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.label}
                  href={item.href}
                  className={`flex items-center gap-4 px-4 py-3 rounded-xl transition ${
                    item.active
                      ? "bg-white/10 text-white"
                      : "text-white/60 hover:bg-white/5 hover:text-white"
                  }`}
                >
                  <Icon size={20} />
                  <span className="font-medium">{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </aside>

        {/* Main Content */}
        <main className="ml-64 flex-1 min-h-screen p-8">
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-3xl font-bold mb-2">Billboards</h1>
              <p className="text-white/60">Book outdoor advertising spaces across Ghana</p>
            </div>
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 transition"
            >
              <FaFilter size={16} />
              Filters
            </button>
          </div>

          {/* Tabs */}
          <div className="flex gap-4 mb-6">
            <button
              onClick={() => setActiveTab("marketplace")}
              className={`px-6 py-3 rounded-xl font-medium transition ${
                activeTab === "marketplace"
                  ? "text-black"
                  : "bg-white/5 text-white/60 hover:bg-white/10"
              }`}
              style={activeTab === "marketplace" ? { backgroundColor: VELT_ACCENT } : {}}
            >
              Marketplace
            </button>
            <button
              onClick={() => setActiveTab("bookings")}
              className={`px-6 py-3 rounded-xl font-medium transition ${
                activeTab === "bookings"
                  ? "text-black"
                  : "bg-white/5 text-white/60 hover:bg-white/10"
              }`}
              style={activeTab === "bookings" ? { backgroundColor: VELT_ACCENT } : {}}
            >
              My Bookings
            </button>
          </div>

          {/* Filters Panel */}
          {showFilters && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="bg-white/5 border border-white/10 rounded-2xl p-6 mb-6"
            >
              <h3 className="font-semibold mb-4">Filter by Region</h3>
              <div className="flex flex-wrap gap-2">
                {REGIONS.map((region) => (
                  <button
                    key={region}
                    onClick={() => setSelectedRegion(region)}
                    className={`px-4 py-2 rounded-lg text-sm transition ${
                      selectedRegion === region
                        ? "text-black"
                        : "bg-white/10 text-white/70 hover:bg-white/20"
                    }`}
                    style={selectedRegion === region ? { backgroundColor: VELT_ACCENT } : {}}
                  >
                    {region}
                  </button>
                ))}
              </div>
            </motion.div>
          )}

          {/* Billboard Grid */}
          {activeTab === "marketplace" && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredBillboards.map((billboard, index) => (
                <motion.div
                  key={billboard.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden hover:border-white/20 transition cursor-pointer"
                  onClick={() => setSelectedBillboard(billboard)}
                >
                  {/* Image Placeholder */}
                  <div className="aspect-video bg-gradient-to-br from-white/10 to-white/5 flex items-center justify-center relative">
                    <FaBullhorn size={32} className="text-white/20" />
                    {!billboard.available && (
                      <div className="absolute top-3 right-3 bg-red-500/80 text-white text-xs px-2 py-1 rounded-full">
                        Booked
                      </div>
                    )}
                    {billboard.available && (
                      <div className="absolute top-3 right-3 bg-green-500/80 text-white text-xs px-2 py-1 rounded-full">
                        Available
                      </div>
                    )}
                  </div>

                  {/* Details */}
                  <div className="p-4">
                    <h3 className="font-semibold mb-1">{billboard.name}</h3>
                    <div className="flex items-center gap-1 text-white/60 text-sm mb-3">
                      <FaMapMarkerAlt size={12} />
                      <span>{billboard.location}</span>
                    </div>

                    <div className="flex items-center justify-between text-sm mb-3">
                      <span className="text-white/60">Size: {billboard.size}</span>
                      <div className="flex items-center gap-1">
                        <FaStar size={12} style={{ color: VELT_ACCENT }} />
                        <span>{billboard.rating}</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-bold" style={{ color: VELT_ACCENT }}>
                          {formatCurrency(billboard.pricePerDay)}
                        </p>
                        <p className="text-xs text-white/40">per day</p>
                      </div>
                      <div className="flex items-center gap-1 text-white/60 text-sm">
                        <FaEye size={12} />
                        <span>{(billboard.impressions / 1000).toFixed(0)}K views/day</span>
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          )}

          {/* Bookings Tab */}
          {activeTab === "bookings" && (
            <div className="bg-white/5 border border-white/10 rounded-2xl p-8 text-center">
              <FaCalendar size={48} className="text-white/20 mx-auto mb-4" />
              <h3 className="text-xl font-semibold mb-2">No Bookings Yet</h3>
              <p className="text-white/60 mb-6">
                Browse the marketplace and book your first billboard
              </p>
              <button
                onClick={() => setActiveTab("marketplace")}
                className="px-6 py-3 rounded-xl font-semibold transition hover:opacity-90"
                style={{ backgroundColor: VELT_ACCENT, color: "#000" }}
              >
                Browse Billboards
              </button>
            </div>
          )}
        </main>
      </div>

      {/* Billboard Detail Modal */}
      {selectedBillboard && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-6">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-gray-900 border border-white/10 rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
          >
            {/* Header */}
            <div className="p-6 border-b border-white/10 flex items-center justify-between">
              <h2 className="text-xl font-bold">{selectedBillboard.name}</h2>
              <button
                onClick={() => setSelectedBillboard(null)}
                className="text-white/60 hover:text-white transition"
              >
                <FaTimes size={20} />
              </button>
            </div>

            {/* Content */}
            <div className="p-6">
              {/* Image */}
              <div className="aspect-video bg-gradient-to-br from-white/10 to-white/5 rounded-xl flex items-center justify-center mb-6">
                <FaBullhorn size={48} className="text-white/20" />
              </div>

              {/* Info Grid */}
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="bg-white/5 rounded-xl p-4">
                  <p className="text-white/60 text-sm mb-1">Location</p>
                  <p className="font-medium">{selectedBillboard.location}</p>
                </div>
                <div className="bg-white/5 rounded-xl p-4">
                  <p className="text-white/60 text-sm mb-1">Region</p>
                  <p className="font-medium">{selectedBillboard.region}</p>
                </div>
                <div className="bg-white/5 rounded-xl p-4">
                  <p className="text-white/60 text-sm mb-1">Size</p>
                  <p className="font-medium">{selectedBillboard.size}</p>
                </div>
                <div className="bg-white/5 rounded-xl p-4">
                  <p className="text-white/60 text-sm mb-1">Daily Impressions</p>
                  <p className="font-medium">{selectedBillboard.impressions.toLocaleString()}</p>
                </div>
              </div>

              {/* Price */}
              <div className="bg-white/5 rounded-xl p-6 mb-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-white/60 text-sm mb-1">Price per day</p>
                    <p className="text-2xl font-bold" style={{ color: VELT_ACCENT }}>
                      {formatCurrency(selectedBillboard.pricePerDay)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <FaStar style={{ color: VELT_ACCENT }} />
                    <span className="font-semibold">{selectedBillboard.rating}</span>
                    <span className="text-white/40">rating</span>
                  </div>
                </div>
              </div>

              {/* Book Button */}
              {selectedBillboard.available ? (
                <button
                  onClick={() => {
                    setSelectedBillboard(null);
                    setBookingModal(true);
                  }}
                  className="w-full py-4 rounded-xl font-semibold flex items-center justify-center gap-2 transition hover:opacity-90"
                  style={{ backgroundColor: VELT_ACCENT, color: "#000" }}
                >
                  Book This Billboard
                  <FaArrowRight />
                </button>
              ) : (
                <div className="w-full py-4 rounded-xl font-semibold text-center bg-white/10 text-white/40">
                  Currently Unavailable
                </div>
              )}
            </div>
          </motion.div>
        </div>
      )}

      {/* Booking Modal */}
      {bookingModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-6">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-gray-900 border border-white/10 rounded-2xl max-w-md w-full"
          >
            <div className="p-6 border-b border-white/10 flex items-center justify-between">
              <h2 className="text-xl font-bold">Book Billboard</h2>
              <button
                onClick={() => setBookingModal(false)}
                className="text-white/60 hover:text-white transition"
              >
                <FaTimes size={20} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm text-white/60 mb-2">Start Date</label>
                <input
                  type="date"
                  value={bookingDates.start}
                  onChange={(e) => setBookingDates({ ...bookingDates, start: e.target.value })}
                  className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white focus:outline-none focus:border-yellow-500/50"
                />
              </div>
              <div>
                <label className="block text-sm text-white/60 mb-2">End Date</label>
                <input
                  type="date"
                  value={bookingDates.end}
                  onChange={(e) => setBookingDates({ ...bookingDates, end: e.target.value })}
                  className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white focus:outline-none focus:border-yellow-500/50"
                />
              </div>
              <button
                onClick={() => {
                  alert("Booking request submitted! You will be contacted shortly.");
                  setBookingModal(false);
                }}
                className="w-full py-4 rounded-xl font-semibold transition hover:opacity-90"
                style={{ backgroundColor: VELT_ACCENT, color: "#000" }}
              >
                Submit Booking Request
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
