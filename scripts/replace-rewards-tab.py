#!/usr/bin/env python3
"""Replace the RewardsTab function in TriviaView.tsx with a version that
supports a variation picker modal."""
import re
from pathlib import Path

FILE = Path("/home/z/my-project/src/components/crosscrafted/TriviaView.tsx")
content = FILE.read_text()

# Add Tag and Palette to imports
content = content.replace(
    """  CheckCircle2,
  AlertCircle,
  LogIn,
} from "lucide-react";""",
    """  CheckCircle2,
  AlertCircle,
  LogIn,
  Tag,
  Palette,
} from "lucide-react";"""
)

NEW_FUNCTION = '''function RewardsTab({ isAuthenticated, userPoints }: { isAuthenticated: boolean; userPoints: number }) {
  const [gifts, setGifts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [claiming, setClaiming] = useState<string | null>(null);
  const [pickerGift, setPickerGift] = useState<any | null>(null);
  const [pickerSelections, setPickerSelections] = useState<Record<string, string>>({});

  const loadGifts = useCallback(() => {
    fetch("/api/trivia/gifts")
      .then((r) => r.json())
      .then((data) => {
        setGifts(data.gifts || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    loadGifts();
  }, [loadGifts]);

  const sendClaim = async (giftId: string, title: string, selectedVariations: { name: string; value: string }[]) => {
    setClaiming(giftId);
    try {
      const res = await fetch("/api/trivia/claim-gift", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ giftId, selectedVariations }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      const variationSummary =
        selectedVariations.length > 0
          ? ` · ${selectedVariations.map((v) => `${v.name}: ${v.value}`).join(", ")}`
          : "";
      toast.success(`Claimed: ${title}!`, {
        description: `Admin will contact you via WhatsApp.${variationSummary} Points spent: ${data.pointsSpent} FP.`,
      });
      loadGifts();
    } catch (e: any) {
      toast.error("Failed to claim gift", { description: e.message });
    } finally {
      setClaiming(null);
    }
  };

  const handleClaim = (gift: any) => {
    if (!isAuthenticated) {
      toast.error("Sign in required to claim gifts");
      return;
    }
    const variations = Array.isArray(gift.variations) ? gift.variations : [];
    if (variations.length > 0) {
      const initial: Record<string, string> = {};
      variations.forEach((v: any) => {
        if (v.options && v.options.length > 0) initial[v.name] = v.options[0];
      });
      setPickerSelections(initial);
      setPickerGift(gift);
      return;
    }
    sendClaim(gift.id, gift.title, []);
  };

  const confirmPickerClaim = () => {
    if (!pickerGift) return;
    const selections = Object.entries(pickerSelections).map(([name, value]) => ({ name, value }));
    sendClaim(pickerGift.id, pickerGift.title, selections);
    setPickerGift(null);
    setPickerSelections({});
  };

  const closePicker = () => {
    setPickerGift(null);
    setPickerSelections({});
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-8 h-8 rounded-full border-2 border-transparent border-t-[#F59E0B] animate-spin" />
      </div>
    );
  }

  const tierColors: Record<string, string> = {
    bronze: "#CD7F32",
    silver: "#C0C0C0",
    gold: "#FFD700",
    platinum: "#E5E4E2",
  };

  return (
    <div className="space-y-3">
      <div className="bg-gradient-to-br from-[#1C1929] to-[#2B254E] border border-[#F59E0B]/20 rounded-2xl p-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Gift size={16} className="text-[#F59E0B]" />
              <p className="text-[10px] font-bold uppercase tracking-wider text-[#F59E0B]">Real Gifts</p>
            </div>
            <p className="text-2xl font-extrabold text-white">
              {isAuthenticated ? userPoints.toLocaleString() : "—"} FP
            </p>
            <p className="text-[11px] text-[#94A3B8] mt-0.5">
              {isAuthenticated ? "Available to redeem" : "Sign in to view your points"}
            </p>
          </div>
        </div>
      </div>

      {!isAuthenticated && (
        <div className="bg-[#38BDF8]/8 border border-[#38BDF8]/20 rounded-xl p-3 text-center">
          <p className="text-xs text-[#A09DB1]">
            Sign in to redeem gifts. Your claims persist across devices.
          </p>
          <a
            href="/auth/signin"
            className="inline-block mt-2 px-4 py-2 rounded-lg bg-[#38BDF8] text-slate-950 text-xs font-bold"
          >
            Sign In
          </a>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        {gifts.map((gift, i) => {
          const canClaim = isAuthenticated && userPoints >= gift.pointsRequired && !gift.claimed && gift.stock > 0;
          const isClaimed = gift.claimed;
          const hasVariations = Array.isArray(gift.variations) && gift.variations.length > 0;
          return (
            <motion.div
              key={gift.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="bg-[#1C1929] border border-white/[0.06] rounded-2xl overflow-hidden"
            >
              <div className="relative h-24">
                <img src={gift.imageUrl} alt={gift.title} className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-[#1C1929] via-transparent to-transparent" />
                <span
                  className="absolute top-2 left-2 px-1.5 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-wider"
                  style={{ backgroundColor: `${tierColors[gift.tier]}E6`, color: "#0A0A0A" }}
                >
                  {gift.tier}
                </span>
                <span className="absolute top-2 right-2 px-1.5 py-0.5 rounded-md bg-black/60 text-white text-[9px] font-bold">
                  {gift.stock} left
                </span>
                {hasVariations && (
                  <span className="absolute bottom-2 left-2 px-1.5 py-0.5 rounded-md bg-[#F59E0B]/90 text-slate-950 text-[8px] font-bold uppercase tracking-wider">
                    {gift.variations.length} option{gift.variations.length > 1 ? "s" : ""}
                  </span>
                )}
              </div>
              <div className="p-3">
                <h3 className="text-xs font-bold text-white leading-tight mb-1 line-clamp-1">{gift.title}</h3>
                <p className="text-[10px] text-[#94A3B8] line-clamp-2 mb-2">{gift.description}</p>

                {hasVariations && (
                  <div className="flex flex-wrap gap-0.5 mb-2">
                    {gift.variations.map((v: any, vIdx: number) => (
                      <span
                        key={vIdx}
                        className="px-1 py-0.5 rounded bg-[#F59E0B]/10 text-[#F59E0B] text-[8px] font-bold uppercase tracking-wide"
                        title={`${v.name}: ${(v.options || []).join(", ")}`}
                      >
                        {v.name}
                      </span>
                    ))}
                  </div>
                )}

                <div className="flex items-center gap-1 mb-2">
                  <Zap size={10} className="text-[#F59E0B]" />
                  <span className="text-[11px] font-bold text-[#F59E0B]">{gift.pointsRequired.toLocaleString()} FP</span>
                </div>
                {isClaimed ? (
                  <div className="w-full py-2 rounded-lg bg-[#22C55E]/15 border border-[#22C55E]/30 text-[#22C55E] text-[10px] font-bold uppercase tracking-wider flex items-center justify-center gap-1">
                    <CheckCircle2 size={11} /> Claimed
                  </div>
                ) : (
                  <button
                    onClick={() => handleClaim(gift)}
                    disabled={!canClaim || claiming === gift.id}
                    className={`w-full py-2 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all ${
                      claiming === gift.id
                        ? "bg-white/[0.04] text-[#94A3B8]"
                        : canClaim
                        ? "bg-[#F59E0B] text-slate-950 hover:bg-[#E59E0B]"
                        : "bg-white/[0.04] text-[#475569] cursor-not-allowed"
                    }`}
                  >
                    {claiming === gift.id ? "Claiming..." :
                      isClaimed ? "✓ Claimed" :
                      canClaim ? (hasVariations ? "Pick & Redeem" : "Redeem") :
                      !isAuthenticated ? "Sign in" :
                      gift.stock <= 0 ? "Out of stock" :
                      `${gift.pointsRequired - userPoints} more FP`}
                  </button>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>

      <AnimatePresence>
        {pickerGift && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-end md:items-center justify-center z-[70] p-0 md:p-6"
            onClick={(e) => e.target === e.currentTarget && closePicker()}
          >
            <motion.div
              initial={{ y: 100, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 100, opacity: 0 }}
              transition={{ type: "spring", damping: 30, stiffness: 350 }}
              className="bg-[#1C1929] border border-[#F59E0B]/20 rounded-t-[28px] md:rounded-[24px] w-full max-w-md max-h-[88vh] overflow-y-auto"
            >
              <div className="relative h-32">
                <img
                  src={pickerGift.imageUrl}
                  alt={pickerGift.title}
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#1C1929] via-[#1C1929]/40 to-transparent" />
                <button
                  onClick={closePicker}
                  className="absolute top-3 right-3 w-8 h-8 rounded-full bg-black/50 backdrop-blur-sm border border-white/10 flex items-center justify-center text-white/80 hover:text-white"
                >
                  <X size={16} />
                </button>
                <div className="absolute bottom-3 left-3 right-3">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-[#F59E0B] mb-0.5">
                    {pickerGift.tier} · {pickerGift.pointsRequired.toLocaleString()} FP
                  </p>
                  <h3 className="text-base font-extrabold text-white leading-tight line-clamp-1">
                    {pickerGift.title}
                  </h3>
                </div>
              </div>

              <div className="p-4 space-y-4">
                <p className="text-[11px] text-[#A09DB1] leading-relaxed">{pickerGift.description}</p>

                <div className="space-y-3">
                  {pickerGift.variations.map((variation: any, vIdx: number) => (
                    <div key={vIdx}>
                      <p className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-[#94A3B8] mb-1.5">
                        <Tag size={10} /> {variation.name}
                        {pickerSelections[variation.name] && (
                          <span className="text-[#F59E0B] normal-case tracking-normal ml-1">
                            · {pickerSelections[variation.name]}
                          </span>
                        )}
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {variation.options.map((opt: string) => {
                          const isSelected = pickerSelections[variation.name] === opt;
                          return (
                            <button
                              key={opt}
                              onClick={() =>
                                setPickerSelections((prev) => ({ ...prev, [variation.name]: opt }))
                              }
                              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${
                                isSelected
                                  ? "bg-[#F59E0B] text-slate-950 border-[#F59E0B]"
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

                {Array.isArray(pickerGift.attributes) && pickerGift.attributes.length > 0 && (
                  <div className="space-y-1.5">
                    <p className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-[#94A3B8]">
                      <Palette size={10} /> Specifications
                    </p>
                    <div className="grid grid-cols-2 gap-1.5">
                      {pickerGift.attributes.map((attr: any, aIdx: number) => (
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

                <div className="pt-1">
                  <div className="bg-[#F59E0B]/8 border border-[#F59E0B]/20 rounded-xl p-2.5 mb-2">
                    <p className="text-[9px] font-bold uppercase tracking-wider text-[#F59E0B] mb-0.5">
                      Order Summary
                    </p>
                    <p className="text-[11px] text-white">
                      {pickerGift.title}
                      {Object.entries(pickerSelections).length > 0 && (
                        <span className="text-[#94A3B8]">
                          {" · "}
                          {Object.entries(pickerSelections)
                            .map(([n, v]) => `${n}: ${v}`)
                            .join(" · ")}
                        </span>
                      )}
                    </p>
                    <p className="text-[10px] text-[#94A3B8] mt-0.5">
                      {pickerGift.pointsRequired.toLocaleString()} FP will be deducted. Admin will contact you on WhatsApp.
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={closePicker}
                      disabled={claiming === pickerGift.id}
                      className="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-white/[0.04] text-[#94A3B8] hover:text-white border border-white/[0.06]"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={confirmPickerClaim}
                      disabled={claiming === pickerGift.id}
                      className="flex-1 py-2.5 rounded-xl text-sm font-bold text-slate-950 bg-[#F59E0B] hover:bg-[#E59E0B] transition-all disabled:opacity-50"
                    >
                      {claiming === pickerGift.id ? "Claiming..." : `Redeem for ${pickerGift.pointsRequired.toLocaleString()} FP`}
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}'''

pattern = re.compile(
    r'function RewardsTab\(\{ isAuthenticated, userPoints \}: \{ isAuthenticated: boolean; userPoints: number \}\) \{.*?^\}',
    re.DOTALL | re.MULTILINE
)

match = pattern.search(content)
if not match:
    print("ERROR: Could not find RewardsTab function")
    exit(1)

print(f"Found RewardsTab at chars {match.start()}-{match.end()}")
print(f"Old function length: {len(match.group(0))} chars")

new_content = content[:match.start()] + NEW_FUNCTION + content[match.end():]
FILE.write_text(new_content)
print(f"New function length: {len(NEW_FUNCTION)} chars")
print(f"File size: {len(content)} -> {len(new_content)} chars")
