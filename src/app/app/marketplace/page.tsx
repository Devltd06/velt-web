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
  FaSearch,
  FaHeart,
  FaMapMarkerAlt,
  FaFilter,
  FaTimes,
  FaPlus,
  FaMinus,
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

interface Product {
  id: string;
  user_id: string;
  title: string;
  description?: string | null;
  price: number;
  images?: string[] | null;
  category?: string | null;
  stock_quantity?: number | null;
  location?: string | null;
  created_at: string;
  profile?: Profile | null;
}

// Navigation items matching mobile: Home, Shopr, Contents, Billboards, Chats
const navItems = [
  { icon: FaHome, label: "Home", href: "/app/home" },
  { icon: FaShoppingBag, label: "Shopr", href: "/app/shopr" },
  { icon: FaPlayCircle, label: "Contents", href: "/app/contents" },
  { icon: FaBullhorn, label: "Billboards", href: "/app/billboards" },
  { icon: FaComments, label: "Chats", href: "/app/chats" },
];

const categories = [
  { id: "all", label: "All Products", icon: "🛍️" },
  { id: "electronics", label: "Electronics", icon: "📱" },
  { id: "fashion", label: "Fashion", icon: "👗" },
  { id: "food", label: "Food & Groceries", icon: "🍎" },
  { id: "home", label: "Home & Living", icon: "🏠" },
  { id: "beauty", label: "Beauty", icon: "💄" },
  { id: "services", label: "Services", icon: "🔧" },
];

