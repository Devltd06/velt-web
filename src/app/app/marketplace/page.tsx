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
  FaSearch,
  FaHeart,
  FaShoppingBag,
  FaStar,
  FaMapMarkerAlt,
  FaFilter,
  FaTimes,
  FaPlus,
  FaMinus,
} from "react-icons/fa";
import { supabase } from "@/lib/supabaseClient";

const VELT_ACCENT = "#D4AF37";

const navItems = [
  { icon: FaHome, label: "Home", href: "/app/home" },
  { icon: FaCompass, label: "Explore", href: "/app/explore" },
  { icon: FaShoppingCart, label: "Marketplace", href: "/app/marketplace", active: true },
  { icon: FaBullhorn, label: "Billboards", href: "/app/billboards" },
  { icon: FaUser, label: "Profile", href: "/app/profile" },
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

const mockProducts = [
  {
    id: 1,
    name: "Wireless Bluetooth Earbuds",
    price: 150,
    originalPrice: 200,
    seller: "Tech Store GH",
    rating: 4.8,
    reviews: 234,
    location: "Accra",
    category: "electronics",
    inStock: true,
  },
  {
    id: 2,
    name: "African Print Dress",
    price: 280,
    seller: "Style Ghana",
    rating: 4.9,
    reviews: 156,
    location: "Kumasi",
    category: "fashion",
    inStock: true,
  },
  {
    id: 3,
    name: "Organic Shea Butter",
    price: 45,
    seller: "Natural Beauty",
    rating: 4.7,
    reviews: 89,
    location: "Tamale",
    category: "beauty",
    inStock: true,
  },
  {
    id: 4,
    name: "Handwoven Basket Set",
    price: 120,
    seller: "Craft Village",
    rating: 4.6,
    reviews: 67,
    location: "Bolgatanga",
    category: "home",
    inStock: false,
  },
  {
    id: 5,
    name: "Fresh Palm Oil (5L)",
    price: 85,
    seller: "Farm Fresh",
    rating: 4.5,
    reviews: 312,
    location: "Takoradi",
    category: "food",
    inStock: true,
  },
  {
    id: 6,
    name: "Smartphone Repair Service",
    price: 50,
    seller: "Fix It Ghana",
    rating: 4.8,
    reviews: 445,
    location: "Accra",
    category: "services",
    inStock: true,
  },
  {
    id: 7,
    name: "Kente Cloth (6 yards)",
    price: 450,
    seller: "Kente Masters",
    rating: 5.0,
    reviews: 78,
    location: "Bonwire",
    category: "fashion",
    inStock: true,
  },
  {
    id: 8,
    name: "Solar Power Bank 20000mAh",
    price: 180,
    originalPrice: 220,
    seller: "Green Energy GH",
    rating: 4.6,
    reviews: 123,
    location: "Tema",
    category: "electronics",
    inStock: true,
  },
];

export default function MarketplacePage() {
  const router = useRouter();
  const [, setUser] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState("all");
  const [showFilters, setShowFilters] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<typeof mockProducts[0] | null>(null);
  const [cart, setCart] = useState<{ product: typeof mockProducts[0]; quantity: number }[]>([]);
  const [showCart, setShowCart] = useState(false);

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

  const filteredProducts = mockProducts.filter((product) => {
    const matchesCategory = activeCategory === "all" || product.category === activeCategory;
    const matchesSearch = product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      product.seller.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const addToCart = (product: typeof mockProducts[0]) => {
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

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const removeFromCart = (productId: number) => {
    setCart((prev) => prev.filter((item) => item.product.id !== productId));
  };

  const updateQuantity = (productId: number, delta: number) => {
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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredProducts.map((product, index) => (
              <motion.div
                key={product.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden hover:border-white/20 transition cursor-pointer group"
                onClick={() => setSelectedProduct(product)}
              >
                {/* Image */}
                <div className="aspect-square bg-gradient-to-br from-white/10 to-white/5 relative">
                  <div className="absolute inset-0 flex items-center justify-center">
                    <FaShoppingBag size={32} className="text-white/20" />
                  </div>
                  {product.originalPrice && (
                    <div className="absolute top-3 left-3 bg-red-500 text-white text-xs px-2 py-1 rounded-full">
                      {Math.round((1 - product.price / product.originalPrice) * 100)}% OFF
                    </div>
                  )}
                  {!product.inStock && (
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
                  <h3 className="font-medium mb-1 line-clamp-2">{product.name}</h3>
                  <p className="text-sm text-white/60 mb-2">{product.seller}</p>
                  <div className="flex items-center gap-2 mb-3">
                    <div className="flex items-center gap-1">
                      <FaStar size={12} style={{ color: VELT_ACCENT }} />
                      <span className="text-sm">{product.rating}</span>
                    </div>
                    <span className="text-white/40 text-sm">({product.reviews})</span>
                    <span className="text-white/40">•</span>
                    <span className="text-white/40 text-sm flex items-center gap-1">
                      <FaMapMarkerAlt size={10} />
                      {product.location}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-bold" style={{ color: VELT_ACCENT }}>
                        {formatCurrency(product.price)}
                      </span>
                      {product.originalPrice && (
                        <span className="text-white/40 text-sm line-through ml-2">
                          {formatCurrency(product.originalPrice)}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
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
              <h2 className="text-xl font-bold">{selectedProduct.name}</h2>
              <button
                onClick={() => setSelectedProduct(null)}
                className="text-white/60 hover:text-white transition"
              >
                <FaTimes size={20} />
              </button>
            </div>
            <div className="p-6">
              {/* Image */}
              <div className="aspect-video bg-gradient-to-br from-white/10 to-white/5 rounded-xl flex items-center justify-center mb-6">
                <FaShoppingBag size={48} className="text-white/20" />
              </div>

              {/* Info */}
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="bg-white/5 rounded-xl p-4">
                  <p className="text-white/60 text-sm mb-1">Seller</p>
                  <p className="font-medium">{selectedProduct.seller}</p>
                </div>
                <div className="bg-white/5 rounded-xl p-4">
                  <p className="text-white/60 text-sm mb-1">Location</p>
                  <p className="font-medium">{selectedProduct.location}</p>
                </div>
                <div className="bg-white/5 rounded-xl p-4">
                  <p className="text-white/60 text-sm mb-1">Rating</p>
                  <p className="font-medium flex items-center gap-1">
                    <FaStar style={{ color: VELT_ACCENT }} />
                    {selectedProduct.rating} ({selectedProduct.reviews} reviews)
                  </p>
                </div>
                <div className="bg-white/5 rounded-xl p-4">
                  <p className="text-white/60 text-sm mb-1">Availability</p>
                  <p className={`font-medium ${selectedProduct.inStock ? "text-green-400" : "text-red-400"}`}>
                    {selectedProduct.inStock ? "In Stock" : "Out of Stock"}
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
                    {selectedProduct.originalPrice && (
                      <p className="text-white/40 line-through">
                        {formatCurrency(selectedProduct.originalPrice)}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Add to Cart */}
              {selectedProduct.inStock && (
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
                  {cart.map((item) => (
                    <div
                      key={item.product.id}
                      className="bg-white/5 rounded-xl p-4 flex items-center gap-4"
                    >
                      <div className="w-16 h-16 bg-white/10 rounded-lg flex items-center justify-center flex-shrink-0">
                        <FaShoppingBag className="text-white/30" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-medium truncate">{item.product.name}</h4>
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
                  ))}
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
