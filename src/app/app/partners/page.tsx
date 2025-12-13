'use client';

import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  FaArrowLeft, FaPlus, FaCamera, FaTrash, FaMapMarkerAlt,
  FaDollarSign, FaCalendar, FaCheck, FaSpinner, FaTimes, FaEdit,
  FaChartLine, FaEye, FaHandshake, FaClock
} from 'react-icons/fa';
import Link from 'next/link';

const GOLD = '#D4AF37';

interface BillboardPhoto {
  id: string;
  url: string;
  isNew?: boolean;
}

interface BillboardListing {
  id: string;
  name: string;
  location: string;
  region: string;
  size: string;
  pricePerDay: number;
  description: string;
  photos: BillboardPhoto[];
  status: 'active' | 'pending' | 'booked';
  views: number;
  bookings: number;
  revenue: number;
}

interface Booking {
  id: string;
  billboardId: string;
  billboardName: string;
  clientName: string;
  startDate: string;
  endDate: string;
  amount: number;
  status: 'pending' | 'confirmed' | 'completed' | 'cancelled';
}

const mockListings: BillboardListing[] = [
  {
    id: '1',
    name: 'Premium Highway Billboard',
    location: 'Accra-Tema Motorway, KM 5',
    region: 'Greater Accra',
    size: '48x14 ft',
    pricePerDay: 500,
    description: 'High visibility billboard on main highway with 50,000+ daily impressions',
    photos: [
      { id: 'p1', url: 'https://picsum.photos/800/600?random=10' },
      { id: 'p2', url: 'https://picsum.photos/800/600?random=11' },
    ],
    status: 'active',
    views: 1234,
    bookings: 8,
    revenue: 24000
  },
  {
    id: '2',
    name: 'City Center Digital Display',
    location: 'Oxford Street, Osu',
    region: 'Greater Accra',
    size: '20x10 ft',
    pricePerDay: 350,
    description: 'Digital LED billboard in prime shopping district',
    photos: [
      { id: 'p3', url: 'https://picsum.photos/800/600?random=12' },
    ],
    status: 'booked',
    views: 892,
    bookings: 12,
    revenue: 42000
  },
];

const mockBookings: Booking[] = [
  {
    id: 'b1',
    billboardId: '1',
    billboardName: 'Premium Highway Billboard',
    clientName: 'Coca-Cola Ghana',
    startDate: '2024-01-15',
    endDate: '2024-02-15',
    amount: 15000,
    status: 'confirmed'
  },
  {
    id: 'b2',
    billboardId: '2',
    billboardName: 'City Center Digital Display',
    clientName: 'MTN Ghana',
    startDate: '2024-01-20',
    endDate: '2024-03-20',
    amount: 21000,
    status: 'pending'
  },
];

type Tab = 'listings' | 'bookings' | 'analytics';

