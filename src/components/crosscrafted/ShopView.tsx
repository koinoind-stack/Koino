"use client";

import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Star,
  Heart,
  Plus,
  Search,
  X,
  ShoppingCart,
  Store,
  MapPin,
  Truck,
  Phone,
  IndianRupee,
  Tag,
  Palette,
} from "lucide-react";
import { toast } from "sonner";
import {
  PRODUCTS,
  CHURCH_GRADIENTS,
  INDIAN_STATES,
  getCitiesForState,
  MARKETPLACE_CATEGORIES,
  type Product,
  type ProductVariation,
  type ProductAttribute,
} from "@/lib/crosscrafted-data";
import { useTranslation } from "@/lib/i18n/LanguageContext";
import ImagePicker from "@/components/crosscrafted/ImagePicker";
import { ImageOff, ExternalLink, BadgeCheck, Store as StoreIcon, Globe } from "lucide-react";

// Single source of truth — pulled from crosscrafted-data so the List Item form,
// the filter pills, and the admin product form all share the same list.
const CATEGORIES = ["All", ...MARKETPLACE_CATEGORIES];

const StarRating = ({ rating, size = 11 }: { rating: number; size?: number }) => (
  <div className="flex items-center gap-0.5">
    {[1, 2, 3, 4, 5].map((n) => (
      <Star
        key={n}
        size={size}
        className={n <= Math.round(rating) ? "text-[#F59E0B]" : "text-white/15"}
        fill={n <= Math.round(rating) ? "currentColor" : "none"}
      />
    ))}
  </div>
);

