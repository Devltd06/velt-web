"use client";
import React, { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useToast } from '@/components/admin/Toast';
import { FaPlus, FaEdit, FaTrash, FaTimes, FaMapMarkerAlt, FaCloudUploadAlt, FaSpinner, FaSearch, FaFilter } from 'react-icons/fa';

interface Location {
  id: string;
  name: string;
  location: string;
  description?: string;
  type: 'digital' | 'static';
  size: string;
  daily_rate: number;
  weekly_rate: number;
  monthly_rate: number;
  daily_views: number;
  status: 'available' | 'occupied' | 'maintenance';
  image_url?: string;
  created_at: string;
}

const defaultLocation: Partial<Location> = {
  name: '',
  location: '',
  description: '',
  type: 'digital',
  size: '',
  daily_rate: 0,
  weekly_rate: 0,
  monthly_rate: 0,
  daily_views: 0,
  status: 'available',
  image_url: '',
};

function SkeletonCard() {
  return (
    <div className="bg-white/[0.02] rounded-2xl border border-white/[0.04] p-5 animate-pulse">
      <div className="flex items-start gap-4">
        <div className="w-20 h-20 rounded-xl bg-white/5" />
        <div className="flex-1 space-y-3">
          <div className="h-4 w-3/4 bg-white/5 rounded" />
          <div className="h-3 w-1/2 bg-white/5 rounded" />
          <div className="h-3 w-1/3 bg-white/5 rounded" />
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, color = "white" }: { label: string; value: string | number; color?: string }) {
  const colorClass = {
    white: "text-white",
    green: "text-emerald-400",
    blue: "text-blue-400",
    purple: "text-violet-400",
    gold: "text-[#D4AF37]",
  }[color] || "text-white";
  
  return (
    <div className="bg-white/[0.02] rounded-2xl border border-white/[0.04] p-5 hover:border-white/[0.08] transition-colors">
      <p className="text-[13px] text-white/40 mb-1">{label}</p>
      <p className={`text-2xl font-semibold tracking-tight ${colorClass}`}>{value}</p>
    </div>
  );
}