export default function PartnerDashboardPage() {
  const [activeTab, setActiveTab] = useState<Tab>('listings');
  const [listings, setListings] = useState(mockListings);
  const [bookings, setBookings] = useState(mockBookings);
  const [showAddModal, setShowAddModal] = useState(false);
  const [, setEditingListing] = useState<BillboardListing | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    location: '',
    region: '',
    size: '',
    pricePerDay: '',
    description: '',
  });
  const [formPhotos, setFormPhotos] = useState<BillboardPhoto[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const analytics = useMemo(() => {
    const totalRevenue = listings.reduce((sum, l) => sum + l.revenue, 0);
    const totalViews = listings.reduce((sum, l) => sum + l.views, 0);
    const totalBookings = listings.reduce((sum, l) => sum + l.bookings, 0);
    const activeListings = listings.filter(l => l.status === 'active').length;
    
    return { totalRevenue, totalViews, totalBookings, activeListings };
  }, [listings]);

  const handleAddPhoto = () => {
    // Simulate photo selection
    const newPhoto: BillboardPhoto = {
      id: `new-${Date.now()}`,
      url: `https://picsum.photos/800/600?random=${Date.now()}`,
      isNew: true
    };
    setFormPhotos(prev => [...prev, newPhoto]);
  };

  const handleRemovePhoto = (photoId: string) => {
    setFormPhotos(prev => prev.filter(p => p.id !== photoId));
  };

  const handleSubmitListing = async () => {
    setSubmitting(true);
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    const newListing: BillboardListing = {
      id: `listing-${Date.now()}`,
      name: formData.name,
      location: formData.location,
      region: formData.region,
      size: formData.size,
      pricePerDay: parseFloat(formData.pricePerDay) || 0,
      description: formData.description,
      photos: formPhotos,
      status: 'pending',
      views: 0,
      bookings: 0,
      revenue: 0
    };
    
    setListings(prev => [...prev, newListing]);
    setShowAddModal(false);
    setFormData({ name: '', location: '', region: '', size: '', pricePerDay: '', description: '' });
    setFormPhotos([]);
    setSubmitting(false);
  };

  const handleBookingAction = (bookingId: string, action: 'confirm' | 'cancel') => {
    setBookings(prev => prev.map(b => {
      if (b.id !== bookingId) return b;
      return { ...b, status: action === 'confirm' ? 'confirmed' : 'cancelled' };
    }));
  };

  const regions = ['Greater Accra', 'Ashanti', 'Western', 'Central', 'Eastern', 'Northern', 'Volta'];

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-black/90 backdrop-blur-lg border-b border-white/10">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/app/home" className="p-2 hover:bg-white/10 rounded-full transition-colors">
                <FaArrowLeft />
              </Link>
              <div>
                <h1 className="text-xl font-bold">Partner Dashboard</h1>
                <p className="text-sm text-gray-400">Manage your billboard listings</p>
              </div>
            </div>
            
            <button
              onClick={() => setShowAddModal(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-full font-medium transition-all hover:scale-105"
              style={{ backgroundColor: GOLD, color: 'black' }}
            >
              <FaPlus />
              Add Listing
            </button>
          </div>

          {/* Tabs */}
          <div className="flex gap-2 mt-4">
            {(['listings', 'bookings', 'analytics'] as Tab[]).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-all capitalize ${
                  activeTab === tab 
                    ? 'text-black' 
                    : 'bg-white/5 text-gray-400 hover:bg-white/10'
                }`}
                style={activeTab === tab ? { backgroundColor: GOLD } : {}}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-6xl mx-auto px-4 py-6">
        {/* Analytics Overview */}
        {activeTab === 'analytics' && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <div className="bg-white/5 rounded-xl p-4">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ backgroundColor: `${GOLD}20` }}>
                  <FaDollarSign style={{ color: GOLD }} />
                </div>
                <span className="text-gray-400 text-sm">Total Revenue</span>
              </div>
              <p className="text-2xl font-bold">GHS {analytics.totalRevenue.toLocaleString()}</p>
            </div>
            
            <div className="bg-white/5 rounded-xl p-4">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ backgroundColor: `${GOLD}20` }}>
                  <FaEye style={{ color: GOLD }} />
                </div>
                <span className="text-gray-400 text-sm">Total Views</span>
              </div>
              <p className="text-2xl font-bold">{analytics.totalViews.toLocaleString()}</p>
            </div>
            
            <div className="bg-white/5 rounded-xl p-4">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ backgroundColor: `${GOLD}20` }}>
                  <FaHandshake style={{ color: GOLD }} />
                </div>
                <span className="text-gray-400 text-sm">Total Bookings</span>
              </div>
              <p className="text-2xl font-bold">{analytics.totalBookings}</p>
            </div>
            
            <div className="bg-white/5 rounded-xl p-4">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ backgroundColor: `${GOLD}20` }}>
                  <FaChartLine style={{ color: GOLD }} />
                </div>
                <span className="text-gray-400 text-sm">Active Listings</span>
              </div>
              <p className="text-2xl font-bold">{analytics.activeListings}</p>
            </div>
          </div>
        )}

        {/* Listings */}
        {activeTab === 'listings' && (
          <div className="grid md:grid-cols-2 gap-6">
            {listings.map((listing) => (
              <motion.div
                key={listing.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white/5 rounded-xl overflow-hidden"
              >
                {/* Image */}
                <div className="relative aspect-video">
                  <img
                    src={listing.photos[0]?.url || 'https://picsum.photos/800/600'}
                    alt={listing.name}
                    className="w-full h-full object-cover"
                  />
                  <div className={`absolute top-3 right-3 px-3 py-1 rounded-full text-xs font-medium ${
                    listing.status === 'active' ? 'bg-green-500/20 text-green-400' :
                    listing.status === 'booked' ? 'bg-blue-500/20 text-blue-400' :
                    'bg-yellow-500/20 text-yellow-400'
                  }`}>
                    {listing.status.charAt(0).toUpperCase() + listing.status.slice(1)}
                  </div>
                </div>

                {/* Info */}
                <div className="p-4">
                  <h3 className="font-bold text-lg mb-1">{listing.name}</h3>
                  <p className="text-gray-400 text-sm flex items-center gap-1 mb-2">
                    <FaMapMarkerAlt /> {listing.location}
                  </p>
                  
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-sm text-gray-400">{listing.size}</span>
                    <span className="font-bold" style={{ color: GOLD }}>
                      GHS {listing.pricePerDay}/day
                    </span>
                  </div>

                  {/* Stats */}
                  <div className="flex items-center gap-4 text-sm text-gray-400 mb-4">
                    <span className="flex items-center gap-1">
                      <FaEye /> {listing.views}
                    </span>
                    <span className="flex items-center gap-1">
                      <FaHandshake /> {listing.bookings}
                    </span>
                    <span className="flex items-center gap-1">
                      <FaDollarSign /> GHS {listing.revenue.toLocaleString()}
                    </span>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2">
                    <button
                      onClick={() => setEditingListing(listing)}
                      className="flex-1 py-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors flex items-center justify-center gap-2"
                    >
                      <FaEdit /> Edit
                    </button>
                    <button
                      className="px-4 py-2 rounded-lg hover:bg-red-500/20 transition-colors text-red-400"
                    >
                      <FaTrash />
                    </button>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}

        {/* Bookings */}
        {activeTab === 'bookings' && (
          <div className="space-y-4">
            {bookings.map((booking) => (
              <motion.div
                key={booking.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                className="bg-white/5 rounded-xl p-4"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h3 className="font-bold">{booking.billboardName}</h3>
                    <p className="text-gray-400 text-sm">Client: {booking.clientName}</p>
                    <div className="flex items-center gap-4 mt-2 text-sm">
                      <span className="flex items-center gap-1 text-gray-400">
                        <FaCalendar /> {booking.startDate} - {booking.endDate}
                      </span>
                      <span className="font-bold" style={{ color: GOLD }}>
                        GHS {booking.amount.toLocaleString()}
                      </span>
                    </div>
                  </div>
                  
                  <div className={`px-3 py-1 rounded-full text-xs font-medium ${
                    booking.status === 'confirmed' ? 'bg-green-500/20 text-green-400' :
                    booking.status === 'pending' ? 'bg-yellow-500/20 text-yellow-400' :
                    booking.status === 'completed' ? 'bg-blue-500/20 text-blue-400' :
                    'bg-red-500/20 text-red-400'
                  }`}>
                    {booking.status.charAt(0).toUpperCase() + booking.status.slice(1)}
                  </div>
                </div>

                {booking.status === 'pending' && (
                  <div className="flex gap-2 mt-4">
                    <button
                      onClick={() => handleBookingAction(booking.id, 'confirm')}
                      className="flex-1 py-2 rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
                      style={{ backgroundColor: GOLD, color: 'black' }}
                    >
                      <FaCheck /> Confirm
                    </button>
                    <button
                      onClick={() => handleBookingAction(booking.id, 'cancel')}
                      className="flex-1 py-2 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors flex items-center justify-center gap-2"
                    >
                      <FaTimes /> Decline
                    </button>
                  </div>
                )}
              </motion.div>
            ))}

            {bookings.length === 0 && (
              <div className="text-center py-12 text-gray-400">
                <FaClock className="text-4xl mx-auto mb-4 opacity-50" />
                <p>No bookings yet</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Add Listing Modal */}
      <AnimatePresence>
        {showAddModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setShowAddModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-gray-900 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
            >
              <div className="sticky top-0 bg-gray-900 p-4 border-b border-white/10 flex items-center justify-between">
                <h2 className="text-xl font-bold">Add New Listing</h2>
                <button onClick={() => setShowAddModal(false)} className="p-2 hover:bg-white/10 rounded-full">
                  <FaTimes />
                </button>
              </div>

              <div className="p-4 space-y-4">
                {/* Photos */}
                <div>
                  <label className="block text-sm font-medium mb-2">Photos</label>
                  <div className="flex gap-2 flex-wrap">
                    {formPhotos.map((photo) => (
                      <div key={photo.id} className="relative w-20 h-20 rounded-lg overflow-hidden">
                        <img src={photo.url} alt="" className="w-full h-full object-cover" />
                        <button
                          onClick={() => handleRemovePhoto(photo.id)}
                          className="absolute top-1 right-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center"
                        >
                          <FaTimes className="text-xs" />
                        </button>
                      </div>
                    ))}
                    <button
                      onClick={handleAddPhoto}
                      className="w-20 h-20 rounded-lg border-2 border-dashed border-white/20 flex items-center justify-center hover:border-white/40 transition-colors"
                    >
                      <FaCamera className="text-gray-400" />
                    </button>
                  </div>
                </div>

                {/* Name */}
                <div>
                  <label className="block text-sm font-medium mb-2">Billboard Name</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="e.g., Highway LED Display"
                    className="w-full bg-white/10 rounded-lg py-3 px-4 focus:outline-none focus:ring-2 transition-all"
                    style={{ '--tw-ring-color': GOLD } as React.CSSProperties}
                  />
                </div>

                {/* Location */}
                <div>
                  <label className="block text-sm font-medium mb-2">Location</label>
                  <input
                    type="text"
                    value={formData.location}
                    onChange={(e) => setFormData(prev => ({ ...prev, location: e.target.value }))}
                    placeholder="e.g., Accra Mall Junction"
                    className="w-full bg-white/10 rounded-lg py-3 px-4 focus:outline-none focus:ring-2 transition-all"
                    style={{ '--tw-ring-color': GOLD } as React.CSSProperties}
                  />
                </div>

                {/* Region */}
                <div>
                  <label className="block text-sm font-medium mb-2">Region</label>
                  <select
                    value={formData.region}
                    onChange={(e) => setFormData(prev => ({ ...prev, region: e.target.value }))}
                    className="w-full bg-white/10 rounded-lg py-3 px-4 focus:outline-none focus:ring-2 transition-all"
                    style={{ '--tw-ring-color': GOLD } as React.CSSProperties}
                  >
                    <option value="">Select region</option>
                    {regions.map(r => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </select>
                </div>

                {/* Size & Price */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">Size</label>
                    <input
                      type="text"
                      value={formData.size}
                      onChange={(e) => setFormData(prev => ({ ...prev, size: e.target.value }))}
                      placeholder="e.g., 48x14 ft"
                      className="w-full bg-white/10 rounded-lg py-3 px-4 focus:outline-none focus:ring-2 transition-all"
                      style={{ '--tw-ring-color': GOLD } as React.CSSProperties}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">Price/Day (GHS)</label>
                    <input
                      type="number"
                      value={formData.pricePerDay}
                      onChange={(e) => setFormData(prev => ({ ...prev, pricePerDay: e.target.value }))}
                      placeholder="500"
                      className="w-full bg-white/10 rounded-lg py-3 px-4 focus:outline-none focus:ring-2 transition-all"
                      style={{ '--tw-ring-color': GOLD } as React.CSSProperties}
                    />
                  </div>
                </div>

                {/* Description */}
                <div>
                  <label className="block text-sm font-medium mb-2">Description</label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="Describe your billboard..."
                    rows={3}
                    className="w-full bg-white/10 rounded-lg py-3 px-4 focus:outline-none focus:ring-2 transition-all resize-none"
                    style={{ '--tw-ring-color': GOLD } as React.CSSProperties}
                  />
                </div>

                {/* Submit */}
                <button
                  onClick={handleSubmitListing}
                  disabled={submitting || !formData.name || !formData.location}
                  className="w-full py-3 rounded-lg font-semibold transition-all hover:scale-[1.02] disabled:opacity-50"
                  style={{ backgroundColor: GOLD, color: 'black' }}
                >
                  {submitting ? (
                    <FaSpinner className="animate-spin mx-auto" />
                  ) : (
                    'Submit Listing'
                  )}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
