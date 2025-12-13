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
  FaMapMarkerAlt,
  FaFilter,
  FaTimes,
  FaPlus,
  FaMinus,
  FaUser,
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
  { icon: FaShoppingBag, label: "Shopr", href: "/app/shopr", active: true },
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

export default function ShoprPage() {
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
        console.warn("[shopr] fetchProducts error", error);
        setProducts([]);
        return;
      }

      // Get unique user IDs
      const userIds = Array.from(new Set((data ?? []).map((p) => p.user_id).filter(Boolean)));
      
      // Fetch profiles
      const profilesMap: Record<string, Profile> = {};
      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, username, full_name, avatar_url")
          .in("id", userIds);
        
        (profiles ?? []).forEach((p) => {
          profilesMap[p.id] = p;
        });
      }

      // Map products with profiles
      const mapped = (data ?? []).map((p) => ({
        ...p,
        profile: profilesMap[p.user_id] || null,
      }));

      setProducts(mapped);
    } catch (err) {
      console.warn("[shopr] fetchProducts exception", err);
      setProducts([]);
    } finally {
      setProductsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!loading) {
      fetchProducts();
    }
  }, [loading, fetchProducts]);

  const filteredProducts = products.filter((p) => {
    const matchesSearch = p.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.description?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = activeCategory === "all" || p.category === activeCategory;
    return matchesSearch && matchesCategory;
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

  const removeFromCart = (productId: string) => {
    setCart((prev) => prev.filter((item) => item.product.id !== productId));
  };

  const updateQuantity = (productId: string, delta: number) => {
    setCart((prev) =>
      prev.map((item) => {
        if (item.product.id === productId) {
          const newQty = Math.max(1, item.quantity + delta);
          return { ...item, quantity: newQty };
        }
        return item;
      })
    );
  };

  const cartTotal = cart.reduce((sum, item) => sum + item.product.price * item.quantity, 0);
  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);

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
        <aside className="fixed left-0 top-0 h-screen w-64 bg-black border-r border-white/10 p-6 flex flex-col z-40">
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

          {/* Cart Button */}
          <button
            onClick={() => setShowCart(true)}
            className="w-full py-3 rounded-xl font-semibold flex items-center justify-center gap-2 mb-4 transition hover:opacity-90 relative"
            style={{ backgroundColor: VELT_ACCENT, color: "#000" }}
          >
            <FaShoppingBag size={16} />
            View Cart
            {cartCount > 0 && (
              <span className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
                {cartCount}
              </span>
            )}
          </button>

          <div className="border-t border-white/10 pt-4">
            <Link
              href="/app/profile"
              className="flex items-center gap-4 px-4 py-3 w-full text-left text-white/60 hover:text-white transition rounded-xl hover:bg-white/5"
            >
              <FaUser size={20} />
              <span>Profile</span>
            </Link>
          </div>
        </aside>

        {/* Main Content */}
        <main className="ml-64 flex-1 min-h-screen p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-3xl font-bold">Shopr</h1>
              <p className="text-white/60">Discover products from creators</p>
            </div>
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 transition"
            >
              <FaFilter size={16} />
              Filters
            </button>
          </div>

          {/* Search */}
          <div className="relative mb-6">
            <FaSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40" />
            <input
              type="text"
              placeholder="Search products..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-12 pr-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/40 focus:outline-none focus:border-white/30"
            />
          </div>

          {/* Categories */}
          <div className="flex gap-3 overflow-x-auto pb-4 mb-6 scrollbar-hide">
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-full whitespace-nowrap transition ${
                  activeCategory === cat.id
                    ? "text-black"
                    : "bg-white/5 text-white/60 hover:bg-white/10"
                }`}
                style={activeCategory === cat.id ? { backgroundColor: VELT_ACCENT } : {}}
              >
                <span>{cat.icon}</span>
                {cat.label}
              </button>
            ))}
          </div>

          {/* Products Grid */}
          {productsLoading ? (
            <div className="flex justify-center py-12">
              <div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin" />
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="text-center py-12">
              <FaShoppingBag size={48} className="mx-auto text-white/20 mb-4" />
              <h3 className="text-xl font-semibold mb-2">No Products Found</h3>
              <p className="text-white/60">
                {searchQuery ? "Try a different search term" : "Check back later for new products"}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
              {filteredProducts.map((product, index) => (
                <motion.div
                  key={product.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  onClick={() => setSelectedProduct(product)}
                  className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden cursor-pointer hover:border-white/20 transition group"
                >
                  <div className="aspect-square bg-gradient-to-br from-white/10 to-white/5 relative overflow-hidden">
                    {product.images && product.images.length > 0 ? (
                      <img
                        src={product.images[0]}
                        alt={product.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <FaShoppingBag size={32} className="text-white/20" />
                      </div>
                    )}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        addToCart(product);
                      }}
                      className="absolute bottom-3 right-3 w-10 h-10 rounded-full flex items-center justify-center text-black transition hover:scale-110"
                      style={{ backgroundColor: VELT_ACCENT }}
                    >
                      <FaPlus size={14} />
                    </button>
                  </div>
                  <div className="p-4">
                    <h3 className="font-semibold mb-1 truncate">{product.title}</h3>
                    <p className="text-lg font-bold" style={{ color: VELT_ACCENT }}>
                      GHS {product.price.toLocaleString()}
                    </p>
                    {product.location && (
                      <p className="text-xs text-white/40 flex items-center gap-1 mt-1">
                        <FaMapMarkerAlt size={10} />
                        {product.location}
                      </p>
                    )}
                  </div>
                </motion.div>
              ))}
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
            <div className="relative">
              <div className="aspect-video bg-gradient-to-br from-white/10 to-white/5">
                {selectedProduct.images && selectedProduct.images.length > 0 ? (
                  <img
                    src={selectedProduct.images[0]}
                    alt={selectedProduct.title}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <FaShoppingBag size={64} className="text-white/20" />
                  </div>
                )}
              </div>
              <button
                onClick={() => setSelectedProduct(null)}
                className="absolute top-4 right-4 w-10 h-10 bg-black/60 rounded-full flex items-center justify-center text-white hover:bg-black/80 transition"
              >
                <FaTimes size={18} />
              </button>
            </div>
            <div className="p-6">
              <h2 className="text-2xl font-bold mb-2">{selectedProduct.title}</h2>
              <p className="text-2xl font-bold mb-4" style={{ color: VELT_ACCENT }}>
                GHS {selectedProduct.price.toLocaleString()}
              </p>
              {selectedProduct.description && (
                <p className="text-white/70 mb-4">{selectedProduct.description}</p>
              )}
              {selectedProduct.location && (
                <p className="text-sm text-white/60 flex items-center gap-2 mb-4">
                  <FaMapMarkerAlt />
                  {selectedProduct.location}
                </p>
              )}
              {selectedProduct.profile && (
                <div className="flex items-center gap-3 p-3 bg-white/5 rounded-xl mb-6">
                  <div className="w-10 h-10 rounded-full overflow-hidden" style={{ backgroundColor: VELT_ACCENT }}>
                    {selectedProduct.profile.avatar_url ? (
                      <img src={selectedProduct.profile.avatar_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-black font-bold">
                        {(selectedProduct.profile.full_name || selectedProduct.profile.username || "?").charAt(0).toUpperCase()}
                      </div>
                    )}
                  </div>
                  <div>
                    <p className="font-semibold">{selectedProduct.profile.full_name || selectedProduct.profile.username}</p>
                    <p className="text-xs text-white/60">Seller</p>
                  </div>
                </div>
              )}
              <button
                onClick={() => {
                  addToCart(selectedProduct);
                  setSelectedProduct(null);
                }}
                className="w-full py-3 rounded-xl font-semibold transition hover:opacity-90"
                style={{ backgroundColor: VELT_ACCENT, color: "#000" }}
              >
                Add to Cart
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Cart Drawer */}
      {showCart && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex justify-end">
          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            className="w-full max-w-md bg-gray-900 border-l border-white/10 h-full flex flex-col"
          >
            <div className="p-6 border-b border-white/10 flex items-center justify-between">
              <h2 className="text-xl font-bold">Your Cart ({cartCount})</h2>
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
                  <FaShoppingBag size={48} className="mx-auto text-white/20 mb-4" />
                  <p className="text-white/60">Your cart is empty</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {cart.map((item) => (
                    <div
                      key={item.product.id}
                      className="flex gap-4 p-4 bg-white/5 rounded-xl"
                    >
                      <div className="w-20 h-20 rounded-lg overflow-hidden flex-shrink-0">
                        {item.product.images && item.product.images.length > 0 ? (
                          <img
                            src={item.product.images[0]}
                            alt={item.product.title}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full bg-white/10 flex items-center justify-center">
                            <FaShoppingBag className="text-white/20" />
                          </div>
                        )}
                      </div>
                      <div className="flex-1">
                        <h4 className="font-semibold mb-1">{item.product.title}</h4>
                        <p className="text-sm" style={{ color: VELT_ACCENT }}>
                          GHS {item.product.price.toLocaleString()}
                        </p>
                        <div className="flex items-center gap-2 mt-2">
                          <button
                            onClick={() => updateQuantity(item.product.id, -1)}
                            className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition"
                          >
                            <FaMinus size={10} />
                          </button>
                          <span className="w-8 text-center">{item.quantity}</span>
                          <button
                            onClick={() => updateQuantity(item.product.id, 1)}
                            className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition"
                          >
                            <FaPlus size={10} />
                          </button>
                          <button
                            onClick={() => removeFromCart(item.product.id)}
                            className="ml-auto text-red-400 hover:text-red-300 transition"
                          >
                            <FaTimes size={14} />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            {cart.length > 0 && (
              <div className="p-6 border-t border-white/10">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-white/60">Total</span>
                  <span className="text-2xl font-bold" style={{ color: VELT_ACCENT }}>
                    GHS {cartTotal.toLocaleString()}
                  </span>
                </div>
                <button
                  className="w-full py-3 rounded-xl font-semibold transition hover:opacity-90"
                  style={{ backgroundColor: VELT_ACCENT, color: "#000" }}
                >
                  Proceed to Checkout
                </button>
              </div>
            )}
          </motion.div>
        </div>
      )}
    </div>
  );
}
