"use client";

import { useRef, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Image as ImageIcon, X, Camera, Plus } from "lucide-react";
import { toast } from "sonner";

type Props = {
  images: string[];
  onChange: (images: string[]) => void;
  max?: number;
  label?: string;
};

/**
 * Image picker that lets users select actual images from their device
 * (phone gallery, camera, or files). Converts to base64 data URLs — no
 * backend upload needed. Works offline once selected.
 */
export default function ImagePicker({ images, onChange, max = 5, label = "Cover Images" }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  const handleFiles = useCallback(
    (files: FileList | null) => {
      if (!files || files.length === 0) return;
      const fileArray = Array.from(files).filter((f) => f.type.startsWith("image/"));

      if (fileArray.length === 0) {
        toast.error("Please select image files only");
        return;
      }

      const remaining = max - images.length;
      if (fileArray.length > remaining) {
        toast(`Only ${remaining} more image${remaining === 1 ? "" : "s"} can be added`, {
          description: `Maximum ${max} images total.`,
        });
      }

      const toProcess = fileArray.slice(0, remaining);
      Promise.all(
        toProcess.map(
          (file) =>
            new Promise<string>((resolve, reject) => {
              const reader = new FileReader();
              reader.onload = () => resolve(reader.result as string);
              reader.onerror = reject;

              // Compress: if image is large, downscale via canvas
              const img = new Image();
              img.onload = () => {
                const MAX_DIM = 1200; // max width or height
                let { width, height } = img;
                if (width > MAX_DIM || height > MAX_DIM) {
                  const ratio = Math.min(MAX_DIM / width, MAX_DIM / height);
                  width = Math.round(width * ratio);
                  height = Math.round(height * ratio);
                }
                const canvas = document.createElement("canvas");
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext("2d");
                if (!ctx) {
                  resolve(reader.result as string);
                  return;
                }
                ctx.drawImage(img, 0, 0, width, height);
                resolve(canvas.toDataURL("image/jpeg", 0.82));
              };
              img.onerror = () => resolve(reader.result as string);
              img.src = URL.createObjectURL(file);
              reader.readAsDataURL(file);
            })
        )
      )
        .then((dataUrls) => {
          onChange([...images, ...dataUrls]);
        })
        .catch(() => toast.error("Failed to load images"));
    },
    [images, max, onChange]
  );

  const handleRemove = (idx: number) => {
    onChange(images.filter((_, i) => i !== idx));
  };

  const canAddMore = images.length < max;

  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <label className="block text-[11px] font-semibold uppercase tracking-wider text-[#94A3B8]">
          <ImageIcon size={10} className="inline mr-0.5" /> {label}{" "}
          <span className="text-[#64748B] normal-case font-normal">
            ({images.length}/{max})
          </span>
        </label>
        {canAddMore && (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="flex items-center gap-1 px-2 py-1 rounded-lg bg-[#7C3AED]/15 border border-[#7C3AED]/30 text-[#A78BFA] text-[10px] font-bold hover:bg-[#7C3AED]/25 transition-all"
          >
            <Plus size={10} /> Add Image
          </button>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        capture="environment"
        className="hidden"
        onChange={(e) => {
          handleFiles(e.target.files);
          e.target.value = ""; // reset so same file can be re-selected
        }}
      />

      {/* Drop zone / empty state */}
      {images.length === 0 ? (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            handleFiles(e.dataTransfer.files);
          }}
          className={`w-full p-6 rounded-xl border-2 border-dashed transition-all flex flex-col items-center justify-center gap-2 text-center ${
            dragOver
              ? "border-[#7C3AED] bg-[#7C3AED]/10"
              : "border-white/[0.12] bg-white/[0.02] hover:border-white/[0.2] hover:bg-white/[0.04]"
          }`}
        >
          <div className="w-12 h-12 rounded-2xl bg-[#7C3AED]/15 border border-[#7C3AED]/30 flex items-center justify-center">
            <Camera size={20} className="text-[#A78BFA]" />
          </div>
          <div>
            <p className="text-sm font-bold text-white">Tap to add photos</p>
            <p className="text-[10px] text-[#94A3B8] mt-0.5">
              Take a photo or pick from gallery · up to {max} images
            </p>
          </div>
        </button>
      ) : (
        <div className="grid grid-cols-3 gap-2">
          <AnimatePresence>
            {images.map((img, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                className={`relative aspect-square rounded-xl overflow-hidden border ${
                  idx === 0
                    ? "border-[#7C3AED]/50 ring-2 ring-[#7C3AED]/20"
                    : "border-white/[0.08]"
                }`}
              >
                <img src={img} alt={`Upload ${idx + 1}`} className="w-full h-full object-cover" />
                {idx === 0 && (
                  <span className="absolute top-1 left-1 px-1.5 py-0.5 rounded-md bg-[#7C3AED] text-white text-[8px] font-bold uppercase tracking-wider">
                    Cover
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => handleRemove(idx)}
                  className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/60 backdrop-blur-sm border border-white/20 flex items-center justify-center text-white/90 hover:text-white hover:bg-[#EF4444]/80 transition-all"
                >
                  <X size={12} />
                </button>
              </motion.div>
            ))}
          </AnimatePresence>

          {canAddMore && (
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="aspect-square rounded-xl border-2 border-dashed border-white/[0.12] bg-white/[0.02] hover:border-[#7C3AED]/40 hover:bg-[#7C3AED]/8 flex flex-col items-center justify-center gap-1 transition-all"
            >
              <Plus size={18} className="text-[#94A3B8]" />
              <span className="text-[9px] font-bold text-[#94A3B8]">Add More</span>
            </button>
          )}
        </div>
      )}

      {images.length > 0 && (
        <p className="text-[10px] text-[#64748B] mt-1.5">
          First image is the cover. Drag-and-drop also supported on desktop.
          {images.length < 3 && (
            <span className="text-[#F59E0B]"> · Tip: add at least 3 photos for best results.</span>
          )}
        </p>
      )}
    </div>
  );
}
