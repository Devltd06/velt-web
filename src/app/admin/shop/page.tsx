"use client";
import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { 
  FaShoppingBag, FaBox, FaShoppingCart, FaTruck, FaSearch, 
  FaDollarSign, FaUser, FaMapMarkerAlt, FaTrash, FaEye,
  FaCheck, FaTimes, FaClock
} from 'react-icons/fa';

interface Profile {
  id: string;
  full_name?: string;
  username?: string;
  email?: string;
  avatar_url?: string;
}

interface Product {
  id: string;
  user_id: string;
  title: string;
  description?: string;
  price: number;
  images?: string[];
  category?: string;
  stock_quantity?: number;
  location?: string;
  created_at: string;
  seller?: Profile;
}

interface Order {
  id: string;
  user_id: string;
  product_id?: string;
  quantity: number;
  total_price: number;
  status: 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled';
  shipping_address?: string;
  created_at: string;
  updated_at?: string;
  buyer?: Profile;
  product?: Product;
}

interface CartItem {
  id: string;
  user_id: string;
  product_id: string;
  quantity: number;
  created_at: string;
  user?: Profile;
  product?: Product;
}

const ORDER_STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; dot: string; icon: React.ElementType }> = {
  pending: { label: 'Pending', color: 'text-amber-400', bg: 'bg-amber-500/10', dot: 'bg-amber-400', icon: FaClock },
  processing: { label: 'Processing', color: 'text-blue-400', bg: 'bg-blue-500/10', dot: 'bg-blue-400', icon: FaBox },
  shipped: { label: 'Shipped', color: 'text-purple-400', bg: 'bg-purple-500/10', dot: 'bg-purple-400', icon: FaTruck },
  delivered: { label: 'Delivered', color: 'text-emerald-400', bg: 'bg-emerald-500/10', dot: 'bg-emerald-400', icon: FaCheck },
  cancelled: { label: 'Cancelled', color: 'text-red-400', bg: 'bg-red-500/10', dot: 'bg-red-400', icon: FaTimes },
};

const CATEGORIES = [
  { id: 'all', label: 'All', icon: '🛍️' },
  { id: 'electronics', label: 'Electronics', icon: '📱' },
  { id: 'fashion', label: 'Fashion', icon: '👗' },
  { id: 'food', label: 'Food', icon: '🍎' },
  { id: 'home', label: 'Home', icon: '🏠' },
  { id: 'beauty', label: 'Beauty', icon: '💄' },
  { id: 'services', label: 'Services', icon: '🔧' },
];

type TabType = 'products' | 'orders' | 'carts';

