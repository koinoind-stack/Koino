#!/usr/bin/env python3
"""Apply variations/attributes UI changes to ShopView.tsx"""
from pathlib import Path

FILE = Path("/home/z/my-project/src/components/crosscrafted/ShopView.tsx")
content = FILE.read_text()

content = content.replace(
    """  Phone,
  IndianRupee,
} from "lucide-react";""",
    """  Phone,
  IndianRupee,
  Tag,
  Palette,
} from "lucide-react";"""
)

content = content.replace(
    """import {
  PRODUCTS,
  CHURCH_GRADIENTS,
  INDIAN_STATES,
  type Product,
} from "@/lib/crosscrafted-data";""",
    """import {
  PRODUCTS,
  CHURCH_GRADIENTS,
  INDIAN_STATES,
  type Product,
  type ProductVariation,
  type ProductAttribute,
} from "@/lib/crosscrafted-data";"""
)

content = content.replace(
    """  const [openProduct, setOpenProduct] = useState<Product | null>(null);
  const [activeImageIdx, setActiveImageIdx] = useState(0);
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
    images: [] as string[],
    whatsapp_number: "",
  });""",
    """  const [openProduct, setOpenProduct] = useState<Product | null>(null);
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
    images: [] as string[],
    whatsapp_number: "",
    variations: [] as ProductVariation[],
    attributes: [] as ProductAttribute[],
  });"""
)

content = content.replace(
    """  const handleCreateProduct = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.price || !formData.whatsapp_number) {
      toast.error("Please fill in name, price, and WhatsApp number");
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
      city: formData.city || "—",
      rating: 0,
      reviews: 0,
      cover_gradient: Math.floor(Math.random() * CHURCH_GRADIENTS.length),
      cover_image: formData.images[0] || undefined,
      images: formData.images.length > 0 ? formData.images : undefined,
      in_stock: true,
      whatsapp_number: formData.whatsapp_number,
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
      images: [],
      whatsapp_number: "",
    });
    setShowCreateModal(false);
    toast.success("Product listed!", {
      description: "Buyers can now contact you on WhatsApp to purchase.",
    });
  };""",
    """  const handleCreateProduct = (e: React.FormEvent) => {
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
      city: formData.city || "—",
      rating: 0,
      reviews: 0,
      cover_gradient: Math.floor(Math.random() * CHURCH_GRADIENTS.length),
      cover_image: formData.images[0] || undefined,
      images: formData.images.length > 0 ? formData.images : undefined,
      in_stock: true,
      whatsapp_number: formData.whatsapp_number,
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
      images: [],
      whatsapp_number: "",
      variations: [],
      attributes: [],
    });
    setShowCreateModal(false);
    toast.success("Product listed!", {
      description: "Buyers can now contact you on WhatsApp to purchase.",
    });
  };"""
)

content = content.replace(
    """              onClick={() => {
                setOpenProduct(product);
                setActiveImageIdx(0);
              }}""",
    """              onClick={() => {
                setOpenProduct(product);
                setActiveImageIdx(0);
                const initial: Record<string, string> = {};
                (product.variations || []).forEach((v) => {
                  if (v.options.length > 0) initial[v.name] = v.options[0];
                });
                setSelectedVariations(initial);
              }}"""
)

content = content.replace(
    """                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-[#94A3B8] mb-1">Description</p>
                  <p className="text-sm text-[#A09DB1] leading-relaxed">{openProduct.description}</p>
                </div>

                <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-3 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#9786E3] to-[#38BDF8] flex items-center justify-center">
                    <Store size={16} className="text-white" />
                  </div>""",
    """                <div>
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
                  </div>"""
)

content = content.replace(
    """                  {openProduct.whatsapp_number && (
                    <a
                      href={`https://wa.me/${openProduct.whatsapp_number.replace(/[^0-9]/g, "")}?text=${encodeURIComponent(
                        `Hello! I'm interested in buying "${openProduct.name}" listed for ₹${openProduct.price} on CrossCrafted. Is it available?`
                      )}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 py-3 rounded-xl text-sm font-bold text-white bg-[#25D366] hover:bg-[#1FB855] transition-all hover:-translate-y-px flex items-center justify-center gap-2"
                    >
                      <WhatsAppIcon size={16} /> Contact Seller
                    </a>
                  )}""",
    """                  {openProduct.whatsapp_number && (
                    <a
                      href={`https://wa.me/${openProduct.whatsapp_number.replace(/[^0-9]/g, "")}?text=${encodeURIComponent(
                        (() => {
                          const base = `Hello! I'm interested in buying "${openProduct.name}" listed for ₹${openProduct.price} on CrossCrafted. Is it available?`;
                          const sel = Object.entries(selectedVariations);
                          if (sel.length === 0) return base;
                          const specs = sel.map(([n, v]) => `${n}: ${v}`).join(", ");
                          return `${base}\\n\\nMy preferred variation: ${specs}`;
                        })()
                      )}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 py-3 rounded-xl text-sm font-bold text-white bg-[#25D366] hover:bg-[#1FB855] transition-all hover:-translate-y-px flex items-center justify-center gap-2"
                    >
                      <WhatsAppIcon size={16} /> Contact Seller
                    </a>
                  )}"""
)

content = content.replace(
    """                <ImagePicker
                  images={formData.images}
                  onChange={(images) => setFormData({ ...formData, images })}
                  max={5}
                  label="Product Photos"
                />
                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-wider text-[#94A3B8] mb-1.5">
                    <Phone size={10} className="inline mr-0.5" /> WhatsApp Number *
                  </label>""",
    """                <ImagePicker
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
                  </label>"""
)

content = content.replace(
    """                <div className="flex items-center gap-1 mb-1.5">
                  <StarRating rating={product.rating} />
                  <span className="text-[9px] text-[#94A3B8]">({product.reviews})</span>
                </div>""",
    """                <div className="flex items-center gap-1 mb-1.5">
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
                </div>"""
)

FILE.write_text(content)
print(f"File size: {len(content)} chars")
print("Done")