export default function AdminLocationsPage() {
  const { showToast: toast } = useToast();
  const [locations, setLocations] = useState<Location[]>([]);
  const [filteredLocations, setFilteredLocations] = useState<Location[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState<Location | null>(null);
  const [formData, setFormData] = useState<Partial<Location>>(defaultLocation);
  const [stats, setStats] = useState({ total: 0, active: 0, digital: 0, static: 0 });
  const [uploadingImage, setUploadingImage] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const fetchLocations = useCallback(async () => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('billboard_locations')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setLocations(data || []);
    } catch (error) {
      console.error('Error fetching locations:', error);
      toast('Failed to load locations', 'error');
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchLocations();
  }, [fetchLocations]);

  const calculateStats = React.useCallback(() => {
    setStats({
      total: locations.length,
      active: locations.filter(l => l.status === 'available').length,
      digital: locations.filter(l => l.type === 'digital').length,
      static: locations.filter(l => l.type === 'static').length,
    });
  }, [locations]);

  const applyFilters = React.useCallback(() => {
    let filtered = locations;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(l => 
        l.name.toLowerCase().includes(q) || 
        l.location.toLowerCase().includes(q)
      );
    }
    if (statusFilter !== 'all') {
      filtered = filtered.filter(l => l.status === statusFilter);
    }
    setFilteredLocations(filtered);
  }, [locations, searchQuery, statusFilter]);

  useEffect(() => {
    applyFilters();
  }, [applyFilters]);

  useEffect(() => {
    calculateStats();
  }, [calculateStats]);



  const handleAddLocation = async () => {
    if (!formData.name || !formData.location) {
      toast('Please fill in all required fields', 'error');
      return;
    }
    setSaving(true);
    try {
      const { data, error } = await supabase
        .from('billboard_locations')
        .insert([formData])
        .select()
        .single();

      if (error) throw error;

      setLocations(prev => [data, ...prev]);
      setShowAddModal(false);
      setFormData(defaultLocation);
      toast('Location added successfully', 'success');
    } catch (err) {
      console.error('Error adding location:', err);
      toast('Failed to add location', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateLocation = async () => {
    if (!selectedLocation) return;
    setSaving(true);
    try {
      const { data, error } = await supabase
        .from('billboard_locations')
        .update(formData)
        .eq('id', selectedLocation.id)
        .select()
        .single();

      if (error) throw error;

      setLocations(prev =>
        prev.map(l => l.id === selectedLocation.id ? data : l)
      );
      setShowEditModal(false);
      setSelectedLocation(null);
      setFormData(defaultLocation);
      toast('Location updated successfully', 'success');
    } catch (err) {
      console.error('Error updating location:', err);
      toast('Failed to update location', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteLocation = async () => {
    if (!selectedLocation) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from('billboard_locations')
        .delete()
        .eq('id', selectedLocation.id);

      if (error) throw error;

      setLocations(prev => prev.filter(l => l.id !== selectedLocation.id));
      setShowDeleteModal(false);
      setSelectedLocation(null);
      toast('Location deleted', 'success');
    } catch (err) {
      console.error('Error deleting location:', err);
      toast('Failed to delete location', 'error');
    } finally {
      setSaving(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-GH', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, { bg: string; text: string; dot: string }> = {
      available: { bg: 'bg-emerald-500/10', text: 'text-emerald-400', dot: 'bg-emerald-400' },
      occupied: { bg: 'bg-blue-500/10', text: 'text-blue-400', dot: 'bg-blue-400' },
      maintenance: { bg: 'bg-amber-500/10', text: 'text-amber-400', dot: 'bg-amber-400' },
    };
    return styles[status] || { bg: 'bg-white/5', text: 'text-white/60', dot: 'bg-white/40' };
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      toast('Image must be less than 10MB', 'error');
      return;
    }

    setUploadingImage(true);
    try {
      const formDataUpload = new FormData();
      formDataUpload.append('file', file);
      formDataUpload.append('upload_preset', 'in_app_ads');

      const response = await fetch(
        'https://api.cloudinary.com/v1_1/dpejjmjxg/image/upload',
        { method: 'POST', body: formDataUpload }
      );

      if (!response.ok) throw new Error('Upload failed');

      const data = await response.json();
      setFormData(prev => ({ ...prev, image_url: data.secure_url }));
      toast('Image uploaded', 'success');
    } catch (err) {
      console.error('Error uploading image:', err);
      toast('Failed to upload image', 'error');
    } finally {
      setUploadingImage(false);
    }
  };

  const openEditModal = (location: Location) => {
    setSelectedLocation(location);
    setFormData(location);
    setShowEditModal(true);
  };

  const openDeleteModal = (location: Location) => {
    setSelectedLocation(location);
    setShowDeleteModal(true);
  };

  return (
    <div className="p-5 lg:p-8 max-w-[1600px] mx-auto">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Billboard Locations</h1>
          <p className="text-white/40 text-[15px] mt-1">Manage billboard spots across all regions</p>
        </div>
        <button
          onClick={() => { setFormData(defaultLocation); setShowAddModal(true); }}
          className="flex items-center gap-2 px-5 py-2.5 bg-[#D4AF37] text-black font-medium rounded-xl hover:bg-[#C9A432] active:scale-[0.98] transition-all"
        >
          <FaPlus className="w-3.5 h-3.5" />
          Add Location
        </button>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard label="Total Locations" value={stats.total} />
        <StatCard label="Available" value={stats.active} color="green" />
        <StatCard label="Digital Screens" value={stats.digital} color="blue" />
        <StatCard label="Static Boards" value={stats.static} color="purple" />
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1 max-w-md">
          <FaSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-white/25 w-4 h-4" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by name or location..."
            className="w-full bg-white/[0.02] border border-white/[0.04] rounded-xl pl-11 pr-4 py-3 text-white placeholder:text-white/25 focus:border-white/[0.1] focus:outline-none transition-colors"
          />
        </div>
        <div className="relative">
          <FaFilter className="absolute left-4 top-1/2 -translate-y-1/2 text-white/25 w-3.5 h-3.5" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="appearance-none bg-white/[0.02] border border-white/[0.04] rounded-xl pl-10 pr-10 py-3 text-white focus:border-white/[0.1] focus:outline-none transition-colors cursor-pointer"
          >
            <option value="all">All Status</option>
            <option value="available">Available</option>
            <option value="occupied">Occupied</option>
            <option value="maintenance">Maintenance</option>
          </select>
        </div>
      </div>

      {/* Locations Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => <SkeletonCard key={i} />)}
        </div>
      ) : filteredLocations.length === 0 ? (
        <div className="bg-white/[0.02] rounded-2xl border border-white/[0.04] p-12 text-center">
          <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center mx-auto mb-4">
            <FaMapMarkerAlt className="w-7 h-7 text-white/20" />
          </div>
          <p className="text-white/60 font-medium mb-1">No locations found</p>
          <p className="text-white/35 text-sm">
            {searchQuery || statusFilter !== 'all' ? 'Try adjusting your filters' : 'Add your first billboard location'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredLocations.map((location) => {
            const statusStyle = getStatusBadge(location.status);
            return (
              <div
                key={location.id}
                className="bg-white/[0.02] rounded-2xl border border-white/[0.04] overflow-hidden hover:border-white/[0.08] transition-all group"
              >
                {/* Image Section */}
                <div className="h-40 bg-black relative overflow-hidden">
                  {location.image_url ? (
                    <img
                      src={location.image_url}
                      alt={location.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <FaMapMarkerAlt className="w-10 h-10 text-white/10" />
                    </div>
                  )}
                  {/* Status Badge */}
                  <div className={`absolute top-3 right-3 px-2.5 py-1 rounded-lg text-xs font-medium flex items-center gap-1.5 ${statusStyle.bg}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${statusStyle.dot}`} />
                    <span className={statusStyle.text}>{location.status}</span>
                  </div>
                </div>

                {/* Content */}
                <div className="p-5">
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div>
                      <h3 className="font-semibold text-white truncate">{location.name}</h3>
                      <p className="text-white/40 text-sm mt-0.5">{location.location}</p>
                    </div>
                    <span className="px-2.5 py-1 bg-white/5 rounded-lg text-xs text-white/50 capitalize flex-shrink-0">
                      {location.type}
                    </span>
                  </div>

                  {/* Pricing */}
                  <div className="flex items-center gap-4 text-sm mb-4">
                    <div>
                      <span className="text-white/35">Daily:</span>{' '}
                      <span className="text-[#D4AF37] font-medium">GHS {formatCurrency(location.daily_rate)}</span>
                    </div>
                  </div>

                  {/* Meta */}
                  <div className="flex items-center gap-4 text-xs text-white/35 pt-4 border-t border-white/[0.04]">
                    <span>{location.size}</span>
                    <span>·</span>
                    <span>{formatCurrency(location.daily_views)} views/day</span>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2 mt-4">
                    <button
                      onClick={() => openEditModal(location)}
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-white/[0.04] rounded-xl text-white/60 hover:bg-white/[0.08] hover:text-white transition-all text-sm font-medium"
                    >
                      <FaEdit className="w-3.5 h-3.5" />
                      Edit
                    </button>
                    <button
                      onClick={() => openDeleteModal(location)}
                      className="p-2.5 rounded-xl bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors"
                    >
                      <FaTrash className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add/Edit Modal */}
      {(showAddModal || showEditModal) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-black rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-auto border border-white/[0.06]">
            <div className="p-6 border-b border-white/[0.06] flex justify-between items-center sticky top-0 bg-black">
              <h3 className="text-lg font-bold">
                {showAddModal ? 'Add New Location' : 'Edit Location'}
              </h3>
              <button
                onClick={() => {
                  setShowAddModal(false);
                  setShowEditModal(false);
                  setFormData(defaultLocation);
                }}
                className="text-white/40 hover:text-white"
              >
                <FaTimes className="w-6 h-6" />
              </button>
            </div>
            <div className="p-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-white/40 mb-2">Billboard Name</label>
                  <input
                    type="text"
                    value={formData.name || ''}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full bg-white/[0.02] border border-white/[0.06] rounded-lg px-4 py-3 text-white focus:border-[#D4AF37]/50 focus:outline-none"
                    placeholder="e.g., Circle Mall Digital"
                  />
                </div>
                <div>
                  <label className="block text-sm text-white/40 mb-2">Location</label>
                  <input
                    type="text"
                    value={formData.location || ''}
                    onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                    className="w-full bg-white/[0.02] border border-white/[0.06] rounded-lg px-4 py-3 text-white focus:border-[#D4AF37]/50 focus:outline-none"
                    placeholder="e.g., Osu, Accra"
                  />
                </div>
                <div>
                  <label className="block text-sm text-white/40 mb-2">Type</label>
                  <select
                    value={formData.type || 'digital'}
                    onChange={(e) => setFormData({ ...formData, type: e.target.value as 'digital' | 'static' })}
                    className="w-full bg-white/[0.02] border border-white/[0.06] rounded-lg px-4 py-3 text-white focus:border-[#D4AF37]/50 focus:outline-none"
                  >
                    <option value="digital">Digital</option>
                    <option value="static">Static</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-white/40 mb-2">Size</label>
                  <input
                    type="text"
                    value={formData.size || ''}
                    onChange={(e) => setFormData({ ...formData, size: e.target.value })}
                    className="w-full bg-white/[0.02] border border-white/[0.06] rounded-lg px-4 py-3 text-white focus:border-[#D4AF37]/50 focus:outline-none"
                    placeholder="e.g., 20x10 ft"
                  />
                </div>
                <div>
                  <label className="block text-sm text-white/40 mb-2">Daily Rate (GHS)</label>
                  <input
                    type="number"
                    value={formData.daily_rate || ''}
                    onChange={(e) => setFormData({ ...formData, daily_rate: Number(e.target.value) })}
                    className="w-full bg-white/[0.02] border border-white/[0.06] rounded-lg px-4 py-3 text-white focus:border-[#D4AF37]/50 focus:outline-none"
                    placeholder="500"
                  />
                </div>
                <div>
                  <label className="block text-sm text-white/40 mb-2">Weekly Rate (GHS)</label>
                  <input
                    type="number"
                    value={formData.weekly_rate || ''}
                    onChange={(e) => setFormData({ ...formData, weekly_rate: Number(e.target.value) })}
                    className="w-full bg-white/[0.02] border border-white/[0.06] rounded-lg px-4 py-3 text-white focus:border-[#D4AF37]/50 focus:outline-none"
                    placeholder="3000"
                  />
                </div>
                <div>
                  <label className="block text-sm text-white/40 mb-2">Monthly Rate (GHS)</label>
                  <input
                    type="number"
                    value={formData.monthly_rate || ''}
                    onChange={(e) => setFormData({ ...formData, monthly_rate: Number(e.target.value) })}
                    className="w-full bg-white/[0.02] border border-white/[0.06] rounded-lg px-4 py-3 text-white focus:border-[#D4AF37]/50 focus:outline-none"
                    placeholder="10000"
                  />
                </div>
                <div>
                  <label className="block text-sm text-white/40 mb-2">Daily Views</label>
                  <input
                    type="number"
                    value={formData.daily_views || ''}
                    onChange={(e) => setFormData({ ...formData, daily_views: Number(e.target.value) })}
                    className="w-full bg-white/[0.02] border border-white/[0.06] rounded-lg px-4 py-3 text-white focus:border-[#D4AF37]/50 focus:outline-none"
                    placeholder="50000"
                  />
                </div>
                <div>
                  <label className="block text-sm text-white/40 mb-2">Status</label>
                  <select
                    value={formData.status || 'available'}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value as 'available' | 'occupied' | 'maintenance' })}
                    className="w-full bg-white/[0.02] border border-white/[0.06] rounded-lg px-4 py-3 text-white focus:border-[#D4AF37]/50 focus:outline-none"
                  >
                    <option value="available">Available</option>
                    <option value="occupied">Occupied</option>
                    <option value="maintenance">Maintenance</option>
                  </select>
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm text-white/40 mb-2">Billboard Image</label>
                  <div className="flex items-start gap-4">
                    {/* Image Preview */}
                    {formData.image_url ? (
                      <div className="relative w-32 h-24 rounded-lg overflow-hidden flex-shrink-0">
                        <img
                          src={formData.image_url}
                          alt="Preview"
                          className="w-full h-full object-cover"
                        />
                        <button
                          type="button"
                          onClick={() => setFormData({ ...formData, image_url: '' })}
                          className="absolute top-1 right-1 p-1 bg-red-500 rounded-full hover:bg-red-600 transition"
                        >
                          <FaTimes className="w-3 h-3" />
                        </button>
                      </div>
                    ) : (
                      <div className="w-32 h-24 rounded-lg bg-white/[0.02] border border-white/[0.06] flex items-center justify-center flex-shrink-0">
                        <FaMapMarkerAlt className="text-white/20 text-2xl" />
                      </div>
                    )}
                    {/* Upload Button */}
                    <div className="flex-1">
                      <label className="cursor-pointer">
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleImageUpload}
                          className="hidden"
                          disabled={uploadingImage}
                        />
                        <div className={`flex items-center justify-center gap-2 px-4 py-3 rounded-lg border-2 border-dashed transition ${
                          uploadingImage 
                            ? 'border-white/[0.06] bg-white/[0.02] cursor-not-allowed' 
                            : 'border-white/[0.1] hover:border-[#D4AF37]/50 hover:bg-white/[0.02]'
                        }`}>
                          {uploadingImage ? (
                            <>
                              <FaSpinner className="w-5 h-5 animate-spin text-[#D4AF37]" />
                              <span className="text-white/40">Uploading...</span>
                            </>
                          ) : (
                            <>
                              <FaCloudUploadAlt className="w-5 h-5 text-white/40" />
                              <span className="text-white/40">Click to upload image</span>
                            </>
                          )}
                        </div>
                      </label>
                      <p className="text-xs text-white/30 mt-2">PNG, JPG, or WebP. Max 10MB.</p>
                    </div>
                  </div>
                </div>
              </div>
              <div>
                <label className="block text-sm text-white/40 mb-2">Description</label>
                <textarea
                  value={formData.description || ''}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full bg-white/[0.02] border border-white/[0.06] rounded-lg px-4 py-3 text-white focus:border-[#D4AF37]/50 focus:outline-none resize-none"
                  rows={3}
                  placeholder="Describe this billboard location..."
                />
              </div>
              <div className="flex gap-4 pt-4 border-t border-white/[0.06]">
                <button
                  onClick={() => {
                    setShowAddModal(false);
                    setShowEditModal(false);
                    setFormData(defaultLocation);
                  }}
                  className="flex-1 py-3 rounded-lg border border-white/[0.1] hover:bg-white/[0.04] transition"
                >
                  Cancel
                </button>
                <button
                  onClick={showAddModal ? handleAddLocation : handleUpdateLocation}
                  disabled={saving}
                  className="flex-1 py-3 rounded-lg bg-[#D4AF37] text-black font-semibold hover:opacity-90 transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {saving ? 'Saving...' : showAddModal ? 'Add Location' : 'Save Changes'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && selectedLocation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-black rounded-2xl w-full max-w-md border border-white/[0.06]">
            <div className="p-6 border-b border-white/[0.06]">
              <h3 className="text-lg font-bold">Delete Location</h3>
            </div>
            <div className="p-6">
              <p className="text-white/50 mb-4">
                Are you sure you want to delete <strong className="text-white">{selectedLocation.name}</strong>? This action cannot be undone.
              </p>
              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => {
                    setShowDeleteModal(false);
                    setSelectedLocation(null);
                  }}
                  className="flex-1 px-4 py-3 rounded-lg border border-white/[0.1] hover:bg-white/[0.04] transition"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeleteLocation}
                  disabled={saving}
                  className="flex-1 px-4 py-3 rounded-lg bg-red-600 hover:bg-red-700 transition font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {saving ? 'Deleting...' : 'Delete'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