export default function MarketplacePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [productsLoading, setProductsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState("all");
  const [showFilters, setShowFilters] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [cart, setCart] = useState<{ product: Product; quantity: number }[]>([]);
  const [showCart, setShowCart] = useState(false);

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push("/app/welcome");
        return;
      }
      setLoading(false);
    };
    checkAuth();
  }, [router]);

  // Fetch products
  const fetchProducts = useCallback(async () => {
    setProductsLoading(true);
    try {
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) {
        console.warn("[marketplace] fetchProducts err", error);
        setProducts([]);
        return;
      }

      // Get profiles for product sellers
      const userIds = Array.from(new Set((data || []).map((p) => p.user_id).filter(Boolean)));
      const profilesMap: Record<string, Profile> = {};

      if (userIds.length > 0) {
        const { data: profRows } = await supabase
          .from("profiles")
          .select("id, username, full_name, avatar_url")
          .in("id", userIds);

        (profRows || []).forEach((p) => {
          profilesMap[p.id] = p;
        });
      }

      const productsWithProfiles = (data || []).map((p) => ({
        ...p,
        profile: profilesMap[p.user_id] || null,
      }));

      setProducts(productsWithProfiles);
    } catch (err) {
      console.warn("[marketplace] fetchProducts exception", err);
      setProducts([]);
    } finally {
      setProductsLoading(false);
    }
  }, []);

  // Load data on mount
  useEffect(() => {
    if (!loading) {
      fetchProducts();
    }
  }, [loading, fetchProducts]);

  // Filter products
  const filteredProducts = products.filter((product) => {
    const matchesCategory = activeCategory === "all" || product.category === activeCategory;
    const matchesSearch = 
      product.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      product.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      product.profile?.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      product.profile?.username?.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const addToCart = (product: Product) => {
    setCart((prev) => {
      const existing = prev.find((item) => item.product.id === product.id);
      if (existing) {
        return prev.map((item) =>
          item.product.id === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }
      return [...prev, { product, quantity: 1 }];
    });
  };

  const updateQuantity = (productId: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((item) =>
          item.product.id === productId
            ? { ...item, quantity: Math.max(0, item.quantity + delta) }
            : item
        )
        .filter((item) => item.quantity > 0)
    );
  };

  const cartTotal = cart.reduce((sum, item) => sum + item.product.price * item.quantity, 0);

  const formatCurrency = (value: number) => `GHS ${value.toLocaleString()}`;

  const getProductImage = (product: Product) => {
    if (product.images && product.images.length > 0) {
      return product.images[0];
    }
    return null;
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
              const isActive = item.href === "/app/shopr";
              return (
                <Link
                  key={item.label}
                  href={item.href}
                  className={`flex items-center gap-4 px-4 py-3 rounded-xl transition ${
                    isActive
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
              <h1 className="text-3xl font-bold mb-2">Marketplace</h1>
              <p className="text-white/60">Buy and sell local goods with confidence</p>
            </div>
            <div className="flex items-center gap-4">
              <button
                onClick={() => setShowFilters(!showFilters)}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 transition"
              >
                <FaFilter size={16} />
                Filters
              </button>
              <button
                onClick={() => setShowCart(true)}
                className="relative flex items-center gap-2 px-4 py-2 rounded-xl transition"
                style={{ backgroundColor: VELT_ACCENT, color: "#000" }}
              >
                <FaShoppingBag size={16} />
                Cart
                {cart.length > 0 && (
                  <span className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
                    {cart.length}
                  </span>
                )}
              </button>
            </div>
          </div>

          {/* Search */}
          <div className="max-w-2xl mb-6">
            <div className="relative">
              <FaSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search products, sellers..."
                className="w-full pl-12 pr-4 py-4 bg-white/5 border border-white/10 rounded-2xl text-white placeholder-white/40 focus:outline-none focus:border-white/30 transition"
              />
            </div>
          </div>

          {/* Categories */}
          <div className="flex gap-3 mb-8 overflow-x-auto pb-2">
            {categories.map((category) => (
              <button
                key={category.id}
                onClick={() => setActiveCategory(category.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl whitespace-nowrap transition ${
                  activeCategory === category.id
                    ? "text-black"
                    : "bg-white/5 text-white/70 hover:bg-white/10"
                }`}
                style={activeCategory === category.id ? { backgroundColor: VELT_ACCENT } : {}}
              >
                <span>{category.icon}</span>
                <span className="font-medium">{category.label}</span>
              </button>
            ))}
          </div>

          {/* Products Grid */}
          {productsLoading ? (
            <div className="flex justify-center py-20">
              <div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin" />
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="text-center py-20">
              <FaShoppingBag size={48} className="text-white/20 mx-auto mb-4" />
              <p className="text-white/60">
                {searchQuery ? "No products found" : "No products available yet"}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {filteredProducts.map((product, index) => {
                const imageUrl = getProductImage(product);
                const inStock = product.stock_quantity == null || product.stock_quantity > 0;
                
                return (
                  <motion.div
                    key={product.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden hover:border-white/20 transition cursor-pointer group"
                    onClick={() => setSelectedProduct(product)}
                  >
                    {/* Image */}
                    <div className="aspect-square bg-gradient-to-br from-white/10 to-white/5 relative overflow-hidden">
                      {imageUrl ? (
                        <img 
                          src={imageUrl} 
                          alt={product.title} 
                          className="absolute inset-0 w-full h-full object-cover"
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display = "none";
                          }}
                        />
                      ) : (
                        <div className="absolute inset-0 flex items-center justify-center">
                          <FaShoppingBag size={32} className="text-white/20" />
                        </div>
                      )}
                      {!inStock && (
                        <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                          <span className="text-white/80 font-medium">Out of Stock</span>
                        </div>
                      )}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                        }}
                        className="absolute top-3 right-3 w-8 h-8 bg-black/40 rounded-full flex items-center justify-center text-white/60 hover:text-red-400 transition"
                      >
                        <FaHeart size={14} />
                      </button>
                    </div>

                    {/* Details */}
                    <div className="p-4">
                      <h3 className="font-medium mb-1 line-clamp-2">{product.title}</h3>
                      <p className="text-sm text-white/60 mb-2">
                        {product.profile?.full_name || product.profile?.username || "Seller"}
                      </p>
                      <div className="flex items-center gap-2 mb-3">
                        {product.location && (
                          <span className="text-white/40 text-sm flex items-center gap-1">
                            <FaMapMarkerAlt size={10} />
                            {product.location}
                          </span>
                        )}
                        {product.category && (
                          <>
                            {product.location && <span className="text-white/40">•</span>}
                            <span className="text-white/40 text-sm">{product.category}</span>
                          </>
                        )}
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="font-bold" style={{ color: VELT_ACCENT }}>
                          {formatCurrency(product.price)}
                        </span>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </main>
      </div>

      {/* Product Detail Modal */}
      {selectedProduct && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-6">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-gray-900 border border-white/10 rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
          >
            <div className="p-6 border-b border-white/10 flex items-center justify-between">
              <h2 className="text-xl font-bold">{selectedProduct.title}</h2>
              <button
                onClick={() => setSelectedProduct(null)}
                className="text-white/60 hover:text-white transition"
              >
                <FaTimes size={20} />
              </button>
            </div>
            <div className="p-6">
              {/* Image */}
              <div className="aspect-video bg-gradient-to-br from-white/10 to-white/5 rounded-xl flex items-center justify-center mb-6 overflow-hidden">
                {getProductImage(selectedProduct) ? (
                  <img 
                    src={getProductImage(selectedProduct)!} 
                    alt={selectedProduct.title}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <FaShoppingBag size={48} className="text-white/20" />
                )}
              </div>

              {/* Description */}
              {selectedProduct.description && (
                <p className="text-white/70 mb-6">{selectedProduct.description}</p>
              )}

              {/* Info */}
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="bg-white/5 rounded-xl p-4">
                  <p className="text-white/60 text-sm mb-1">Seller</p>
                  <p className="font-medium">
                    {selectedProduct.profile?.full_name || selectedProduct.profile?.username || "Unknown"}
                  </p>
                </div>
                <div className="bg-white/5 rounded-xl p-4">
                  <p className="text-white/60 text-sm mb-1">Location</p>
                  <p className="font-medium">{selectedProduct.location || "Not specified"}</p>
                </div>
                <div className="bg-white/5 rounded-xl p-4">
                  <p className="text-white/60 text-sm mb-1">Category</p>
                  <p className="font-medium">{selectedProduct.category || "General"}</p>
                </div>
                <div className="bg-white/5 rounded-xl p-4">
                  <p className="text-white/60 text-sm mb-1">Availability</p>
                  <p className={`font-medium ${
                    selectedProduct.stock_quantity == null || selectedProduct.stock_quantity > 0
                      ? "text-green-400"
                      : "text-red-400"
                  }`}>
                    {selectedProduct.stock_quantity == null || selectedProduct.stock_quantity > 0
                      ? "In Stock"
                      : "Out of Stock"}
                  </p>
                </div>
              </div>

              {/* Price */}
              <div className="bg-white/5 rounded-xl p-6 mb-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-white/60 text-sm mb-1">Price</p>
                    <p className="text-3xl font-bold" style={{ color: VELT_ACCENT }}>
                      {formatCurrency(selectedProduct.price)}
                    </p>
                  </div>
                </div>
              </div>

              {/* Add to Cart */}
              {(selectedProduct.stock_quantity == null || selectedProduct.stock_quantity > 0) && (
                <button
                  onClick={() => {
                    addToCart(selectedProduct);
                    setSelectedProduct(null);
                  }}
                  className="w-full py-4 rounded-xl font-semibold flex items-center justify-center gap-2 transition hover:opacity-90"
                  style={{ backgroundColor: VELT_ACCENT, color: "#000" }}
                >
                  <FaShoppingBag />
                  Add to Cart
                </button>
              )}
            </div>
          </motion.div>
        </div>
      )}

      {/* Cart Sidebar */}
      {showCart && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex justify-end">
          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            className="w-full max-w-md bg-gray-900 border-l border-white/10 h-full flex flex-col"
          >
            <div className="p-6 border-b border-white/10 flex items-center justify-between">
              <h2 className="text-xl font-bold">Shopping Cart</h2>
              <button
                onClick={() => setShowCart(false)}
                className="text-white/60 hover:text-white transition"
              >
                <FaTimes size={20} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6">
              {cart.length === 0 ? (
                <div className="text-center py-12">
                  <FaShoppingBag size={48} className="text-white/20 mx-auto mb-4" />
                  <p className="text-white/60">Your cart is empty</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {cart.map((item) => {
                    const imageUrl = getProductImage(item.product);
                    return (
                      <div
                        key={item.product.id}
                        className="bg-white/5 rounded-xl p-4 flex items-center gap-4"
                      >
                        <div className="w-16 h-16 bg-white/10 rounded-lg flex items-center justify-center flex-shrink-0 overflow-hidden">
                          {imageUrl ? (
                            <img src={imageUrl} alt={item.product.title} className="w-full h-full object-cover" />
                          ) : (
                            <FaShoppingBag className="text-white/30" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="font-medium truncate">{item.product.title}</h4>
                          <p className="text-sm" style={{ color: VELT_ACCENT }}>
                            {formatCurrency(item.product.price)}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => updateQuantity(item.product.id, -1)}
                            className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition"
                          >
                            <FaMinus size={12} />
                          </button>
                          <span className="w-8 text-center">{item.quantity}</span>
                          <button
                            onClick={() => updateQuantity(item.product.id, 1)}
                            className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition"
                          >
                            <FaPlus size={12} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
            {cart.length > 0 && (
              <div className="p-6 border-t border-white/10">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-white/60">Total</span>
                  <span className="text-2xl font-bold" style={{ color: VELT_ACCENT }}>
                    {formatCurrency(cartTotal)}
                  </span>
                </div>
                <button
                  className="w-full py-4 rounded-xl font-semibold transition hover:opacity-90"
                  style={{ backgroundColor: VELT_ACCENT, color: "#000" }}
                >
                  Checkout
                </button>
              </div>
            )}
          </motion.div>
        </div>
      )}
    </div>
  );
}