const WhatsAppIcon = ({ size = 18 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
    <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z"/>
  </svg>
);

export default function ShopView() {
  const t = useTranslation();
  const [products, setProducts] = useState<Product[]>(PRODUCTS);
  const [wishlist, setWishlist] = useState<Set<string>>(new Set());
  const [cart, setCart] = useState<Set<string>>(new Set());
  const [activeCategory, setActiveCategory] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [filterState, setFilterState] = useState("");
  const [filterCity, setFilterCity] = useState("");
  const [filterSellerType, setFilterSellerType] = useState<"all" | "believ" | "marketplace">("all");
  const [openProduct, setOpenProduct] = useState<Product | null>(null);
  const [activeImageIdx, setActiveImageIdx] = useState(0);
  const [selectedVariations, setSelectedVariations] = useState<Record<string, string>>({});
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    price: "",
    mrp: "",
    category: "Bibles",
    vendor: "",
    city: "",
    state: "",
    buyUrl: "",
    images: [] as string[],
    whatsapp_number: "",
    variations: [] as ProductVariation[],
    attributes: [] as ProductAttribute[],
  });

  const handleCreateProduct = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.price || !formData.whatsapp_number) {
      toast.error("Please fill in name, price, and WhatsApp number");
      return;
    }
    if (formData.variations.some((v) => v.name.trim() && v.options.length === 0)) {
      toast.error("Add at least 1 option for each variation name");
      return;
    }
    const newProduct: Product = {
      id: `pr${Date.now()}`,
      name: formData.name,
      description: formData.description,
      price: Number(formData.price),
      mrp: formData.mrp ? Number(formData.mrp) : Number(formData.price),
      category: formData.category,
      vendor: formData.vendor || "Individual Seller",
      sellerType: "marketplace", // user-submitted products are always marketplace (not official Koino Store)
      state: formData.state || "",
      city: formData.city || "—",
      rating: 0,
      reviews: 0,
      cover_gradient: Math.floor(Math.random() * CHURCH_GRADIENTS.length),
      cover_image: formData.images[0] || undefined,
      images: formData.images.length > 0 ? formData.images : undefined,
      in_stock: true,
      whatsapp_number: formData.whatsapp_number,
      buyUrl: formData.buyUrl || undefined,
      status: "published",
      featured: false,
      variations: formData.variations
        .filter((v) => v.name.trim() && v.options.length > 0)
        .map((v) => ({ name: v.name.trim(), options: v.options })),
      attributes: formData.attributes
        .filter((a) => a.label.trim() && a.value.trim())
        .map((a) => ({ label: a.label.trim(), value: a.value.trim() })),
    };
    setProducts([newProduct, ...products]);
    setFormData({
      name: "",
      description: "",
      price: "",
      mrp: "",
      category: "Bibles",
      vendor: "",
      city: "",
      state: "",
      buyUrl: "",
      images: [],
      whatsapp_number: "",
      variations: [],
      attributes: [],
    });
    setShowCreateModal(false);
    toast.success("Product listed!", {
      description: "Buyers can now contact you on WhatsApp to purchase.",
    });
  };

  const filtered = useMemo(() => {
    return products.filter((p) => {
      if (activeCategory !== "All" && p.category !== activeCategory) return false;
      if (filterSellerType !== "all" && p.sellerType !== filterSellerType) return false;
      if (filterState && p.state !== filterState) return false;
      if (filterCity && p.city !== filterCity) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const haystack = `${p.name} ${p.description} ${p.vendor} ${p.category} ${p.subcategory || ""} ${p.state} ${p.city}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [products, activeCategory, filterSellerType, filterState, filterCity, searchQuery]);

  const toggleWishlist = (id: string) => {
    setWishlist((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
        toast("Removed from wishlist");
      } else {
        next.add(id);
        toast.success("Added to wishlist!");
      }
      return next;
    });
  };

  const addToCart = (p: Product) => {
    setCart((prev) => {
      const next = new Set(prev);
      next.add(p.id);
      return next;
    });
    toast.success(`Added "${p.name}" to cart!`, {
      description: "Contact vendor on WhatsApp to checkout.",
    });
  };

  return (
    <div className="max-w-[680px] mx-auto px-4 py-5 pb-28 md:pb-5">
      <div className="flex justify-between items-center mb-4">
        <div>
          <h1 className="text-xl font-bold text-white">{t('marketplace.title')}</h1>
          <p className="text-xs text-[#94A3B8] mt-0.5">{t('marketplace.subtitle')}</p>
        </div>
        <div className="flex items-center gap-2">
          {cart.size > 0 && (
            <button className="relative flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-[#22C55E]/15 border border-[#22C55E]/30 text-[#22C55E]">
              <ShoppingCart size={14} />
              Cart
              <span className="w-4 h-4 rounded-full bg-[#22C55E] text-slate-950 text-[9px] flex items-center justify-center font-bold">
                {cart.size}
              </span>
            </button>
          )}
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-[12px] font-semibold text-white transition-all hover:-translate-y-px"
            style={{ background: "linear-gradient(135deg, #9786E3, #38BDF8)" }}
          >
            <Plus size={14} /> {t('marketplace.listItem')}
          </button>
        </div>
      </div>

      {/* Search */}
      <input
        type="text"
        placeholder={t('marketplace.search')}
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        className="neo-input text-sm mb-3"
      />

      {/* Categories */}
      <div className="flex gap-2 overflow-x-auto pb-3 -mx-4 px-4 mb-2">
        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
              activeCategory === cat
                ? "bg-[#9786E3] text-white"
                : "bg-white/[0.04] text-[#94A3B8] hover:text-white border border-white/[0.06]"
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* ─── SELLER TYPE + STATE / CITY FILTER ROW ─── */}
      <div className="mb-3">
        <div className="flex p-1 bg-white/[0.04] border border-white/[0.06] rounded-2xl mb-2">
          <button
            onClick={() => setFilterSellerType("all")}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-[11px] font-bold transition-all ${
              filterSellerType === "all"
                ? "bg-gradient-to-r from-[#9786E3] to-[#38BDF8] text-white shadow-lg shadow-[#9786E3]/20"
                : "text-[#94A3B8] hover:text-white"
            }`}
          >
            <StoreIcon size={12} /> All
          </button>
          <button
            onClick={() => setFilterSellerType("believ")}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-[11px] font-bold transition-all ${
              filterSellerType === "believ"
                ? "bg-gradient-to-r from-[#9786E3] to-[#38BDF8] text-white shadow-lg shadow-[#9786E3]/20"
                : "text-[#94A3B8] hover:text-white"
            }`}
          >
            <BadgeCheck size={12} /> Koino Store
          </button>
          <button
            onClick={() => setFilterSellerType("marketplace")}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-[11px] font-bold transition-all ${
              filterSellerType === "marketplace"
                ? "bg-gradient-to-r from-[#9786E3] to-[#38BDF8] text-white shadow-lg shadow-[#9786E3]/20"
                : "text-[#94A3B8] hover:text-white"
            }`}
          >
            <StoreIcon size={12} /> Marketplace
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <select
            value={filterState}
            onChange={(e) => {
              setFilterState(e.target.value);
              setFilterCity("");
            }}
            className="neo-input text-xs py-2"
          >
            <option value="">All States</option>
            {INDIAN_STATES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          <select
            value={filterCity}
            onChange={(e) => setFilterCity(e.target.value)}
            disabled={!filterState}
            className="neo-input text-xs py-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <option value="">{filterState ? "All Cities" : "Select state first"}</option>
            {filterState && getCitiesForState(filterState).map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Products Grid */}
      <div className="grid grid-cols-2 gap-3">
        {filtered.map((product, i) => {
          const isWishlisted = wishlist.has(product.id);
          const discount = Math.round(((product.mrp - product.price) / product.mrp) * 100);
          return (
            <motion.div
              key={product.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              onClick={() => {
                setOpenProduct(product);
                setActiveImageIdx(0);
                const initial: Record<string, string> = {};
                (product.variations || []).forEach((v) => {
                  if (v.options.length > 0) initial[v.name] = v.options[0];
                });
                setSelectedVariations(initial);
              }}
              className="bg-[#1C1929] border border-white/[0.06] rounded-2xl overflow-hidden cursor-pointer hover:border-white/[0.12] transition-all group"
            >
              <div className="relative w-full aspect-square bg-[#0f0f1a] overflow-hidden">
                {product.cover_image ? (
                  <img
                    src={product.cover_image}
                    alt={product.name}
                    className="w-full h-full object-contain group-hover:scale-[1.03] transition-transform duration-500"
                    onError={(e) => {
                      // Hide broken img and reveal the fallback placeholder
                      const img = e.currentTarget;
                      img.style.display = "none";
                      const fallback = img.nextElementSibling as HTMLElement | null;
                      if (fallback) fallback.style.display = "flex";
                    }}
                  />
                ) : null}
                {/* Fallback placeholder — shown when no image OR image fails to load.
                    Uses a labeled Koino placeholder instead of a broken-image icon. */}
                <div
                  className="w-full h-full flex flex-col items-center justify-center gap-1 text-center px-2"
                  style={{
                    background: CHURCH_GRADIENTS[product.cover_gradient % CHURCH_GRADIENTS.length],
                    display: product.cover_image ? "none" : "flex",
                  }}
                >
                  <ImageOff size={20} className="text-white/60" />
                  <p className="text-[9px] font-bold uppercase tracking-wider text-white/60">Koino</p>
                  <p className="text-[8px] text-white/40 leading-tight">Product image unavailable</p>
                </div>
                {/* Seller type badge — official Koino Store vs Marketplace */}
                {product.sellerType === "believ" ? (
                  <span className="absolute top-2 left-2 px-1.5 py-0.5 rounded-md bg-[#9786E3] text-white text-[8px] font-bold uppercase tracking-wider flex items-center gap-0.5">
                    <BadgeCheck size={9} /> Koino
                  </span>
                ) : (
                  <span className="absolute top-2 left-2 px-1.5 py-0.5 rounded-md bg-[#38BDF8]/20 backdrop-blur-sm text-[#38BDF8] text-[8px] font-bold uppercase tracking-wider border border-[#38BDF8]/30">
                    Marketplace
                  </span>
                )}
                {discount > 0 && (
                  <span className="absolute top-2 right-9 px-1.5 py-0.5 rounded-md bg-[#EF4444] text-white text-[8px] font-bold uppercase tracking-wider">
                    -{discount}%
                  </span>
                )}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleWishlist(product.id);
                  }}
                  className="absolute top-2 right-2 w-7 h-7 rounded-lg bg-black/40 backdrop-blur-sm border border-white/10 flex items-center justify-center"
                >
                  <Heart
                    size={13}
                    className={isWishlisted ? "text-[#EC4899]" : "text-white/80"}
                    fill={isWishlisted ? "currentColor" : "none"}
                  />
                </button>
                {!product.in_stock && (
                  <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center">
                    <span className="px-3 py-1 rounded-full bg-white/10 text-white text-[10px] font-bold uppercase tracking-wider">
                      Out of Stock
                    </span>
                  </div>
                )}
              </div>

              <div className="p-3">
                <p className="text-[9px] font-bold uppercase tracking-wider text-[#94A3B8] mb-0.5">
                  {product.category}
                </p>
                <h3 className="text-xs font-bold text-white mb-1 line-clamp-2 leading-tight min-h-[2rem]">
                  {product.name}
                </h3>
                <div className="flex items-center gap-1 mb-1.5">
                  <StarRating rating={product.rating} />
                  <span className="text-[9px] text-[#94A3B8]">({product.reviews})</span>
                  {product.variations && product.variations.length > 0 && (
                    <span
                      className="ml-auto px-1 py-0.5 rounded bg-[#9786E3]/15 text-[#9786E3] text-[8px] font-bold uppercase tracking-wider"
                      title={product.variations.map((v) => v.name).join(", ")}
                    >
                      {product.variations.length} option{product.variations.length > 1 ? "s" : ""}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-extrabold text-white">₹{product.price}</span>
                  {product.mrp > product.price && (
                    <span className="text-[10px] text-[#94A3B8] line-through">₹{product.mrp}</span>
                  )}
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-16">
          <Search size={40} className="mx-auto text-[#475569] mb-3" />
          <p className="text-sm text-[#475569]">{t('marketplace.empty')}</p>
        </div>
      )}

      {/* Product Detail Modal */}
      <AnimatePresence>
        {openProduct && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-end md:items-center justify-center z-[60] p-0 md:p-6"
            onClick={(e) => e.target === e.currentTarget && setOpenProduct(null)}
          >
            <motion.div
              initial={{ y: 100, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 100, opacity: 0 }}
              transition={{ type: "spring", damping: 30, stiffness: 350 }}
              className="bg-[#1C1929] border border-white/[0.08] rounded-t-[28px] md:rounded-[24px] w-full max-w-lg max-h-[90vh] overflow-y-auto"
            >
              <div className="relative w-full aspect-square bg-[#0f0f1a] overflow-hidden">
                {(() => {
                  const allImages = openProduct.images && openProduct.images.length > 0
                    ? openProduct.images
                    : openProduct.cover_image
                    ? [openProduct.cover_image]
                    : [];
                  const activeImg = allImages[activeImageIdx] || allImages[0];
                  if (activeImg) {
                    return (
                      <img
                        src={activeImg}
                        alt={openProduct.name}
                        className="w-full h-full object-contain"
                        onError={(e) => {
                          const img = e.currentTarget;
                          img.style.display = "none";
                          const fallback = img.nextElementSibling as HTMLElement | null;
                          if (fallback) fallback.style.display = "flex";
                        }}
                      />
                    );
                  }
                  return (
                    <div
                      className="w-full h-full flex flex-col items-center justify-center gap-1 text-center px-2"
                      style={{ background: CHURCH_GRADIENTS[openProduct.cover_gradient % CHURCH_GRADIENTS.length] }}
                    >
                      <ImageOff size={28} className="text-white/60" />
                      <p className="text-[10px] font-bold uppercase tracking-wider text-white/60">Koino</p>
                      <p className="text-[9px] text-white/40 leading-tight">Product image unavailable</p>
                    </div>
                  );
                })()}
                <div className="absolute inset-0 bg-gradient-to-t from-[#1C1929] via-transparent to-transparent pointer-events-none" />
                <button
                  onClick={() => setOpenProduct(null)}
                  className="absolute top-3 right-3 w-9 h-9 rounded-full bg-black/50 backdrop-blur-sm border border-white/10 flex items-center justify-center text-white/80 hover:text-white"
                >
                  <X size={18} />
                </button>
                {/* Image counter badge */}
                {openProduct.images && openProduct.images.length > 1 && (
                  <span className="absolute top-3 left-3 px-2 py-0.5 rounded-full bg-black/60 backdrop-blur-sm text-white text-[10px] font-bold">
                    {activeImageIdx + 1} / {openProduct.images.length}
                  </span>
                )}
                {!openProduct.in_stock && (
                  <div className="absolute bottom-3 left-3 px-3 py-1 rounded-full bg-[#EF4444]/90 text-white text-[10px] font-bold uppercase tracking-wider">
                    Out of Stock
                  </div>
                )}
              </div>

              {/* Thumbnail strip */}
              {openProduct.images && openProduct.images.length > 1 && (
                <div className="px-5 pt-3 flex gap-2 overflow-x-auto pb-1">
                  {openProduct.images.map((img, idx) => (
                    <button
                      key={idx}
                      onClick={() => setActiveImageIdx(idx)}
                      className={`relative w-14 h-14 rounded-lg overflow-hidden border-2 shrink-0 transition-all ${
                        idx === activeImageIdx
                          ? "border-[#7C3AED] opacity-100"
                          : "border-transparent opacity-60 hover:opacity-100"
                      }`}
                    >
                      <img src={img} alt="" className="w-full h-full object-contain bg-[#0f0f1a]" />
                    </button>
                  ))}
                </div>
              )}

              <div className="p-5 space-y-4">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-[#94A3B8] mb-1">
                    {openProduct.category}
                  </p>
                  <h2 className="text-xl font-extrabold text-white leading-tight mb-2">
                    {openProduct.name}
                  </h2>
                  <div className="flex items-center gap-2">
                    <StarRating rating={openProduct.rating} size={13} />
                    <span className="text-xs text-[#94A3B8]">
                      {openProduct.rating} · {openProduct.reviews} reviews
                    </span>
                  </div>
                </div>

                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-extrabold text-white">₹{openProduct.price}</span>
                  {openProduct.mrp > openProduct.price && (
                    <>
                      <span className="text-sm text-[#94A3B8] line-through">₹{openProduct.mrp}</span>
                      <span className="px-2 py-0.5 rounded-md bg-[#22C55E]/15 text-[#22C55E] text-[10px] font-bold">
                        Save ₹{openProduct.mrp - openProduct.price}
                      </span>
                    </>
                  )}
                </div>

                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-[#94A3B8] mb-1">Description</p>
                  <p className="text-sm text-[#A09DB1] leading-relaxed">{openProduct.description}</p>
                </div>

                {openProduct.variations && openProduct.variations.length > 0 && (
                  <div className="space-y-2.5">
                    {openProduct.variations.map((variation, vIdx) => (
                      <div key={vIdx}>
                        <p className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-[#94A3B8] mb-1.5">
                          <Tag size={10} /> {variation.name}
                          {selectedVariations[variation.name] && (
                            <span className="text-[#9786E3] normal-case tracking-normal ml-1">
                              · {selectedVariations[variation.name]}
                            </span>
                          )}
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {variation.options.map((opt) => {
                            const isSelected = selectedVariations[variation.name] === opt;
                            return (
                              <button
                                key={opt}
                                onClick={() =>
                                  setSelectedVariations((prev) => ({ ...prev, [variation.name]: opt }))
                                }
                                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${
                                  isSelected
                                    ? "bg-[#9786E3] text-white border-[#9786E3]"
                                    : "bg-white/[0.04] text-[#94A3B8] border-white/[0.08] hover:text-white hover:border-white/[0.2]"
                                }`}
                              >
                                {opt}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {openProduct.attributes && openProduct.attributes.length > 0 && (
                  <div className="space-y-1.5">
                    <p className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-[#94A3B8]">
                      <Palette size={10} /> Specifications
                    </p>
                    <div className="grid grid-cols-2 gap-1.5">
                      {openProduct.attributes.map((attr, aIdx) => (
                        <div
                          key={aIdx}
                          className="bg-white/[0.03] border border-white/[0.06] rounded-lg px-2.5 py-1.5"
                        >
                          <p className="text-[9px] font-bold uppercase tracking-wider text-[#64748B]">
                            {attr.label}
                          </p>
                          <p className="text-[11px] font-semibold text-white mt-0.5">{attr.value}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-3 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#9786E3] to-[#38BDF8] flex items-center justify-center">
                    <Store size={16} className="text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-[#94A3B8]">Seller</p>
                      {openProduct.sellerType === "believ" ? (
                        <span className="px-1.5 py-0.5 rounded bg-[#9786E3]/15 text-[#9786E3] text-[8px] font-bold uppercase tracking-wider flex items-center gap-0.5">
                          <BadgeCheck size={8} /> Koino Store
                        </span>
                      ) : (
                        <span className="px-1.5 py-0.5 rounded bg-[#38BDF8]/15 text-[#38BDF8] text-[8px] font-bold uppercase tracking-wider">
                          Marketplace
                        </span>
                      )}
                    </div>
                    <p className="text-sm font-bold text-white truncate">{openProduct.vendor}</p>
                    <p className="text-[10px] text-[#94A3B8] flex items-center gap-1">
                      <MapPin size={9} /> {openProduct.city}{openProduct.city && openProduct.state ? ", " : ""}{openProduct.state}
                    </p>
                  </div>
                </div>

                <div className="flex gap-2 pt-2">
                  <button
                    onClick={() => toggleWishlist(openProduct.id)}
                    className={`px-4 rounded-xl border flex items-center justify-center transition-all ${
                      wishlist.has(openProduct.id)
                        ? "bg-[#EC4899]/15 border-[#EC4899]/30 text-[#EC4899]"
                        : "bg-white/[0.04] border-white/[0.06] text-[#94A3B8] hover:text-white"
                    }`}
                  >
                    <Heart size={18} fill={wishlist.has(openProduct.id) ? "currentColor" : "none"} />
                  </button>
                  {openProduct.whatsapp_number && (
                    <a
                      href={`https://wa.me/${openProduct.whatsapp_number.replace(/[^0-9]/g, "")}?text=${encodeURIComponent(
                        (() => {
                          const base = `Hi, I found your product "${openProduct.name}" on Koino and I'd like more information. Is it available?`;
                          const sel = Object.entries(selectedVariations);
                          if (sel.length === 0) return base;
                          const specs = sel.map(([n, v]) => `${n}: ${v}`).join(", ");
                          return `${base}\n\nMy preferred variation: ${specs}`;
                        })()
                      )}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 py-3 rounded-xl text-sm font-bold text-white bg-[#25D366] hover:bg-[#1FB855] transition-all hover:-translate-y-px flex items-center justify-center gap-2"
                    >
                      <WhatsAppIcon size={16} /> {t('marketplace.contactSeller')}
                    </a>
                  )}
                  {openProduct.buyUrl ? (
                    <a
                      href={openProduct.in_stock ? openProduct.buyUrl : undefined}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-disabled={!openProduct.in_stock}
                      className={`flex-1 py-3 rounded-xl text-sm font-bold text-white transition-all flex items-center justify-center gap-2 ${openProduct.in_stock ? "hover:-translate-y-px" : "opacity-40 cursor-not-allowed pointer-events-none"}`}
                      style={{ background: "linear-gradient(135deg, #9786E3, #38BDF8)" }}
                    >
                      <ShoppingCart size={16} /> Buy Now
                      <ExternalLink size={12} className="opacity-80" />
                    </a>
                  ) : (
                    <button
                      onClick={() => {
                        addToCart(openProduct);
                        setOpenProduct(null);
                      }}
                      disabled={!openProduct.in_stock}
                      className="flex-1 py-3 rounded-xl text-sm font-bold text-white transition-all hover:-translate-y-px disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                      style={{ background: "linear-gradient(135deg, #9786E3, #38BDF8)" }}
                    >
                      <ShoppingCart size={16} /> {t('marketplace.addToCart')}
                    </button>
                  )}
                </div>

                {/* Helper text — Koino does NOT process payments for marketplace products */}
                {openProduct.sellerType === "marketplace" && openProduct.buyUrl && (
                  <p className="text-[10px] text-[#64748B] text-center leading-relaxed pt-1">
                    Payment, shipping, and refunds are handled by the seller.
                    Koino does not process payments.
                  </p>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* List Item Modal */}
      <AnimatePresence>
        {showCreateModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-end md:items-center justify-center z-[60]"
            onClick={(e) => e.target === e.currentTarget && setShowCreateModal(false)}
          >
            <motion.div
              initial={{ y: 100 }}
              animate={{ y: 0 }}
              exit={{ y: 100 }}
              transition={{ type: "spring", damping: 30, stiffness: 350 }}
              className="bg-[#1C1929] border-t md:border border-white/[0.08] rounded-t-[28px] md:rounded-[24px] w-full max-w-lg p-5 max-h-[85vh] overflow-y-auto"
            >
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-bold bg-gradient-to-r from-[#9786E3] to-[#38BDF8] bg-clip-text text-transparent">
                  List an Item
                </h2>
                <button onClick={() => setShowCreateModal(false)} className="text-[#64748B] hover:text-white p-1">
                  <X size={20} />
                </button>
              </div>
              <div className="bg-[#25D366]/8 border border-[#25D366]/25 rounded-xl p-3 mb-4 flex items-start gap-2">
                <WhatsAppIcon size={16} />
                <div>
                  <p className="text-[11px] font-bold text-[#25D366]">No payment gateway needed</p>
                  <p className="text-[10px] text-[#A09DB1] leading-relaxed mt-0.5">
                    Buyers will contact you directly on WhatsApp. You arrange payment &amp; delivery with them.
                  </p>
                </div>
              </div>
              <form onSubmit={handleCreateProduct} className="space-y-3">
                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-wider text-[#94A3B8] mb-1.5">
                    Product Name *
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="neo-input text-sm"
                    placeholder="e.g. ESV Study Bible"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-wider text-[#94A3B8] mb-1.5">
                    Description
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="neo-input h-20 resize-none text-sm"
                    placeholder="Condition, features, what's included..."
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold uppercase tracking-wider text-[#94A3B8] mb-1.5">
                      <IndianRupee size={10} className="inline mr-0.5" /> Selling Price *
                    </label>
                    <input
                      type="number"
                      value={formData.price}
                      onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                      className="neo-input text-sm"
                      placeholder="999"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold uppercase tracking-wider text-[#94A3B8] mb-1.5">
                      <IndianRupee size={10} className="inline mr-0.5" /> MRP (optional)
                    </label>
                    <input
                      type="number"
                      value={formData.mrp}
                      onChange={(e) => setFormData({ ...formData, mrp: e.target.value })}
                      className="neo-input text-sm"
                      placeholder="1499"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold uppercase tracking-wider text-[#94A3B8] mb-1.5">
                      Category
                    </label>
                    <select
                      value={formData.category}
                      onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                      className="neo-input text-sm"
                    >
                      {CATEGORIES.filter((c) => c !== "All").map((c) => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold uppercase tracking-wider text-[#94A3B8] mb-1.5">
                      State
                    </label>
                    <select
                      value={formData.state}
                      onChange={(e) => setFormData({ ...formData, state: e.target.value, city: "" })}
                      className="neo-input text-sm"
                    >
                      <option value="">Select state</option>
                      {INDIAN_STATES.map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold uppercase tracking-wider text-[#94A3B8] mb-1.5">
                      City
                    </label>
                    <select
                      value={formData.city}
                      onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                      disabled={!formData.state}
                      className="neo-input text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <option value="">{formData.state ? "Select city" : "Select state first"}</option>
                      {formData.state && getCitiesForState(formData.state).map((c) => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold uppercase tracking-wider text-[#94A3B8] mb-1.5">
                      Vendor / Your Name
                    </label>
                    <input
                      type="text"
                      value={formData.vendor}
                      onChange={(e) => setFormData({ ...formData, vendor: e.target.value })}
                      className="neo-input text-sm"
                      placeholder="Your name or shop"
                    />
                  </div>
                </div>
                <ImagePicker
                  images={formData.images}
                  onChange={(images) => setFormData({ ...formData, images })}
                  max={5}
                  label="Product Photos"
                />

                {/* Variations (Size / Color / etc.) */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider text-[#94A3B8]">
                      <Tag size={10} /> Variations
                      <span className="text-[9px] text-[#475569] normal-case tracking-normal">(sizes, colors...)</span>
                    </label>
                    <button
                      type="button"
                      onClick={() =>
                        setFormData({
                          ...formData,
                          variations: [...formData.variations, { name: "", options: [] }],
                        })
                      }
                      className="flex items-center gap-1 px-2 py-1 rounded-lg bg-[#9786E3]/15 text-[#9786E3] text-[10px] font-bold hover:bg-[#9786E3]/25"
                    >
                      <Plus size={10} /> Add
                    </button>
                  </div>
                  {formData.variations.length === 0 && (
                    <p className="text-[10px] text-[#475569] px-1 py-1 italic">
                      Optional. Add a "Size" with options like S, M, L, XL or a "Color" with Black, White.
                    </p>
                  )}
                  {formData.variations.map((v, vIdx) => (
                    <div
                      key={vIdx}
                      className="rounded-xl bg-white/[0.02] border border-white/[0.06] p-2.5 space-y-2"
                    >
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={v.name}
                          onChange={(e) => {
                            const next = [...formData.variations];
                            next[vIdx] = { ...next[vIdx], name: e.target.value };
                            setFormData({ ...formData, variations: next });
                          }}
                          className="neo-input text-xs flex-1"
                          placeholder="Variation name (e.g. Size, Color)"
                        />
                        <button
                          type="button"
                          onClick={() =>
                            setFormData({
                              ...formData,
                              variations: formData.variations.filter((_, i) => i !== vIdx),
                            })
                          }
                          className="w-7 h-7 rounded-lg bg-[#EF4444]/15 border border-[#EF4444]/30 text-[#EF4444] flex items-center justify-center hover:bg-[#EF4444]/25"
                        >
                          <X size={11} />
                        </button>
                      </div>
                      <div className="flex flex-wrap gap-1.5 items-center">
                        {v.options.map((opt, oIdx) => (
                          <span
                            key={oIdx}
                            className="flex items-center gap-1 pl-2 pr-1 py-1 rounded-md bg-[#9786E3]/10 border border-[#9786E3]/20 text-[10px] font-semibold text-[#9786E3]"
                          >
                            {opt}
                            <button
                              type="button"
                              onClick={() => {
                                const next = [...formData.variations];
                                next[vIdx].options = next[vIdx].options.filter((_, i) => i !== oIdx);
                                setFormData({ ...formData, variations: next });
                              }}
                              className="w-4 h-4 rounded-full bg-[#9786E3]/20 hover:bg-[#9786E3]/40 flex items-center justify-center"
                            >
                              <X size={9} />
                            </button>
                          </span>
                        ))}
                        <input
                          type="text"
                          placeholder="Add option + Enter"
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              const target = e.target as HTMLInputElement;
                              const val = target.value.trim();
                              if (!val) return;
                              const next = [...formData.variations];
                              next[vIdx] = {
                                ...next[vIdx],
                                options: [...next[vIdx].options, val],
                              };
                              setFormData({ ...formData, variations: next });
                              target.value = "";
                            }
                          }}
                          className="bg-transparent border border-dashed border-white/[0.12] rounded-md px-2 py-1 text-[10px] text-white outline-none focus:border-[#9786E3]/50 flex-1 min-w-[100px]"
                        />
                      </div>
                    </div>
                  ))}
                </div>

                {/* Attributes (Material, Fit, Weight, etc.) */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider text-[#94A3B8]">
                      <Palette size={10} /> Attributes
                      <span className="text-[9px] text-[#475569] normal-case tracking-normal">(material, weight...)</span>
                    </label>
                    <button
                      type="button"
                      onClick={() =>
                        setFormData({
                          ...formData,
                          attributes: [...formData.attributes, { label: "", value: "" }],
                        })
                      }
                      className="flex items-center gap-1 px-2 py-1 rounded-lg bg-[#38BDF8]/15 text-[#38BDF8] text-[10px] font-bold hover:bg-[#38BDF8]/25"
                    >
                      <Plus size={10} /> Add
                    </button>
                  </div>
                  {formData.attributes.length === 0 && (
                    <p className="text-[10px] text-[#475569] px-1 py-1 italic">
                      Optional. Add specs like "Material: 100% Cotton".
                    </p>
                  )}
                  {formData.attributes.map((a, aIdx) => (
                    <div key={aIdx} className="flex items-center gap-2">
                      <input
                        type="text"
                        value={a.label}
                        onChange={(e) => {
                          const next = [...formData.attributes];
                          next[aIdx] = { ...next[aIdx], label: e.target.value };
                          setFormData({ ...formData, attributes: next });
                        }}
                        className="neo-input text-xs w-[40%]"
                        placeholder="Label (e.g. Material)"
                      />
                      <input
                        type="text"
                        value={a.value}
                        onChange={(e) => {
                          const next = [...formData.attributes];
                          next[aIdx] = { ...next[aIdx], value: e.target.value };
                          setFormData({ ...formData, attributes: next });
                        }}
                        className="neo-input text-xs flex-1"
                        placeholder="Value (e.g. 100% Cotton)"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          setFormData({
                            ...formData,
                            attributes: formData.attributes.filter((_, i) => i !== aIdx),
                          })
                        }
                        className="w-7 h-7 rounded-lg bg-[#EF4444]/15 border border-[#EF4444]/30 text-[#EF4444] flex items-center justify-center hover:bg-[#EF4444]/25 shrink-0"
                      >
                        <X size={11} />
                      </button>
                    </div>
                  ))}
                </div>

                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-wider text-[#94A3B8] mb-1.5">
                    <Phone size={10} className="inline mr-0.5" /> WhatsApp Number *
                  </label>
                  <input
                    type="tel"
                    value={formData.whatsapp_number}
                    onChange={(e) => setFormData({ ...formData, whatsapp_number: e.target.value })}
                    className="neo-input text-sm"
                    placeholder="+91 98765 43210"
                    required
                  />
                  <p className="text-[10px] text-[#64748B] mt-1">
                    Buyers will see a "Contact Seller" button that opens WhatsApp with this number.
                  </p>
                </div>

                {/* External Buy Link — Koino does NOT process payments.
                    Sellers can link to their own checkout/website. */}
                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-wider text-[#94A3B8] mb-1.5">
                    <ExternalLink size={10} className="inline mr-0.5" /> External Buy Link (optional)
                  </label>
                  <input
                    type="url"
                    value={formData.buyUrl}
                    onChange={(e) => setFormData({ ...formData, buyUrl: e.target.value })}
                    className="neo-input text-sm"
                    placeholder="https://yourstore.com/product/..."
                  />
                  <p className="text-[10px] text-[#64748B] mt-1">
                    Optional. Add your website, store, or checkout link. If provided, buyers see a "Buy Now" button that opens this link. Koino does not process payments — payment, shipping, and refunds are handled by you.
                  </p>
                </div>
                <div className="flex gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    className="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-white/[0.04] text-[#94A3B8] hover:text-white border border-white/[0.06]"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white"
                    style={{ background: "linear-gradient(135deg, #9786E3, #38BDF8)" }}
                  >
                    List Item
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