export default function AdminShopPage() {
  const [activeTab, setActiveTab] = useState<TabType>('products');
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [orderStatusFilter, setOrderStatusFilter] = useState('all');

  // Stats
  const stats = useMemo(() => {
    const totalProducts = products.length;
    const totalOrders = orders.length;
    const totalRevenue = orders
      .filter(o => o.status !== 'cancelled')
      .reduce((sum, o) => sum + (o.total_price || 0), 0);
    const pendingOrders = orders.filter(o => o.status === 'pending').length;
    const itemsInCarts = cartItems.reduce((sum, c) => sum + c.quantity, 0);
    
    return { totalProducts, totalOrders, totalRevenue, pendingOrders, itemsInCarts };
  }, [products, orders, cartItems]);

  // Fetch all data
  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      // Fetch products
      const { data: productsData } = await supabase
        .from('products')
        .select('*')
        .order('created_at', { ascending: false });

      // Get seller profiles
      const sellerIds = [...new Set((productsData || []).map(p => p.user_id).filter(Boolean))];
      const profilesMap: Record<string, Profile> = {};
      
      if (sellerIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, full_name, username, email, avatar_url')
          .in('id', sellerIds);
        profiles?.forEach(p => { profilesMap[p.id] = p; });
      }

      const productsWithSellers = (productsData || []).map(p => ({
        ...p,
        seller: profilesMap[p.user_id],
      }));
      setProducts(productsWithSellers);

      // Fetch orders
      const { data: ordersData } = await supabase
        .from('orders')
        .select('*')
        .order('created_at', { ascending: false });

      if (ordersData && ordersData.length > 0) {
        // Get buyer profiles
        const buyerIds = [...new Set(ordersData.map(o => o.user_id).filter(Boolean))];

        if (buyerIds.length > 0) {
          const { data: buyerProfiles } = await supabase
            .from('profiles')
            .select('id, full_name, username, email, avatar_url')
            .in('id', buyerIds);
          buyerProfiles?.forEach(p => { profilesMap[p.id] = p; });
        }

        // Map order products
        const productsById: Record<string, Product> = {};
        productsWithSellers.forEach(p => { productsById[p.id] = p; });

        const ordersWithData = ordersData.map(o => ({
          ...o,
          buyer: profilesMap[o.user_id],
          product: o.product_id ? productsById[o.product_id] : undefined,
        }));
        setOrders(ordersWithData);
      } else {
        setOrders([]);
      }

      // Fetch cart items
      const { data: cartsData } = await supabase
        .from('cart_items')
        .select('*')
        .order('created_at', { ascending: false });

      if (cartsData && cartsData.length > 0) {
        const cartUserIds = [...new Set(cartsData.map(c => c.user_id).filter(Boolean))];
        if (cartUserIds.length > 0) {
          const { data: cartUserProfiles } = await supabase
            .from('profiles')
            .select('id, full_name, username, email, avatar_url')
            .in('id', cartUserIds);
          cartUserProfiles?.forEach(p => { profilesMap[p.id] = p; });
        }

        const productsById: Record<string, Product> = {};
        productsWithSellers.forEach(p => { productsById[p.id] = p; });

        const cartsWithData = cartsData.map(c => ({
          ...c,
          user: profilesMap[c.user_id],
          product: productsById[c.product_id],
        }));
        setCartItems(cartsWithData);
      } else {
        setCartItems([]);
      }

    } catch (error) {
      console.error('Error fetching shop data:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Update order status
  const updateOrderStatus = async (orderId: string, newStatus: Order['status']) => {
    const { error } = await supabase
      .from('orders')
      .update({ status: newStatus, updated_at: new Date().toISOString() })
      .eq('id', orderId);

    if (!error) {
      setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: newStatus } : o));
    }
  };

  // Delete product
  const deleteProduct = async (productId: string) => {
    if (!confirm('Delete this product?')) return;
    const { error } = await supabase.from('products').delete().eq('id', productId);
    if (!error) {
      setProducts(prev => prev.filter(p => p.id !== productId));
    }
  };

  // Filtered data
  const filteredProducts = useMemo(() => {
    let list = products;
    if (categoryFilter !== 'all') list = list.filter(p => p.category === categoryFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(p => 
        p.title?.toLowerCase().includes(q) ||
        p.seller?.full_name?.toLowerCase().includes(q) ||
        p.location?.toLowerCase().includes(q)
      );
    }
    return list;
  }, [products, categoryFilter, search]);

  const filteredOrders = useMemo(() => {
    let list = orders;
    if (orderStatusFilter !== 'all') list = list.filter(o => o.status === orderStatusFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(o => 
        o.buyer?.full_name?.toLowerCase().includes(q) ||
        o.buyer?.email?.toLowerCase().includes(q) ||
        o.product?.title?.toLowerCase().includes(q)
      );
    }
    return list;
  }, [orders, orderStatusFilter, search]);

  const filteredCarts = useMemo(() => {
    if (!search.trim()) return cartItems;
    const q = search.toLowerCase();
    return cartItems.filter(c => 
      c.user?.full_name?.toLowerCase().includes(q) ||
      c.product?.title?.toLowerCase().includes(q)
    );
  }, [cartItems, search]);

  const formatCurrency = (amount: number) => `GHS ${new Intl.NumberFormat('en-GH').format(amount)}`;
  const formatDate = (date: string) => new Date(date).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit'
  });

  const tabs = [
    { key: 'products', label: 'Products', icon: FaBox, count: stats.totalProducts },
    { key: 'orders', label: 'Orders', icon: FaShoppingCart, count: stats.totalOrders },
    { key: 'carts', label: 'Carts', icon: FaShoppingBag, count: stats.itemsInCarts },
  ];

  return (
    <div className="p-4 lg:p-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-semibold">Shop Management</h1>
          <p className="text-sm text-white/50 mt-1">Manage products, orders, and carts</p>
        </div>
        <div className="relative w-full lg:w-80">
          <FaSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
          <input
            type="text"
            placeholder="Search..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm placeholder-white/30 focus:border-[#D4AF37]/50 focus:outline-none transition-colors"
          />
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <StatCard icon={FaBox} label="Products" value={stats.totalProducts} color="white" />
        <StatCard icon={FaShoppingCart} label="Total Orders" value={stats.totalOrders} color="blue" />
        <StatCard icon={FaClock} label="Pending" value={stats.pendingOrders} color="amber" />
        <StatCard icon={FaDollarSign} label="Revenue" value={formatCurrency(stats.totalRevenue)} color="gold" />
        <StatCard icon={FaShoppingBag} label="In Carts" value={stats.itemsInCarts} color="purple" />
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-white/5 pb-2">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as TabType)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-t-lg text-sm font-medium transition-all ${
                activeTab === tab.key 
                  ? 'bg-[#D4AF37] text-black' 
                  : 'text-white/50 hover:text-white hover:bg-white/5'
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
              <span className={`px-1.5 py-0.5 rounded text-xs ${activeTab === tab.key ? 'bg-black/20' : 'bg-white/10'}`}>
                {tab.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Products Tab */}
      {activeTab === 'products' && (
        <div className="space-y-4">
          {/* Category Filter */}
          <div className="flex gap-2 overflow-x-auto pb-1">
            {CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setCategoryFilter(cat.id)}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm whitespace-nowrap transition-all ${
                  categoryFilter === cat.id ? 'bg-white/10 text-white' : 'bg-white/5 text-white/50 hover:text-white'
                }`}
              >
                <span>{cat.icon}</span>
                {cat.label}
              </button>
            ))}
          </div>

          {/* Products Grid */}
          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {[...Array(8)].map((_, i) => (
                <div key={i} className="bg-white/[0.02] border border-white/5 rounded-2xl p-4 animate-pulse">
                  <div className="aspect-square bg-white/5 rounded-xl mb-3" />
                  <div className="h-4 w-3/4 bg-white/5 rounded mb-2" />
                  <div className="h-4 w-1/2 bg-white/5 rounded" />
                </div>
              ))}
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-12 text-center">
              <FaBox className="w-12 h-12 text-white/10 mx-auto mb-4" />
              <p className="text-white/40">No products found</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {filteredProducts.map((product) => (
                <div key={product.id} className="bg-white/[0.02] border border-white/5 rounded-2xl overflow-hidden hover:border-white/10 transition-all group">
                  <div className="aspect-square bg-black relative">
                    {product.images && product.images[0] ? (
                      <img src={product.images[0]} alt={product.title} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <FaBox className="w-12 h-12 text-white/10" />
                      </div>
                    )}
                    {product.stock_quantity != null && product.stock_quantity <= 0 && (
                      <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                        <span className="px-3 py-1 bg-red-500/20 text-red-400 rounded-lg text-sm font-medium">Out of Stock</span>
                      </div>
                    )}
                  </div>
                  <div className="p-4">
                    <h3 className="font-medium text-sm truncate">{product.title}</h3>
                    <p className="text-[#D4AF37] font-semibold mt-1">{formatCurrency(product.price)}</p>
                    {product.seller && (
                      <div className="flex items-center gap-2 mt-2 text-xs text-white/40">
                        <FaUser className="w-3 h-3" />
                        {product.seller.full_name || product.seller.username}
                      </div>
                    )}
                    {product.location && (
                      <div className="flex items-center gap-2 mt-1 text-xs text-white/40">
                        <FaMapMarkerAlt className="w-3 h-3" />
                        {product.location}
                      </div>
                    )}
                    <div className="flex items-center gap-2 mt-3 pt-3 border-t border-white/5">
                      <span className="text-xs text-white/30">Stock: {product.stock_quantity ?? '∞'}</span>
                      <span className="text-xs text-white/30">•</span>
                      <span className="text-xs text-white/30 capitalize">{product.category || 'General'}</span>
                    </div>
                    <div className="flex gap-2 mt-3">
                      <button className="flex-1 py-2 rounded-lg bg-white/5 text-white/60 hover:bg-white/10 text-xs font-medium transition-colors">
                        <FaEye className="w-3 h-3 inline mr-1" /> View
                      </button>
                      <button 
                        onClick={() => deleteProduct(product.id)}
                        className="p-2 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors"
                      >
                        <FaTrash className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Orders Tab */}
      {activeTab === 'orders' && (
        <div className="space-y-4">
          {/* Status Filter */}
          <div className="flex gap-2 overflow-x-auto pb-1">
            <button
              onClick={() => setOrderStatusFilter('all')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                orderStatusFilter === 'all' ? 'bg-white/10 text-white' : 'bg-white/5 text-white/50'
              }`}
            >
              All Orders
            </button>
            {Object.entries(ORDER_STATUS_CONFIG).map(([key, config]) => (
              <button
                key={key}
                onClick={() => setOrderStatusFilter(key)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  orderStatusFilter === key ? config.bg + ' ' + config.color : 'bg-white/5 text-white/50'
                }`}
              >
                {config.label}
              </button>
            ))}
          </div>

          {/* Orders List */}
          {isLoading ? (
            <div className="space-y-4">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="bg-white/[0.02] border border-white/5 rounded-2xl p-5 animate-pulse">
                  <div className="flex gap-4">
                    <div className="w-16 h-16 bg-white/5 rounded-xl" />
                    <div className="flex-1 space-y-2">
                      <div className="h-4 w-1/3 bg-white/5 rounded" />
                      <div className="h-4 w-1/4 bg-white/5 rounded" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : filteredOrders.length === 0 ? (
            <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-12 text-center">
              <FaShoppingCart className="w-12 h-12 text-white/10 mx-auto mb-4" />
              <p className="text-white/40">No orders found</p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredOrders.map((order) => {
                const statusConfig = ORDER_STATUS_CONFIG[order.status] || ORDER_STATUS_CONFIG.pending;
                const StatusIcon = statusConfig.icon;
                return (
                  <div key={order.id} className="bg-white/[0.02] border border-white/5 rounded-2xl overflow-hidden">
                    <div className="p-5">
                      <div className="flex items-start gap-4">
                        {/* Product Image */}
                        <div className="w-16 h-16 rounded-xl overflow-hidden bg-white/5 flex-shrink-0">
                          {order.product?.images?.[0] ? (
                            <img src={order.product.images[0]} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <FaBox className="w-6 h-6 text-white/20" />
                            </div>
                          )}
                        </div>
                        
                        {/* Order Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <h3 className="font-medium">{order.product?.title || 'Unknown Product'}</h3>
                              <p className="text-sm text-white/50 mt-0.5">Qty: {order.quantity} × {formatCurrency(order.total_price / order.quantity)}</p>
                            </div>
                            <div className="text-right">
                              <p className="text-lg font-semibold text-[#D4AF37]">{formatCurrency(order.total_price)}</p>
                              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${statusConfig.bg} ${statusConfig.color}`}>
                                <StatusIcon className="w-3 h-3" />
                                {statusConfig.label}
                              </span>
                            </div>
                          </div>
                          
                          {/* Buyer */}
                          {order.buyer && (
                            <div className="flex items-center gap-2 mt-3">
                              {order.buyer.avatar_url ? (
                                <img src={order.buyer.avatar_url} alt="" className="w-6 h-6 rounded-full" />
                              ) : (
                                <div className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center">
                                  <FaUser className="w-3 h-3 text-white/40" />
                                </div>
                              )}
                              <span className="text-sm text-white/70">{order.buyer.full_name || order.buyer.username}</span>
                              <span className="text-xs text-white/40">• {formatDate(order.created_at)}</span>
                            </div>
                          )}
                        </div>
                      </div>
                      
                      {/* Status Update */}
                      <div className="flex items-center gap-2 mt-4 pt-4 border-t border-white/5">
                        <span className="text-xs text-white/40">Update status:</span>
                        {Object.entries(ORDER_STATUS_CONFIG).map(([key, config]) => (
                          <button
                            key={key}
                            onClick={() => updateOrderStatus(order.id, key as Order['status'])}
                            disabled={order.status === key}
                            className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                              order.status === key 
                                ? config.bg + ' ' + config.color + ' cursor-not-allowed'
                                : 'bg-white/5 text-white/40 hover:bg-white/10 hover:text-white'
                            }`}
                          >
                            {config.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Carts Tab */}
      {activeTab === 'carts' && (
        <div className="space-y-4">
          {isLoading ? (
            <div className="space-y-4">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="bg-white/[0.02] border border-white/5 rounded-2xl p-5 animate-pulse">
                  <div className="flex gap-4">
                    <div className="w-12 h-12 bg-white/5 rounded-xl" />
                    <div className="flex-1 space-y-2">
                      <div className="h-4 w-1/3 bg-white/5 rounded" />
                      <div className="h-4 w-1/4 bg-white/5 rounded" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : filteredCarts.length === 0 ? (
            <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-12 text-center">
              <FaShoppingBag className="w-12 h-12 text-white/10 mx-auto mb-4" />
              <p className="text-white/40">No items in carts</p>
            </div>
          ) : (
            <div className="bg-white/[0.02] border border-white/5 rounded-2xl overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/5">
                    <th className="text-left px-5 py-4 text-xs font-medium text-white/40 uppercase">User</th>
                    <th className="text-left px-5 py-4 text-xs font-medium text-white/40 uppercase">Product</th>
                    <th className="text-left px-5 py-4 text-xs font-medium text-white/40 uppercase">Qty</th>
                    <th className="text-left px-5 py-4 text-xs font-medium text-white/40 uppercase">Value</th>
                    <th className="text-left px-5 py-4 text-xs font-medium text-white/40 uppercase">Added</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {filteredCarts.map((item) => (
                    <tr key={item.id} className="hover:bg-white/[0.02]">
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2">
                          {item.user?.avatar_url ? (
                            <img src={item.user.avatar_url} alt="" className="w-8 h-8 rounded-full" />
                          ) : (
                            <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center">
                              <FaUser className="w-3 h-3 text-white/40" />
                            </div>
                          )}
                          <div>
                            <p className="text-sm font-medium">{item.user?.full_name || item.user?.username || 'Unknown'}</p>
                            <p className="text-xs text-white/40">{item.user?.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg overflow-hidden bg-white/5">
                            {item.product?.images?.[0] ? (
                              <img src={item.product.images[0]} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center">
                                <FaBox className="w-4 h-4 text-white/20" />
                              </div>
                            )}
                          </div>
                          <span className="text-sm">{item.product?.title || 'Unknown'}</span>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <span className="text-sm">{item.quantity}</span>
                      </td>
                      <td className="px-5 py-4">
                        <span className="text-sm text-[#D4AF37] font-medium">
                          {formatCurrency((item.product?.price || 0) * item.quantity)}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <span className="text-sm text-white/50">{formatDate(item.created_at)}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function StatCard({ icon: Icon, label, value, color }: { 
  icon: React.ElementType; label: string; value: string | number; color: string;
}) {
  const colors: Record<string, { bg: string; text: string }> = {
    white: { bg: 'bg-white/5', text: 'text-white' },
    blue: { bg: 'bg-blue-500/10', text: 'text-blue-400' },
    amber: { bg: 'bg-amber-500/10', text: 'text-amber-400' },
    gold: { bg: 'bg-[#D4AF37]/10', text: 'text-[#D4AF37]' },
    purple: { bg: 'bg-purple-500/10', text: 'text-purple-400' },
  };
  return (
    <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-4 hover:border-white/10 transition-colors">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-white/40">{label}</span>
        <div className={`w-8 h-8 rounded-lg ${colors[color]?.bg} flex items-center justify-center`}>
          <Icon className={`w-3.5 h-3.5 ${colors[color]?.text}`} />
        </div>
      </div>
      <p className="text-xl font-semibold">{value}</p>
    </div>
  );
}
