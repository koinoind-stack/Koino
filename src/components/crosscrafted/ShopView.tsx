"use client";

import { useState, useEffect, useRef, useCallback } from "react";
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
  Share2,
} from "lucide-react";
import { toast } from "sonner";
import {
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
import { shareLinks } from "@/lib/share/links";
import ShareSheet, { type ShareRequest } from "@/components/share/ShareSheet";
import { useSupabaseUser } from "@/lib/supabase/use-user";

// Card shape returned by /api/marketplace and /api/store (DB-backed).
type ApiProduct = {
  id: string; kind: "member" | "koino"; name: string; description: string;
  price: number; mrp: number | null; category: string; vendor: string;
  sellerType: "marketplace" | "believ"; state: string; city: string;
  cover_gradient: number; cover_image: string | null; images: string[];
  in_stock: boolean; featured: boolean; buyUrl: string | null;
  rating: null; reviews: null; createdAt: string;
};

function mapApiToProduct(c: ApiProduct): Product {
  return {
    id: c.id, name: c.name, description: c.description, price: c.price,
    mrp: c.mrp ?? c.price, category: c.category, vendor: c.vendor,
    sellerType: c.sellerType, state: c.state, city: c.city,
    rating: 0, reviews: 0, cover_gradient: c.cover_gradient,
    cover_image: c.cover_image ?? undefined, images: c.images,
    in_stock: c.in_stock, status: "published", featured: c.featured,
    buyUrl: c.buyUrl ?? undefined,
  };
}

// Single source of truth — pulled from crosscrafted-data so the List Item form,
// the filter pills, and the admin product form all share the same list.
const CATEGORIES = ["All", ...MARKETPLACE_CATEGORIES];

// i18n: category id → translation key. The raw value is what the DB stores
// and what the category filter sends — only the display label is translated.
// Categories without a key fall back to their raw data label at render time.
const CATEGORY_LABEL_KEYS: Record<string, string> = {
  All: "marketplace.category.all",
  Bibles: "marketplace.category.bibles",
  Books: "marketplace.category.books",
  Apparel: "marketplace.category.apparel",
  Gifts: "marketplace.category.gifts",
  Music: "marketplace.category.music",
};

const StarRating = ({ rating, size = 11 }: { rating: number; size?: number }) => (
  <div className="flex items-center gap-0.5">
    {[1, 2, 3, 4, 5].map((n) => (
      <Star
        key={n}
        size={size}
        className={n <= Math.round(rating) ? "text-[#F5B84A]" : "text-white/15"}
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
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const firstLoad = useRef(true);
  const { isAuthenticated } = useSupabaseUser();
  const [wishlist, setWishlist] = useState<Set<string>>(new Set());
  const [cart, setCart] = useState<Set<string>>(new Set());
  const [activeCategory, setActiveCategory] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [filterState, setFilterState] = useState("");
  const [filterCity, setFilterCity] = useState("");
  const [filterSellerType, setFilterSellerType] = useState<"all" | "believ" | "marketplace">("all");
  const [openProduct, setOpenProduct] = useState<Product | null>(null);
  // Universal share sheet — Task 121 (published listings only; the card
  // endpoint re-verifies the listing status server-side).
  const [shareReq, setShareReq] = useState<ShareRequest | null>(null);
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

  const loadProducts = useCallback(async (cursor?: string | null) => {
    if (cursor) setLoadingMore(true); else setLoading(true);
    try {
      const params = new URLSearchParams();
      const source = filterSellerType === "believ" ? "koino" : filterSellerType === "marketplace" ? "member" : "all";
      params.set("source", source);
      if (searchQuery.trim()) params.set("q", searchQuery.trim());
      if (activeCategory !== "All") params.set("category", activeCategory);
      if (filterState) params.set("state", filterState);
      if (filterCity) params.set("city", filterCity);
      if (cursor) params.set("cursor", cursor);
      const res = await fetch(`/api/marketplace?${params.toString()}`, { cache: "no-store" });
      const data = await res.json();
      const mapped: Product[] = ((data.products || []) as ApiProduct[]).map(mapApiToProduct);
      if (cursor) {
        setProducts((prev) => [...prev, ...mapped.filter((m) => !prev.some((p) => p.id === m.id))]);
      } else {
        setProducts(mapped);
      }
      setNextCursor(data.nextCursor || null);
    } catch {
      toast.error(t("shop.error.load"));
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [filterSellerType, searchQuery, activeCategory, filterState, filterCity]);

  useEffect(() => {
    const t = setTimeout(() => loadProducts(null), firstLoad.current ? 0 : 350);
    firstLoad.current = false;
    return () => clearTimeout(t);
  }, [loadProducts]);

  // Open the detail modal immediately, then hydrate contact/variations from
  // the detail endpoint (contact details are never in the public list API).
  const openDetail = (p: Product) => {
    setOpenProduct(p);
    setActiveImageIdx(0);
    const initial: Record<string, string> = {};
    (p.variations || []).forEach((v) => {
      if (v.options.length > 0) initial[v.name] = v.options[0];
    });
    setSelectedVariations(initial);
    const kind = (p as Product & { kind?: string }).kind;
    const url = kind === "koino" ? `/api/store/${p.id}` : `/api/marketplace/${p.id}`;
    fetch(url, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        const row = d?.product || d?.listing;
        if (!row) return;
        setOpenProduct((cur) =>
          cur && cur.id === p.id
            ? {
                ...cur,
                whatsapp_number: row.whatsappNumber ?? cur.whatsapp_number,
                buyUrl: row.buyUrl ?? cur.buyUrl,
                variations: Array.isArray(row.variations) ? row.variations : cur.variations,
                attributes: Array.isArray(row.attributes) ? row.attributes : cur.attributes,
                in_stock: typeof row.in_stock === "boolean" ? row.in_stock : cur.in_stock,
              }
            : cur
        );
      })
      .catch(() => {});
  };

  const handleCreateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAuthenticated) {
      toast.error(t("shop.error.signInRequired"), { description: t("shop.error.signInDesc") });
      return;
    }
    if (!formData.name || !formData.price || !formData.whatsapp_number) {
      toast.error(t("shop.form.errorRequired"));
      return;
    }
    if (formData.description.trim().length < 10) {
      toast.error(t("shop.form.errorDesc"));
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/marketplace", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: formData.name,
          description: formData.description,
          price: Number(formData.price),
          mrp: formData.mrp ? Number(formData.mrp) : null,
          category: formData.category,
          images: formData.images,
          state: formData.state || null,
          city: formData.city || null,
          whatsappNumber: formData.whatsapp_number,
          sellerName: formData.vendor || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || t("shop.form.errorSubmit"));
      setFormData({
        name: "", description: "", price: "", mrp: "", category: "Bibles",
        vendor: "", city: "", state: "", buyUrl: "", images: [],
        whatsapp_number: "", variations: [], attributes: [],
      });
      setShowCreateModal(false);
      toast.success(t("shop.form.success"), {
        description: t("shop.form.successDesc"),
      });
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  // Filtering, sorting and pagination happen server-side against the database.
  const filtered = products;

  const toggleWishlist = (id: string) => {
    setWishlist((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
        toast(t("shop.toast.wishlistRemoved"));
      } else {
        next.add(id);
        toast.success(t("shop.toast.wishlistAdded"));
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
    toast.success(t("shop.toast.addedToCart", { name: p.name }), {
      description: t("shop.toast.addedToCartDesc"),
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
              {t("marketplace.cart")}
              <span className="w-4 h-4 rounded-full bg-[#22C55E] text-slate-950 text-[9px] flex items-center justify-center font-bold">
                {cart.size}
              </span>
            </button>
          )}
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-[12px] font-semibold text-white transition-all hover:-translate-y-px"
            style={{ background: "linear-gradient(135deg, #3B82F6, #22D3EE)" }}
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
                ? "bg-[#3B82F6] text-white"
                : "bg-white/[0.04] text-[#94A3B8] hover:text-white border border-white/[0.06]"
            }`}
          >
            {CATEGORY_LABEL_KEYS[cat] ? t(CATEGORY_LABEL_KEYS[cat]) : cat}
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
                ? "bg-gradient-to-r from-[#3B82F6] to-[#22D3EE] text-white shadow-lg shadow-[#3B82F6]/20"
                : "text-[#94A3B8] hover:text-white"
            }`}
          >
            <StoreIcon size={12} /> {t("common.all")}
          </button>
          <button
            onClick={() => setFilterSellerType("believ")}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-[11px] font-bold transition-all ${
              filterSellerType === "believ"
                ? "bg-gradient-to-r from-[#3B82F6] to-[#22D3EE] text-white shadow-lg shadow-[#3B82F6]/20"
                : "text-[#94A3B8] hover:text-white"
            }`}
          >
            <BadgeCheck size={12} /> {t("shop.koinoStoreBadge")}
          </button>
          <button
            onClick={() => setFilterSellerType("marketplace")}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-[11px] font-bold transition-all ${
              filterSellerType === "marketplace"
                ? "bg-gradient-to-r from-[#3B82F6] to-[#22D3EE] text-white shadow-lg shadow-[#3B82F6]/20"
                : "text-[#94A3B8] hover:text-white"
            }`}
          >
            <StoreIcon size={12} /> {t("marketplace.title")}
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
            <option value="">{t("common.allStates")}</option>
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
            <option value="">{filterState ? t("common.allCities") : t("common.selectStateFirst")}</option>
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
              onClick={() => openDetail(product)}
              className="bg-[#13294A] border border-white/[0.06] rounded-2xl overflow-hidden cursor-pointer hover:border-white/[0.12] transition-all group"
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
                  <p className="text-[8px] text-white/40 leading-tight">{t("shop.imageUnavailable")}</p>
                </div>
                {/* Seller type badge — official Koino Store vs Marketplace */}
                {product.sellerType === "believ" ? (
                  <span className="absolute top-2 left-2 px-1.5 py-0.5 rounded-md bg-[#3B82F6] text-white text-[8px] font-bold uppercase tracking-wider flex items-center gap-0.5">
                    <BadgeCheck size={9} /> Koino
                  </span>
                ) : (
                  <span className="absolute top-2 left-2 px-1.5 py-0.5 rounded-md bg-[#22D3EE]/20 backdrop-blur-sm text-[#22D3EE] text-[8px] font-bold uppercase tracking-wider border border-[#22D3EE]/30">
                    {t("marketplace.title")}
                  </span>
                )}
                {discount > 0 && (
                  <span className="absolute top-2 right-9 px-1.5 py-0.5 rounded-md bg-[#EF4444] text-white text-[8px] font-bold uppercase tracking-wider">
                    {t("common.discount", { percent: discount })}
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
                    className={isWishlisted ? "text-[#F97316]" : "text-white/80"}
                    fill={isWishlisted ? "currentColor" : "none"}
                  />
                </button>
                {!product.in_stock && (
                  <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center">
                    <span className="px-3 py-1 rounded-full bg-white/10 text-white text-[10px] font-bold uppercase tracking-wider">
                      {t("marketplace.outOfStock")}
                    </span>
                  </div>
                )}
              </div>

              <div className="p-3">
                <p className="text-[9px] font-bold uppercase tracking-wider text-[#94A3B8] mb-0.5">
                  {CATEGORY_LABEL_KEYS[product.category] ? t(CATEGORY_LABEL_KEYS[product.category]) : product.category}
                </p>
                <h3 className="text-xs font-bold text-white mb-1 line-clamp-2 leading-tight min-h-[2rem]">
                  {product.name}
                </h3>
                <div className="flex items-center gap-1 mb-1.5">
                  {product.rating > 0 && (
                    <>
                      <StarRating rating={product.rating} />
                      <span className="text-[9px] text-[#94A3B8]">({product.reviews})</span>
                    </>
                  )}
                  {product.variations && product.variations.length > 0 && (
                    <span
                      className="ml-auto px-1 py-0.5 rounded bg-[#3B82F6]/15 text-[#3B82F6] text-[8px] font-bold uppercase tracking-wider"
                      title={product.variations.map((v) => v.name).join(", ")}
                    >
                      {product.variations.length === 1
                        ? t("marketplace.optionBadgeSingular", { count: product.variations.length })
                        : t("marketplace.optionBadge", { count: product.variations.length })}
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

      {loading && (
        <div className="flex items-center justify-center py-16">
          <div className="w-7 h-7 border-2 border-[#2563EB] border-t-transparent rounded-full animate-spin" />
        </div>
      )}
      {!loading && nextCursor && (
        <div className="flex justify-center mt-4">
          <button
            onClick={() => loadProducts(nextCursor)}
            disabled={loadingMore}
            className="px-5 py-2.5 rounded-xl text-sm font-bold bg-white/[0.04] border border-white/[0.08] text-[#94A3B8] hover:text-white disabled:opacity-50"
          >
            {loadingMore ? t("common.loading") : t("biz.showMore")}
          </button>
        </div>
      )}
      {!loading && filtered.length === 0 && (
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
              className="bg-[#13294A] border border-white/[0.08] rounded-t-[28px] md:rounded-[24px] w-full max-w-lg max-h-[90vh] overflow-y-auto"
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
                      <p className="text-[9px] text-white/40 leading-tight">{t("shop.imageUnavailable")}</p>
                    </div>
                  );
                })()}
                <div className="absolute inset-0 bg-gradient-to-t from-[#13294A] via-transparent to-transparent pointer-events-none" />
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
                    {t("marketplace.outOfStock")}
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
                          ? "border-[#2563EB] opacity-100"
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
                    {CATEGORY_LABEL_KEYS[openProduct.category] ? t(CATEGORY_LABEL_KEYS[openProduct.category]) : openProduct.category}
                  </p>
                  <h2 className="text-xl font-extrabold text-white leading-tight mb-2">
                    {openProduct.name}
                  </h2>
                  <div className="flex items-center gap-2">
                    <StarRating rating={openProduct.rating} size={13} />
                    <span className="text-xs text-[#94A3B8]">
                      {t("shop.ratingLine", { rating: openProduct.rating, count: openProduct.reviews })}
                    </span>
                  </div>
                </div>

                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-extrabold text-white">₹{openProduct.price}</span>
                  {openProduct.mrp > openProduct.price && (
                    <>
                      <span className="text-sm text-[#94A3B8] line-through">₹{openProduct.mrp}</span>
                      <span className="px-2 py-0.5 rounded-md bg-[#22C55E]/15 text-[#22C55E] text-[10px] font-bold">
                        {t("common.saveAmount", { amount: (openProduct.mrp - openProduct.price).toLocaleString("en-IN") })}
                      </span>
                    </>
                  )}
                </div>

                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-[#94A3B8] mb-1">{t("marketplace.listModal.description")}</p>
                  <p className="text-sm text-[#A09DB1] leading-relaxed">{openProduct.description}</p>
                </div>

                {openProduct.variations && openProduct.variations.length > 0 && (
                  <div className="space-y-2.5">
                    {openProduct.variations.map((variation, vIdx) => (
                      <div key={vIdx}>
                        <p className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-[#94A3B8] mb-1.5">
                          <Tag size={10} /> {variation.name}
                          {selectedVariations[variation.name] && (
                            <span className="text-[#3B82F6] normal-case tracking-normal ml-1">
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
                                    ? "bg-[#3B82F6] text-white border-[#3B82F6]"
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
                      <Palette size={10} /> {t("marketplace.specifications")}
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
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#3B82F6] to-[#22D3EE] flex items-center justify-center">
                    <Store size={16} className="text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-[#94A3B8]">{t("shop.sellerLabel")}</p>
                      {openProduct.sellerType === "believ" ? (
                        <span className="px-1.5 py-0.5 rounded bg-[#3B82F6]/15 text-[#3B82F6] text-[8px] font-bold uppercase tracking-wider flex items-center gap-0.5">
                          <BadgeCheck size={8} /> {t("shop.koinoStoreBadge")}
                        </span>
                      ) : (
                        <span className="px-1.5 py-0.5 rounded bg-[#22D3EE]/15 text-[#22D3EE] text-[8px] font-bold uppercase tracking-wider">
                          {t("marketplace.title")}
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
                        ? "bg-[#F97316]/15 border-[#F97316]/30 text-[#F97316]"
                        : "bg-white/[0.04] border-white/[0.06] text-[#94A3B8] hover:text-white"
                    }`}
                  >
                    <Heart size={18} fill={wishlist.has(openProduct.id) ? "currentColor" : "none"} />
                  </button>
                  {openProduct.whatsapp_number && (
                    <a
                      href={`https://wa.me/${openProduct.whatsapp_number.replace(/[^0-9]/g, "")}?text=${encodeURIComponent(
                        (() => {
                          const base = t("shop.whatsappPrefill", { name: openProduct.name });
                          const sel = Object.entries(selectedVariations);
                          if (sel.length === 0) return base;
                          const specs = sel.map(([n, v]) => `${n}: ${v}`).join(", ");
                          return `${base}\n\n${t("shop.whatsappVariation", { specs })}`;
                        })()
                      )}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 py-3 rounded-xl text-sm font-bold text-white bg-[#25D366] hover:bg-[#1FB855] transition-all hover:-translate-y-px flex items-center justify-center gap-2"
                    >
                      <WhatsAppIcon size={16} /> {t('marketplace.contactSeller')}
                    </a>
                  )}
                  {(openProduct.status ?? "published") === "published" && (
                    <button
                      onClick={() =>
                        setShareReq({
                          heading: t("shop.shareHeading", { name: openProduct.name }),
                          shareText: t("shop.shareText", { name: openProduct.name, price: openProduct.price.toLocaleString("en-IN") }),
                          shareUrl: shareLinks.shop(),
                          cardUrl: `/api/share-card?type=product&id=${encodeURIComponent(openProduct.id)}`,
                          formats: ["square"],
                          fileName: `koino-product-${openProduct.id}.png`,
                        })
                      }
                      title={t("shop.shareTitle")}
                      className="px-4 py-3 rounded-xl bg-white/[0.04] border border-white/[0.06] text-[#94A3B8] hover:text-white flex items-center justify-center transition-all"
                    >
                      <Share2 size={18} />
                    </button>
                  )}
                  {openProduct.buyUrl ? (
                    <a
                      href={openProduct.in_stock ? openProduct.buyUrl : undefined}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-disabled={!openProduct.in_stock}
                      className={`flex-1 py-3 rounded-xl text-sm font-bold text-white transition-all flex items-center justify-center gap-2 ${openProduct.in_stock ? "hover:-translate-y-px" : "opacity-40 cursor-not-allowed pointer-events-none"}`}
                      style={{ background: "linear-gradient(135deg, #3B82F6, #22D3EE)" }}
                    >
                      <ShoppingCart size={16} /> {t("shop.buyNow")}
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
                      style={{ background: "linear-gradient(135deg, #3B82F6, #22D3EE)" }}
                    >
                      <ShoppingCart size={16} /> {t('marketplace.addToCart')}
                    </button>
                  )}
                </div>

                {/* Helper text — Koino does NOT process payments for marketplace products */}
                {openProduct.sellerType === "marketplace" && openProduct.buyUrl && (
                  <p className="text-[10px] text-[#64748B] text-center leading-relaxed pt-1">
                    {t("shop.paymentNote")}
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
              className="bg-[#13294A] border-t md:border border-white/[0.08] rounded-t-[28px] md:rounded-[24px] w-full max-w-lg p-5 max-h-[85vh] overflow-y-auto"
            >
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-bold bg-gradient-to-r from-[#3B82F6] to-[#22D3EE] bg-clip-text text-transparent">
                  {t("marketplace.listModal.title")}
                </h2>
                <button onClick={() => setShowCreateModal(false)} className="text-[#64748B] hover:text-white p-1">
                  <X size={20} />
                </button>
              </div>
              <div className="bg-[#25D366]/8 border border-[#25D366]/25 rounded-xl p-3 mb-4 flex items-start gap-2">
                <WhatsAppIcon size={16} />
                <div>
                  <p className="text-[11px] font-bold text-[#25D366]">{t("marketplace.listModal.noPaymentNeeded")}</p>
                  <p className="text-[10px] text-[#A09DB1] leading-relaxed mt-0.5">
                    {t("marketplace.listModal.noPaymentDesc")}
                  </p>
                </div>
              </div>
              <form onSubmit={handleCreateProduct} className="space-y-3">
                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-wider text-[#94A3B8] mb-1.5">
                    {t("marketplace.listModal.name")}
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="neo-input text-sm"
                    placeholder={t("marketplace.listModal.namePlaceholder")}
                    required
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-wider text-[#94A3B8] mb-1.5">
                    {t("marketplace.listModal.description")}
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="neo-input h-20 resize-none text-sm"
                    placeholder={t("marketplace.listModal.descriptionPlaceholder")}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold uppercase tracking-wider text-[#94A3B8] mb-1.5">
                      <IndianRupee size={10} className="inline mr-0.5" /> {t("marketplace.listModal.price")}
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
                      <IndianRupee size={10} className="inline mr-0.5" /> {t("marketplace.listModal.mrp")}
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
                      {t("marketplace.listModal.category")}
                    </label>
                    <select
                      value={formData.category}
                      onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                      className="neo-input text-sm"
                    >
                      {CATEGORIES.filter((c) => c !== "All").map((c) => (
                        <option key={c} value={c}>{CATEGORY_LABEL_KEYS[c] ? t(CATEGORY_LABEL_KEYS[c]) : c}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold uppercase tracking-wider text-[#94A3B8] mb-1.5">
                      {t("marketplace.listModal.state")}
                    </label>
                    <select
                      value={formData.state}
                      onChange={(e) => setFormData({ ...formData, state: e.target.value, city: "" })}
                      className="neo-input text-sm"
                    >
                      <option value="">{t("common.selectState")}</option>
                      {INDIAN_STATES.map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold uppercase tracking-wider text-[#94A3B8] mb-1.5">
                      {t("marketplace.listModal.city")}
                    </label>
                    <select
                      value={formData.city}
                      onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                      disabled={!formData.state}
                      className="neo-input text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <option value="">{formData.state ? t("common.selectCity") : t("common.selectStateFirst")}</option>
                      {formData.state && getCitiesForState(formData.state).map((c) => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold uppercase tracking-wider text-[#94A3B8] mb-1.5">
                      {t("marketplace.listModal.vendor")}
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
                  label={t("marketplace.listModal.photos")}
                />

                <p className="text-[10px] text-[#475569] px-1 py-2 italic">
                  {t("shop.form.tip")}
                </p>


                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-wider text-[#94A3B8] mb-1.5">
                    <Phone size={10} className="inline mr-0.5" /> {t("marketplace.listModal.whatsapp")}
                  </label>
                  <input
                    type="tel"
                    value={formData.whatsapp_number}
                    onChange={(e) => setFormData({ ...formData, whatsapp_number: e.target.value })}
                    className="neo-input text-sm"
                    placeholder={t("common.whatsappPlaceholder")}
                    required
                  />
                  <p className="text-[10px] text-[#64748B] mt-1">
                    {t("marketplace.listModal.whatsappHint")}
                  </p>
                </div>

                {/* External Buy Link — Koino does NOT process payments.
                    Sellers can link to their own checkout/website. */}
                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-wider text-[#94A3B8] mb-1.5">
                    <ExternalLink size={10} className="inline mr-0.5" /> {t("shop.form.buyLinkLabel")}
                  </label>
                  <input
                    type="url"
                    value={formData.buyUrl}
                    onChange={(e) => setFormData({ ...formData, buyUrl: e.target.value })}
                    className="neo-input text-sm"
                    placeholder={t("shop.form.buyLinkPlaceholder")}
                  />
                  <p className="text-[10px] text-[#64748B] mt-1">
                    {t("shop.form.buyLinkHint")}
                  </p>
                </div>
                <div className="flex gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    className="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-white/[0.04] text-[#94A3B8] hover:text-white border border-white/[0.06]"
                  >
                    {t("marketplace.listModal.cancel")}
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white disabled:opacity-50"
                    style={{ background: "linear-gradient(135deg, #3B82F6, #22D3EE)" }}
                  >
                    {submitting ? t("common.submitting") : t("marketplace.listModal.submit")}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─── UNIVERSAL SHARE SHEET ─── */}
      <ShareSheet request={shareReq} onClose={() => setShareReq(null)} />
    </div>
  );
}
