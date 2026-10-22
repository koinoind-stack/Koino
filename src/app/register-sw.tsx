"use client";
import { useEffect } from "react";

// Registers the Koino service worker for PWA installability.
// Only runs in production (not during development).
export default function ServiceWorkerRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV === "production" && "serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // SW registration failure is non-fatal — the app still works online
      });
    }
  }, []);
  return null;
}
