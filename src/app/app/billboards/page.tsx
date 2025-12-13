"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  FaHome,
  FaShoppingBag,
  FaPlayCircle,
  FaBullhorn,
  FaComments,
  FaFilter,
  FaMapMarkerAlt,
  FaCalendar,
  FaEye,
  FaArrowRight,
  FaTimes,
} from "react-icons/fa";
import { supabase } from "@/lib/supabaseClient";

const VELT_ACCENT = "#D4AF37";

// Types
interface Profile {
  id: string;
  username?: string | null;
  full_name?: string | null;
  avatar_url?: string | null;
}

interface Billboard {
  id: string;
  name: string;
  location?: string | null;
  region?: string | null;
  size?: string | null;
  price_per_day?: number | null;
  daily_impressions?: number | null;
  image_url?: string | null;
  owner_id?: string | null;
  is_available?: boolean;
  created_at: string;
  profile?: Profile | null;
}

interface BillboardBooking {
  id: string;
  billboard_id: string;
  user_id: string;
  start_date: string;
  end_date: string;
  status: string;
  created_at: string;
  billboard?: Billboard | null;
}

const navItems = [
  { icon: FaHome, label: "Home", href: "/app/home" },
  { icon: FaShoppingBag, label: "Shopr", href: "/app/shopr" },
  { icon: FaPlayCircle, label: "Contents", href: "/app/contents" },
  { icon: FaBullhorn, label: "Billboards", href: "/app/billboards", active: true },
  { icon: FaComments, label: "Chats", href: "/app/chats" },
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

export default function BillboardsPage() {
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [billboardsLoading, setBillboardsLoading] = useState(true);
  const [bookingsLoading, setBookingsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"marketplace" | "bookings">("marketplace");
  const [showFilters, setShowFilters] = useState(false);
  const [selectedRegion, setSelectedRegion] = useState("All Regions");
  const [billboards, setBillboards] = useState<Billboard[]>([]);
  const [bookings, setBookings] = useState<BillboardBooking[]>([]);
  const [selectedBillboard, setSelectedBillboard] = useState<Billboard | null>(null);
  const [bookingModal, setBookingModal] = useState(false);
  const [bookingBillboard, setBookingBillboard] = useState<Billboard | null>(null);
  const [bookingDates, setBookingDates] = useState({ start: "", end: "" });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push("/app/welcome");
        return;
      }
      setUserId(session.user.id);
      setLoading(false);
    };
    checkAuth();
  }, [router]);

  // Fetch billboards
  const fetchBillboards = useCallback(async () => {
    setBillboardsLoading(true);
    try {
      const { data, error } = await supabase
        .from("billboards")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) {
        console.warn("[billboards] fetchBillboards err", error);
        setBillboards([]);
        return;
      }

      // Get profiles for billboard owners
      const ownerIds = Array.from(new Set((data || []).map((b) => b.owner_id).filter(Boolean)));
      const profilesMap: Record<string, Profile> = {};

      if (ownerIds.length > 0) {
        const { data: profRows } = await supabase
          .from("profiles")
          .select("id, username, full_name, avatar_url")
          .in("id", ownerIds);

        (profRows || []).forEach((p) => {
          profilesMap[p.id] = p;
        });
      }

      const billboardsWithProfiles = (data || []).map((b) => ({
        ...b,
        profile: b.owner_id ? profilesMap[b.owner_id] || null : null,
      }));

      setBillboards(billboardsWithProfiles);
    } catch (err) {
      console.warn("[billboards] fetchBillboards exception", err);
      setBillboards([]);
    } finally {
      setBillboardsLoading(false);
    }
  }, []);

  // Fetch user's bookings
  const fetchBookings = useCallback(async () => {
    if (!userId) return;
    
    setBookingsLoading(true);
    try {
      const { data, error } = await supabase
        .from("billboard_bookings")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });

      if (error) {
        console.warn("[billboards] fetchBookings err", error);
        setBookings([]);
        return;
      }

      // Get billboard details for bookings
      const billboardIds = Array.from(new Set((data || []).map((b) => b.billboard_id).filter(Boolean)));
      const billboardsMap: Record<string, Billboard> = {};

      if (billboardIds.length > 0) {
        const { data: bbRows } = await supabase
          .from("billboards")
          .select("*")
          .in("id", billboardIds);

        (bbRows || []).forEach((b) => {
          billboardsMap[b.id] = b;
        });
      }

      const bookingsWithBillboards = (data || []).map((booking) => ({
        ...booking,
        billboard: billboardsMap[booking.billboard_id] || null,
      }));

      setBookings(bookingsWithBillboards);
    } catch (err) {
      console.warn("[billboards] fetchBookings exception", err);
      setBookings([]);
    } finally {
      setBookingsLoading(false);
    }
  }, [userId]);

  // Load data on mount
  useEffect(() => {
    if (!loading) {
      fetchBillboards();
    }
  }, [loading, fetchBillboards]);

  // Fetch bookings when user is set or tab changes
  useEffect(() => {
    if (userId && activeTab === "bookings") {
      fetchBookings();
    }
  }, [userId, activeTab, fetchBookings]);

  // Filter billboards by region
  const filteredBillboards = billboards.filter((b) =>
    selectedRegion === "All Regions" ? true : b.region === selectedRegion
  );

  const formatCurrency = (value: number) => `GHS ${value.toLocaleString()}`;

  // Handle booking submission
  const handleBookingSubmit = async () => {
    if (!userId || !bookingBillboard || !bookingDates.start || !bookingDates.end) {
      alert("Please fill in all booking details");
      return;
    }

    setSubmitting(true);
    try {
      const { error } = await supabase
        .from("billboard_bookings")
        .insert({
          billboard_id: bookingBillboard.id,
          user_id: userId,
          start_date: bookingDates.start,
          end_date: bookingDates.end,
          status: "pending",
        });

      if (error) {
        console.warn("[billboards] booking submit err", error);
        alert("Failed to submit booking. Please try again.");
        return;
      }

      alert("Booking request submitted! You will be contacted shortly.");
      setBookingModal(false);
      setBookingDates({ start: "", end: "" });
      setBookingBillboard(null);
      
      // Refresh bookings if on that tab
      if (activeTab === "bookings") {
        fetchBookings();
      }
    } catch (err) {
      console.warn("[billboards] booking submit exception", err);
      alert("An error occurred. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

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
            <>
              {billboardsLoading ? (
                <div className="flex justify-center py-20">
                  <div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                </div>
              ) : filteredBillboards.length === 0 ? (
                <div className="bg-white/5 border border-white/10 rounded-2xl p-8 text-center">
                  <FaBullhorn size={48} className="text-white/20 mx-auto mb-4" />
                  <h3 className="text-xl font-semibold mb-2">No Billboards Found</h3>
                  <p className="text-white/60">
                    {selectedRegion === "All Regions"
                      ? "No billboards available at the moment"
                      : `No billboards available in ${selectedRegion}`}
                  </p>
                </div>
              ) : (
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
                      {/* Image */}
                      <div className="aspect-video bg-gradient-to-br from-white/10 to-white/5 flex items-center justify-center relative overflow-hidden">
                        {billboard.image_url ? (
                          <img
                            src={billboard.image_url}
                            alt={billboard.name}
                            className="absolute inset-0 w-full h-full object-cover"
                          />
                        ) : (
                          <FaBullhorn size={32} className="text-white/20" />
                        )}
                        {billboard.is_available === false ? (
                          <div className="absolute top-3 right-3 bg-red-500/80 text-white text-xs px-2 py-1 rounded-full">
                            Booked
                          </div>
                        ) : (
                          <div className="absolute top-3 right-3 bg-green-500/80 text-white text-xs px-2 py-1 rounded-full">
                            Available
                          </div>
                        )}
                      </div>

                      {/* Details */}
                      <div className="p-4">
                        <h3 className="font-semibold mb-1">{billboard.name}</h3>
                        {billboard.location && (
                          <div className="flex items-center gap-1 text-white/60 text-sm mb-3">
                            <FaMapMarkerAlt size={12} />
                            <span>{billboard.location}</span>
                          </div>
                        )}

                        <div className="flex items-center justify-between text-sm mb-3">
                          {billboard.size && (
                            <span className="text-white/60">Size: {billboard.size}</span>
                          )}
                          {billboard.region && (
                            <span className="text-white/40 text-xs">{billboard.region}</span>
                          )}
                        </div>

                        <div className="flex items-center justify-between">
                          <div>
                            {billboard.price_per_day != null && (
                              <>
                                <p className="font-bold" style={{ color: VELT_ACCENT }}>
                                  {formatCurrency(billboard.price_per_day)}
                                </p>
                                <p className="text-xs text-white/40">per day</p>
                              </>
                            )}
                          </div>
                          {billboard.daily_impressions != null && (
                            <div className="flex items-center gap-1 text-white/60 text-sm">
                              <FaEye size={12} />
                              <span>{(billboard.daily_impressions / 1000).toFixed(0)}K views/day</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </>
          )}

          {/* Bookings Tab */}
          {activeTab === "bookings" && (
            <>
              {bookingsLoading ? (
                <div className="flex justify-center py-20">
                  <div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                </div>
              ) : bookings.length === 0 ? (
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
              ) : (
                <div className="space-y-4">
                  {bookings.map((booking) => (
                    <div
                      key={booking.id}
                      className="bg-white/5 border border-white/10 rounded-2xl p-6"
                    >
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="font-semibold">
                          {booking.billboard?.name || "Billboard Booking"}
                        </h3>
                        <span
                          className={`px-3 py-1 rounded-full text-xs font-medium ${
                            booking.status === "confirmed"
                              ? "bg-green-500/20 text-green-400"
                              : booking.status === "pending"
                              ? "bg-yellow-500/20 text-yellow-400"
                              : "bg-red-500/20 text-red-400"
                          }`}
                        >
                          {booking.status}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <p className="text-white/60">Start Date</p>
                          <p>{new Date(booking.start_date).toLocaleDateString()}</p>
                        </div>
                        <div>
                          <p className="text-white/60">End Date</p>
                          <p>{new Date(booking.end_date).toLocaleDateString()}</p>
                        </div>
                        {booking.billboard?.location && (
                          <div className="col-span-2">
                            <p className="text-white/60">Location</p>
                            <p>{booking.billboard.location}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
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
              <div className="aspect-video bg-gradient-to-br from-white/10 to-white/5 rounded-xl flex items-center justify-center mb-6 overflow-hidden">
                {selectedBillboard.image_url ? (
                  <img
                    src={selectedBillboard.image_url}
                    alt={selectedBillboard.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <FaBullhorn size={48} className="text-white/20" />
                )}
              </div>

              {/* Info Grid */}
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="bg-white/5 rounded-xl p-4">
                  <p className="text-white/60 text-sm mb-1">Location</p>
                  <p className="font-medium">{selectedBillboard.location || "Not specified"}</p>
                </div>
                <div className="bg-white/5 rounded-xl p-4">
                  <p className="text-white/60 text-sm mb-1">Region</p>
                  <p className="font-medium">{selectedBillboard.region || "Not specified"}</p>
                </div>
                {selectedBillboard.size && (
                  <div className="bg-white/5 rounded-xl p-4">
                    <p className="text-white/60 text-sm mb-1">Size</p>
                    <p className="font-medium">{selectedBillboard.size}</p>
                  </div>
                )}
                {selectedBillboard.daily_impressions != null && (
                  <div className="bg-white/5 rounded-xl p-4">
                    <p className="text-white/60 text-sm mb-1">Daily Impressions</p>
                    <p className="font-medium">{selectedBillboard.daily_impressions.toLocaleString()}</p>
                  </div>
                )}
              </div>

              {/* Price */}
              {selectedBillboard.price_per_day != null && (
                <div className="bg-white/5 rounded-xl p-6 mb-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-white/60 text-sm mb-1">Price per day</p>
                      <p className="text-2xl font-bold" style={{ color: VELT_ACCENT }}>
                        {formatCurrency(selectedBillboard.price_per_day)}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Book Button */}
              {selectedBillboard.is_available !== false ? (
                <button
                  onClick={() => {
                    setBookingBillboard(selectedBillboard);
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
      {bookingModal && bookingBillboard && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-6">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-gray-900 border border-white/10 rounded-2xl max-w-md w-full"
          >
            <div className="p-6 border-b border-white/10 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold">Book Billboard</h2>
                <p className="text-white/60 text-sm">{bookingBillboard.name}</p>
              </div>
              <button
                onClick={() => {
                  setBookingModal(false);
                  setBookingBillboard(null);
                }}
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
                onClick={handleBookingSubmit}
                disabled={submitting}
                className="w-full py-4 rounded-xl font-semibold transition hover:opacity-90 disabled:opacity-50"
                style={{ backgroundColor: VELT_ACCENT, color: "#000" }}
              >
                {submitting ? "Submitting..." : "Submit Booking Request"}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
