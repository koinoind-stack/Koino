"use client";
import { useEffect, useState } from "react";
import type { Product, Business } from "@/lib/crosscrafted-data";

/**
 * Client hook for showcase sections (landing page picks, Explore highlights).
 * Fetches a few FEATURED items from the real database APIs. Returns empty
 * arrays while loading or when nothing is featured — every consumer hides
 * its subsection when a list is empty (no invented listings).
 */

type ApiProductLike = {
  id: string; kind: string; name: string; description: string; price: number;
  mrp: number | null; category: string; vendor: string; sellerType: string;
  state: string; city: string; cover_gradient: number; cover_image: string | null;
  images: string[]; in_stock: boolean; featured: boolean; buyUrl: string | null;
};

type ApiBusinessLike = {
  id: string; name: string; description: string; category: string;
  state: string; city: string; cover_image: string | null; images: string[];
  cover_gradient: number; verified: boolean; featured: boolean;
  hours: string | null; services: string[]; createdAt: string;
};

export function useFeaturedPicks(limit = 3) {
  const [products, setProducts] = useState<Product[]>([]);
  const [businesses, setBusinesses] = useState<Business[]>([]);

  useEffect(() => {
    let live = true;
    fetch(`/api/marketplace?featured=1&limit=${limit}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!live || !d?.products) return;
        setProducts(
          (d.products as ApiProductLike[]).map((c) => ({
            id: c.id, name: c.name, description: c.description, price: c.price,
            mrp: c.mrp ?? c.price, category: c.category, vendor: c.vendor,
            sellerType: c.sellerType as Product["sellerType"], state: c.state,
            city: c.city, rating: 0, reviews: 0, cover_gradient: c.cover_gradient,
            cover_image: c.cover_image ?? undefined, images: c.images,
            in_stock: c.in_stock, status: "published" as const, featured: c.featured,
            buyUrl: c.buyUrl ?? undefined,
          }))
        );
      })
      .catch(() => {});
    fetch(`/api/businesses?featured=1&limit=${limit}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!live || !d?.businesses) return;
        setBusinesses(
          (d.businesses as ApiBusinessLike[]).map((c) => ({
            id: c.id, name: c.name, description: c.description, category: c.category,
            country: "India", state: c.state, city: c.city, languages: [],
            cover_image: c.cover_image ?? undefined, cover_gradient: c.cover_gradient,
            hours: c.hours ?? undefined, services: c.services,
            verified: c.verified, featured: c.featured, status: "approved" as const,
            createdAt: c.createdAt,
          }))
        );
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [limit]);

  return { products, businesses };
}
