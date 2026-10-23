#!/usr/bin/env python3
"""Replace the GiftsManagement function in AdminView.tsx with an API-based
version that supports variations & attributes."""
import re
from pathlib import Path

FILE = Path("/home/z/my-project/src/components/crosscrafted/AdminView.tsx")
content = FILE.read_text()

NEW_FUNCTION = '''function GiftsManagement() {
  const [gifts, setGifts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<{
    title: string;
    description: string;
    images: string[];
    points_required: string;
    tier: "bronze" | "silver" | "gold" | "platinum";
    stock: string;
    variations: { name: string; options: string[] }[];
    attributes: { label: string; value: string }[];
  }>({
    title: "",
    description: "",
    images: [],
    points_required: "",
    tier: "bronze",
    stock: "10",
    variations: [],
    attributes: [],
  });

  const fetchGifts = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/gifts");
      const data = await res.json();
      const mapped = (data.gifts || []).map((g: any) => ({
        id: g.id,
        title: g.title,
        description: g.description,
        image_url: g.imageUrl,
        points_required: g.pointsRequired,
        tier: g.tier,
        stock: g.stock,
        isAdmin: g.isAdmin,
        variations: Array.isArray(g.variations) ? g.variations : [],
        attributes: Array.isArray(g.attributes) ? g.attributes : [],
      }));
      setGifts(mapped);
    } catch {
      toast.error("Failed to load gifts");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchGifts();
  }, [fetchGifts]);

  const resetForm = () => {
    setForm({
      title: "",
      description: "",
      images: [],
      points_required: "",
      tier: "bronze",
      stock: "10",
      variations: [],
      attributes: [],
    });
    setEditingId(null);
    setShowAddForm(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim() || !form.points_required || form.images.length === 0) {
      toast.error("Please fill in title, points, and add at least 1 image");
      return;
    }
    if (form.variations.some((v) => v.name.trim() && v.options.length === 0)) {
      toast.error("Add at least 1 option for each variation name");
      return;
    }

    const giftData = {
      title: form.title.trim(),
      description: form.description.trim(),
      imageUrl: form.images[0],
      pointsRequired: Number(form.points_required),
      tier: form.tier,
      stock: Number(form.stock) || 0,
      variations: form.variations.filter((v) => v.name.trim() && v.options.length > 0),
      attributes: form.attributes.filter((a) => a.label.trim() && a.value.trim()),
    };

    try {
      if (editingId) {
        const res = await fetch("/api/admin/gifts", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ giftId: editingId, ...giftData }),
        });
        if (!res.ok) throw new Error("Failed to update");
        toast.success("Gift updated!", { description: "Changes are live in Trivia > Rewards." });
      } else {
        const res = await fetch("/api/admin/gifts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(giftData),
        });
        if (!res.ok) throw new Error("Failed to add");
        toast.success("Gift added!", {
          description: "It's now visible in Trivia > Rewards for players to redeem.",
        });
      }
      fetchGifts();
      resetForm();
    } catch {
      toast.error("Failed to save gift");
    }
  };

  const handleEdit = (gift: any) => {
    if (!gift.isAdmin) {
      toast("Default gifts can't be edited", {
        description: "Only gifts you've added from the admin panel can be modified.",
      });
      return;
    }
    setEditingId(gift.id);
    setForm({
      title: gift.title,
      description: gift.description,
      images: [gift.image_url],
      points_required: String(gift.points_required),
      tier: gift.tier,
      stock: String(gift.stock),
      variations: Array.isArray(gift.variations) && gift.variations.length > 0
        ? gift.variations.map((v: any) => ({
            name: v.name || "",
            options: Array.isArray(v.options) ? v.options : [],
          }))
        : [],
      attributes: Array.isArray(gift.attributes) && gift.attributes.length > 0
        ? gift.attributes.map((a: any) => ({
            label: a.label || "",
            value: a.value || "",
          }))
        : [],
    });
    setShowAddForm(true);
    setTimeout(() => {
      document.getElementById("gift-form")?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 100);
  };

  const handleRemove = async (id: string) => {
    const gift = gifts.find((g) => g.id === id);
    if (!gift?.isAdmin) {
      toast("Default gifts can't be removed", {
        description: "Only gifts you've added from the admin panel can be deleted.",
      });
      return;
    }
    try {
      const res = await fetch("/api/admin/gifts", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ giftId: id }),
      });
      if (!res.ok) throw new Error("Failed to delete");
      toast("Gift removed", { description: "Players can no longer redeem this gift." });
      fetchGifts();
    } catch {
      toast.error("Failed to remove gift");
    }
  };

  const handleStockChange = async (id: string, delta: number) => {
    const gift = gifts.find((g) => g.id === id);
    if (!gift?.isAdmin) return;
    const newStock = Math.max(0, gift.stock + delta);
    try {
      await fetch("/api/admin/gifts", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ giftId: id, stock: newStock }),
      });
      fetchGifts();
    } catch {
      toast.error("Failed to update stock");
    }
  };

  const tierColors: Record<string, string> = {
    bronze: "#CD7F32",
    silver: "#C0C0C0",
    gold: "#FFD700",
    platinum: "#E5E4E2",
  };

  const adminCount = gifts.filter((g) => g.isAdmin).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="w-8 h-8 rounded-full border-2 border-transparent border-t-[#F59E0B] animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <AdminSectionHeader title="Reward Gifts" count={gifts.length} color="#F59E0B" />
        <button
          onClick={() => {
            if (showAddForm) {
              resetForm();
            } else {
              setShowAddForm(true);
            }
          }}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#F59E0B] hover:bg-[#E59E0B] text-slate-950 text-xs font-bold transition-all"
        >
          {showAddForm ? <X size={12} /> : <Plus size={12} />}
          {showAddForm ? "Cancel" : "Add Gift"}
        </button>
      </div>

      {adminCount > 0 && (
        <p className="text-[10px] text-[#64748B] px-1">
          {adminCount} admin-added · {gifts.length - adminCount} default gifts
        </p>
      )}

      <AnimatePresence>
        {showAddForm && (
          <motion.form
            id="gift-form"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            onSubmit={handleSubmit}
            className="bg-[#1C1929] border border-[#F59E0B]/20 rounded-2xl p-4 space-y-3 overflow-hidden"
          >
            <div className="flex items-center gap-2 mb-2">
              <Gift size={14} className="text-[#F59E0B]" />
              <p className="text-[11px] font-bold uppercase tracking-wider text-[#F59E0B]">
                {editingId ? "Edit Gift" : "Add New Reward Gift"}
              </p>
            </div>

            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-[#94A3B8] mb-1.5">
                Gift Title *
              </label>
              <input
                type="text"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                className="neo-input text-sm"
                placeholder="e.g. CrossCrafted Hoodie"
                required
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-[#94A3B8] mb-1.5">
                Description
              </label>
              <textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                className="neo-input text-sm h-16 resize-none"
                placeholder="What's the gift? Sizes, colors, what's included..."
              />
            </div>

            <ImagePicker
              images={form.images}
              onChange={(images) => setForm({ ...form, images })}
              max={3}
              label="Gift Photos *"
            />

            {/* Variations (sizes, colors, etc.) */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-[#94A3B8]">
                  <Tag size={11} /> Variations
                  <span className="text-[9px] text-[#475569] normal-case tracking-normal">(sizes, colors...)</span>
                </label>
                <button
                  type="button"
                  onClick={() =>
                    setForm({
                      ...form,
                      variations: [...form.variations, { name: "", options: [] }],
                    })
                  }
                  className="flex items-center gap-1 px-2 py-1 rounded-lg bg-[#F59E0B]/15 text-[#F59E0B] text-[10px] font-bold hover:bg-[#F59E0B]/25 transition-all"
                >
                  <Plus size={10} /> Add
                </button>
              </div>

              {form.variations.length === 0 && (
                <p className="text-[10px] text-[#475569] px-1 py-1.5 italic">
                  No variations. Add a "Size" or "Color" so users can pick when claiming.
                </p>
              )}

              {form.variations.map((v, vIdx) => (
                <div
                  key={vIdx}
                  className="rounded-xl bg-white/[0.02] border border-white/[0.06] p-2.5 space-y-2"
                >
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={v.name}
                      onChange={(e) => {
                        const next = [...form.variations];
                        next[vIdx] = { ...next[vIdx], name: e.target.value };
                        setForm({ ...form, variations: next });
                      }}
                      className="neo-input text-xs flex-1"
                      placeholder="Variation name (e.g. Size, Color)"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setForm({
                          ...form,
                          variations: form.variations.filter((_, i) => i !== vIdx),
                        })
                      }
                      className="w-7 h-7 rounded-lg bg-[#EF4444]/15 border border-[#EF4444]/30 text-[#EF4444] flex items-center justify-center hover:bg-[#EF4444]/25"
                    >
                      <Trash2 size={11} />
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-1.5 items-center">
                    {v.options.map((opt, oIdx) => (
                      <span
                        key={oIdx}
                        className="flex items-center gap-1 pl-2 pr-1 py-1 rounded-md bg-[#F59E0B]/10 border border-[#F59E0B]/20 text-[10px] font-semibold text-[#F59E0B]"
                      >
                        {opt}
                        <button
                          type="button"
                          onClick={() => {
                            const next = [...form.variations];
                            next[vIdx].options = next[vIdx].options.filter((_, i) => i !== oIdx);
                            setForm({ ...form, variations: next });
                          }}
                          className="w-4 h-4 rounded-full bg-[#F59E0B]/20 hover:bg-[#F59E0B]/40 flex items-center justify-center"
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
                          const next = [...form.variations];
                          next[vIdx] = {
                            ...next[vIdx],
                            options: [...next[vIdx].options, val],
                          };
                          setForm({ ...form, variations: next });
                          target.value = "";
                        }
                      }}
                      className="bg-transparent border border-dashed border-white/[0.12] rounded-md px-2 py-1 text-[10px] text-white outline-none focus:border-[#F59E0B]/50 flex-1 min-w-[100px]"
                    />
                  </div>
                </div>
              ))}
            </div>

            {/* Attributes (material, fit, weight, etc.) */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-[#94A3B8]">
                  <Palette size={11} /> Attributes
                  <span className="text-[9px] text-[#475569] normal-case tracking-normal">(material, weight...)</span>
                </label>
                <button
                  type="button"
                  onClick={() =>
                    setForm({
                      ...form,
                      attributes: [...form.attributes, { label: "", value: "" }],
                    })
                  }
                  className="flex items-center gap-1 px-2 py-1 rounded-lg bg-[#9786E3]/15 text-[#9786E3] text-[10px] font-bold hover:bg-[#9786E3]/25 transition-all"
                >
                  <Plus size={10} /> Add
                </button>
              </div>

              {form.attributes.length === 0 && (
                <p className="text-[10px] text-[#475569] px-1 py-1.5 italic">
                  No attributes. Add specs like "Material: 100% Cotton".
                </p>
              )}

              {form.attributes.map((a, aIdx) => (
                <div key={aIdx} className="flex items-center gap-2">
                  <input
                    type="text"
                    value={a.label}
                    onChange={(e) => {
                      const next = [...form.attributes];
                      next[aIdx] = { ...next[aIdx], label: e.target.value };
                      setForm({ ...form, attributes: next });
                    }}
                    className="neo-input text-xs w-[40%]"
                    placeholder="Label (e.g. Material)"
                  />
                  <input
                    type="text"
                    value={a.value}
                    onChange={(e) => {
                      const next = [...form.attributes];
                      next[aIdx] = { ...next[aIdx], value: e.target.value };
                      setForm({ ...form, attributes: next });
                    }}
                    className="neo-input text-xs flex-1"
                    placeholder="Value (e.g. 100% Cotton)"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setForm({
                        ...form,
                        attributes: form.attributes.filter((_, i) => i !== aIdx),
                      })
                    }
                    className="w-7 h-7 rounded-lg bg-[#EF4444]/15 border border-[#EF4444]/30 text-[#EF4444] flex items-center justify-center hover:bg-[#EF4444]/25 shrink-0"
                  >
                    <Trash2 size={11} />
                  </button>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-[#94A3B8] mb-1.5">
                  Points Required *
                </label>
                <input
                  type="number"
                  value={form.points_required}
                  onChange={(e) => setForm({ ...form, points_required: e.target.value })}
                  className="neo-input text-sm"
                  placeholder="500"
                  min="1"
                  required
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-[#94A3B8] mb-1.5">
                  Tier
                </label>
                <select
                  value={form.tier}
                  onChange={(e) => setForm({ ...form, tier: e.target.value as any })}
                  className="neo-input text-sm"
                >
                  <option value="bronze">Bronze</option>
                  <option value="silver">Silver</option>
                  <option value="gold">Gold</option>
                  <option value="platinum">Platinum</option>
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-[#94A3B8] mb-1.5">
                  Stock
                </label>
                <input
                  type="number"
                  value={form.stock}
                  onChange={(e) => setForm({ ...form, stock: e.target.value })}
                  className="neo-input text-sm"
                  placeholder="10"
                  min="0"
                />
              </div>
            </div>

            <div className="flex items-center gap-2 p-2 rounded-xl bg-white/[0.02] border border-white/[0.04]">
              <span
                className="px-2 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-wider"
                style={{ backgroundColor: `${tierColors[form.tier]}25`, color: tierColors[form.tier] }}
              >
                {form.tier}
              </span>
              <span className="text-[10px] text-[#94A3B8]">
                {form.points_required || "0"} pts to unlock · {form.stock || "0"} in stock
              </span>
            </div>

            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={resetForm}
                className="flex-1 py-2.5 rounded-xl bg-white/[0.04] text-[#94A3B8] hover:text-white border border-white/[0.06] text-sm font-semibold"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="flex-1 py-2.5 rounded-xl text-sm font-bold text-slate-950 bg-[#F59E0B] hover:bg-[#E59E0B] transition-all"
              >
                {editingId ? "Update Gift" : "Add Gift"}
              </button>
            </div>
          </motion.form>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
        {gifts.map((g) => {
          const admin = g.isAdmin;
          return (
            <div
              key={g.id}
              className={`bg-[#1C1929] border rounded-xl p-3 ${
                admin ? "border-[#F59E0B]/30" : "border-white/[0.06]"
              }`}
            >
              <div className="relative w-full h-24 rounded-lg overflow-hidden mb-2">
                <img src={g.image_url} alt={g.title} className="w-full h-full object-cover" />
                <span
                  className="absolute top-1 left-1 px-1.5 py-0.5 rounded-md text-[8px] font-bold uppercase tracking-wider"
                  style={{ backgroundColor: `${tierColors[g.tier]}E6`, color: "#0A0A0A" }}
                >
                  {g.tier}
                </span>
                {admin && (
                  <span className="absolute top-1 right-1 px-1.5 py-0.5 rounded-md bg-[#F59E0B] text-slate-950 text-[8px] font-bold uppercase tracking-wider">
                    Admin
                  </span>
                )}
              </div>
              <p className="text-xs font-bold text-white line-clamp-1">{g.title}</p>
              <p className="text-[9px] text-[#A09DB1] line-clamp-2 mt-0.5 mb-1">{g.description}</p>

              {((g.variations?.length || 0) > 0 || (g.attributes?.length || 0) > 0) && (
                <div className="flex flex-wrap gap-0.5 mb-1.5">
                  {g.variations?.map((v: any, vIdx: number) => (
                    <span
                      key={`v-${vIdx}`}
                      className="px-1 py-0.5 rounded-md bg-[#F59E0B]/10 text-[#F59E0B] text-[8px] font-bold uppercase tracking-wide"
                      title={`${v.name}: ${v.options?.length || 0} options`}
                    >
                      {v.name}: {(v.options || []).length}
                    </span>
                  ))}
                  {g.attributes?.map((a: any, aIdx: number) => (
                    <span
                      key={`a-${aIdx}`}
                      className="px-1 py-0.5 rounded-md bg-[#9786E3]/10 text-[#9786E3] text-[8px] font-bold uppercase tracking-wide"
                      title={`${a.label}: ${a.value}`}
                    >
                      {a.label}
                    </span>
                  ))}
                </div>
              )}

              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-bold text-[#F59E0B]">{g.points_required.toLocaleString()} pts</span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handleStockChange(g.id, -1)}
                    disabled={!admin}
                    className={`w-5 h-5 rounded flex items-center justify-center text-xs font-bold transition-all ${
                      admin ? "bg-white/[0.06] text-white hover:bg-white/[0.12]" : "bg-white/[0.02] text-[#475569] cursor-not-allowed"
                    }`}
                  >
                    −
                  </button>
                  <span className="text-[10px] font-bold text-white tabular-nums w-6 text-center">{g.stock}</span>
                  <button
                    onClick={() => handleStockChange(g.id, 1)}
                    disabled={!admin}
                    className={`w-5 h-5 rounded flex items-center justify-center text-xs font-bold transition-all ${
                      admin ? "bg-white/[0.06] text-white hover:bg-white/[0.12]" : "bg-white/[0.02] text-[#475569] cursor-not-allowed"
                    }`}
                  >
                    +
                  </button>
                </div>
              </div>
              <div className="flex gap-1">
                <button
                  onClick={() => handleEdit(g)}
                  disabled={!admin}
                  className={`flex-1 py-1.5 rounded-lg text-[10px] font-bold transition-all ${
                    admin
                      ? "bg-white/[0.04] border border-white/[0.06] text-[#94A3B8] hover:text-white"
                      : "bg-white/[0.02] text-[#475569] cursor-not-allowed"
                  }`}
                >
                  Edit
                </button>
                <button
                  onClick={() => handleRemove(g.id)}
                  disabled={!admin}
                  className={`flex items-center justify-center px-2 py-1.5 rounded-lg text-[10px] font-bold transition-all ${
                    admin
                      ? "bg-[#EF4444]/15 border border-[#EF4444]/30 text-[#EF4444] hover:bg-[#EF4444]/25"
                      : "bg-white/[0.02] text-[#475569] cursor-not-allowed"
                  }`}
                >
                  <Trash2 size={11} />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <div className="bg-[#F59E0B]/8 border border-[#F59E0B]/20 rounded-xl p-3">
        <p className="text-[10px] text-[#A09DB1] leading-relaxed">
          <span className="font-bold text-[#F59E0B]">Tip:</span> Gifts you add appear instantly in the
          Trivia → Rewards tab for players to redeem. Default gifts (without the "Admin" badge) are
          seeded examples and can't be edited or removed — only gifts you add here can be modified.
          When a player redeems a gift, contact them on WhatsApp to arrange delivery.
        </p>
      </div>
    </div>
  );
}'''

pattern = re.compile(
    r'function GiftsManagement\(\) \{.*?^\}',
    re.DOTALL | re.MULTILINE
)

match = pattern.search(content)
if not match:
    print("ERROR: Could not find GiftsManagement function")
    exit(1)

print(f"Found GiftsManagement at chars {match.start()}-{match.end()}")
print(f"Old function length: {len(match.group(0))} chars, {match.group(0).count(chr(10))} lines")

new_content = content[:match.start()] + NEW_FUNCTION + content[match.end():]
FILE.write_text(new_content)
print(f"New function length: {len(NEW_FUNCTION)} chars, {NEW_FUNCTION.count(chr(10))} lines")
print(f"File size: {len(content)} -> {len(new_content)} chars")
