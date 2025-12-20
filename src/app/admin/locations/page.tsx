"use client";
import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { FaPlus, FaEdit, FaTrash, FaTimes, FaMapMarkerAlt } from 'react-icons/fa';

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

export default function AdminLocationsPage() {
  const [locations, setLocations] = useState<Location[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState<Location | null>(null);
  const [formData, setFormData] = useState<Partial<Location>>(defaultLocation);
  const [stats, setStats] = useState({ total: 0, active: 0, digital: 0, static: 0 });

  useEffect(() => {
    fetchLocations();
  }, []);

  const calculateStats = React.useCallback(() => {
    setStats({
      total: locations.length,
      active: locations.filter(l => l.status === 'available').length,
      digital: locations.filter(l => l.type === 'digital').length,
      static: locations.filter(l => l.type === 'static').length,
    });
  }, [locations]);

  useEffect(() => {
    calculateStats();
  }, [calculateStats]);

  const fetchLocations = async () => {
    try {
      const { data, error } = await supabase
        .from('billboard_locations')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching locations:', error);
        return;
      }

      setLocations(data || []);
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddLocation = async () => {
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
    } catch (error) {
      console.error('Error adding location:', error);
    }
  };

  const handleUpdateLocation = async () => {
    if (!selectedLocation) return;

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
    } catch (error) {
      console.error('Error updating location:', error);
    }
  };

  const handleDeleteLocation = async () => {
    if (!selectedLocation) return;

    try {
      const { error } = await supabase
        .from('billboard_locations')
        .delete()
        .eq('id', selectedLocation.id);

      if (error) throw error;

      setLocations(prev => prev.filter(l => l.id !== selectedLocation.id));
      setShowDeleteModal(false);
      setSelectedLocation(null);
    } catch (error) {
      console.error('Error deleting location:', error);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-GH', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      available: 'bg-green-500/15 text-green-500',
      occupied: 'bg-blue-500/15 text-blue-500',
      maintenance: 'bg-orange-500/15 text-orange-500',
    };
    return styles[status] || 'bg-gray-500/15 text-gray-500';
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
    <div className="p-4 lg:p-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:justify-between md:items-center mb-8 gap-4">
        <div>
          <h2 className="text-2xl font-bold">Billboard Locations</h2>
          <p className="text-gray-400">Manage available billboard spots</p>
        </div>
        <button
          onClick={() => {
            setFormData(defaultLocation);
            setShowAddModal(true);
          }}
          className="px-4 py-2 bg-[#D4AF37] text-black font-semibold rounded-lg hover:opacity-90 transition flex items-center gap-2 w-fit"
        >
          <FaPlus className="w-4 h-4" />
          Add Location
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
          <p className="text-gray-400 text-sm">Total Locations</p>
          <p className="text-2xl font-bold mt-1">{stats.total}</p>
        </div>
        <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
          <p className="text-gray-400 text-sm">Available</p>
          <p className="text-2xl font-bold mt-1 text-green-500">{stats.active}</p>
        </div>
        <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
          <p className="text-gray-400 text-sm">Digital</p>
          <p className="text-2xl font-bold mt-1 text-blue-500">{stats.digital}</p>
        </div>
        <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
          <p className="text-gray-400 text-sm">Static</p>
          <p className="text-2xl font-bold mt-1 text-purple-500">{stats.static}</p>
        </div>
      </div>

      {/* Locations Table */}
      <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px]">
            <thead className="bg-gray-700/50">
              <tr>
                <th className="text-left px-6 py-4 text-sm font-semibold text-gray-300">Location</th>
                <th className="text-left px-6 py-4 text-sm font-semibold text-gray-300">Type / Size</th>
                <th className="text-left px-6 py-4 text-sm font-semibold text-gray-300">Pricing</th>
                <th className="text-left px-6 py-4 text-sm font-semibold text-gray-300">Daily Views</th>
                <th className="text-left px-6 py-4 text-sm font-semibold text-gray-300">Status</th>
                <th className="text-left px-6 py-4 text-sm font-semibold text-gray-300">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-gray-400">
                    Loading...
                  </td>
                </tr>
              ) : locations.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-gray-400">
                    <FaMapMarkerAlt className="mx-auto text-4xl mb-3 opacity-50" />
                    <p>No locations found. Add your first billboard location.</p>
                  </td>
                </tr>
              ) : (
                locations.map((location) => (
                  <tr key={location.id} className="hover:bg-gray-700/30 transition">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        {location.image_url ? (
                          <img
                            src={location.image_url}
                            alt={location.name}
                            className="w-12 h-12 rounded-lg object-cover"
                          />
                        ) : (
                          <div className="w-12 h-12 rounded-lg bg-gray-700 flex items-center justify-center">
                            <FaMapMarkerAlt className="text-gray-500" />
                          </div>
                        )}
                        <div>
                          <p className="font-medium">{location.name}</p>
                          <p className="text-sm text-gray-400">{location.location}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <p className="font-medium capitalize">{location.type}</p>
                      <p className="text-sm text-gray-400">{location.size}</p>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-sm">
                        <span className="text-gray-400">Daily:</span>{' '}
                        <span className="font-medium text-[#D4AF37]">GHS {formatCurrency(location.daily_rate)}</span>
                      </p>
                      <p className="text-xs text-gray-500">
                        Weekly: GHS {formatCurrency(location.weekly_rate)} | Monthly: GHS {formatCurrency(location.monthly_rate)}
                      </p>
                    </td>
                    <td className="px-6 py-4">
                      <p className="font-medium">{formatCurrency(location.daily_views)}</p>
                      <p className="text-xs text-gray-500">impressions/day</p>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold inline-flex items-center gap-1.5 ${getStatusBadge(location.status)}`}>
                        <span className="w-1.5 h-1.5 rounded-full bg-current"></span>
                        {location.status}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => openEditModal(location)}
                          className="p-2 rounded-lg bg-gray-700 hover:bg-gray-600 transition"
                          title="Edit"
                        >
                          <FaEdit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => openDeleteModal(location)}
                          className="p-2 rounded-lg bg-red-500/20 text-red-500 hover:bg-red-500/30 transition"
                          title="Delete"
                        >
                          <FaTrash className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add/Edit Modal */}
      {(showAddModal || showEditModal) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80">
          <div className="bg-gray-800 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-auto border border-gray-700">
            <div className="p-6 border-b border-gray-700 flex justify-between items-center sticky top-0 bg-gray-800">
              <h3 className="text-lg font-bold">
                {showAddModal ? 'Add New Location' : 'Edit Location'}
              </h3>
              <button
                onClick={() => {
                  setShowAddModal(false);
                  setShowEditModal(false);
                  setFormData(defaultLocation);
                }}
                className="text-gray-400 hover:text-white"
              >
                <FaTimes className="w-6 h-6" />
              </button>
            </div>
            <div className="p-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-2">Billboard Name</label>
                  <input
                    type="text"
                    value={formData.name || ''}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-3 text-white focus:border-[#D4AF37] focus:outline-none"
                    placeholder="e.g., Circle Mall Digital"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-2">Location</label>
                  <input
                    type="text"
                    value={formData.location || ''}
                    onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                    className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-3 text-white focus:border-[#D4AF37] focus:outline-none"
                    placeholder="e.g., Osu, Accra"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-2">Type</label>
                  <select
                    value={formData.type || 'digital'}
                    onChange={(e) => setFormData({ ...formData, type: e.target.value as 'digital' | 'static' })}
                    className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-3 text-white focus:border-[#D4AF37] focus:outline-none"
                  >
                    <option value="digital">Digital</option>
                    <option value="static">Static</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-2">Size</label>
                  <input
                    type="text"
                    value={formData.size || ''}
                    onChange={(e) => setFormData({ ...formData, size: e.target.value })}
                    className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-3 text-white focus:border-[#D4AF37] focus:outline-none"
                    placeholder="e.g., 20x10 ft"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-2">Daily Rate (GHS)</label>
                  <input
                    type="number"
                    value={formData.daily_rate || ''}
                    onChange={(e) => setFormData({ ...formData, daily_rate: Number(e.target.value) })}
                    className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-3 text-white focus:border-[#D4AF37] focus:outline-none"
                    placeholder="500"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-2">Weekly Rate (GHS)</label>
                  <input
                    type="number"
                    value={formData.weekly_rate || ''}
                    onChange={(e) => setFormData({ ...formData, weekly_rate: Number(e.target.value) })}
                    className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-3 text-white focus:border-[#D4AF37] focus:outline-none"
                    placeholder="3000"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-2">Monthly Rate (GHS)</label>
                  <input
                    type="number"
                    value={formData.monthly_rate || ''}
                    onChange={(e) => setFormData({ ...formData, monthly_rate: Number(e.target.value) })}
                    className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-3 text-white focus:border-[#D4AF37] focus:outline-none"
                    placeholder="10000"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-2">Daily Views</label>
                  <input
                    type="number"
                    value={formData.daily_views || ''}
                    onChange={(e) => setFormData({ ...formData, daily_views: Number(e.target.value) })}
                    className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-3 text-white focus:border-[#D4AF37] focus:outline-none"
                    placeholder="50000"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-2">Status</label>
                  <select
                    value={formData.status || 'available'}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value as 'available' | 'occupied' | 'maintenance' })}
                    className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-3 text-white focus:border-[#D4AF37] focus:outline-none"
                  >
                    <option value="available">Available</option>
                    <option value="occupied">Occupied</option>
                    <option value="maintenance">Maintenance</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-2">Image URL</label>
                  <input
                    type="text"
                    value={formData.image_url || ''}
                    onChange={(e) => setFormData({ ...formData, image_url: e.target.value })}
                    className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-3 text-white focus:border-[#D4AF37] focus:outline-none"
                    placeholder="https://..."
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-2">Description</label>
                <textarea
                  value={formData.description || ''}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-3 text-white focus:border-[#D4AF37] focus:outline-none resize-none"
                  rows={3}
                  placeholder="Describe this billboard location..."
                />
              </div>
              <div className="flex gap-4 pt-4 border-t border-gray-700">
                <button
                  onClick={() => {
                    setShowAddModal(false);
                    setShowEditModal(false);
                    setFormData(defaultLocation);
                  }}
                  className="flex-1 py-3 rounded-lg border border-gray-600 hover:bg-gray-700 transition"
                >
                  Cancel
                </button>
                <button
                  onClick={showAddModal ? handleAddLocation : handleUpdateLocation}
                  className="flex-1 py-3 rounded-lg bg-[#D4AF37] text-black font-semibold hover:opacity-90 transition"
                >
                  {showAddModal ? 'Add Location' : 'Save Changes'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && selectedLocation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80">
          <div className="bg-gray-800 rounded-2xl w-full max-w-md border border-gray-700">
            <div className="p-6 border-b border-gray-700">
              <h3 className="text-lg font-bold">Delete Location</h3>
            </div>
            <div className="p-6">
              <p className="text-gray-400 mb-4">
                Are you sure you want to delete <strong className="text-white">{selectedLocation.name}</strong>? This action cannot be undone.
              </p>
              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => {
                    setShowDeleteModal(false);
                    setSelectedLocation(null);
                  }}
                  className="flex-1 px-4 py-3 rounded-lg border border-gray-600 hover:bg-gray-700 transition"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeleteLocation}
                  className="flex-1 px-4 py-3 rounded-lg bg-red-600 hover:bg-red-700 transition font-semibold"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
