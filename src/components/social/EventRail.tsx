"use client";

/**
 * "Upcoming Events" rail for the main feed — surfaces published church
 * events (worship nights, conferences, youth meetings) directly in the
 * social feed so discovery happens naturally while scrolling.
 *
 * Reads the public /api/events endpoint (PUBLISHED events only, sorted
 * upcoming-first) and renders nothing when the church hasn't published
 * events yet, so an empty site stays clean.
 */

import { useEffect, useState } from "react";
import { CalendarDays, MapPin, Ticket } from "lucide-react";

type FeedEvent = {
  id: string;
  title: string;
  location: string;
  category: string;
  eventType: string;
  startDate: string;
  ticketUrl: string | null;
  coverImage: string | null;
  coverGradient: number;
};

type Props = {
  onOpenEvents: () => void;
};

const GRADIENTS = [
  "from-purple-600 to-pink-500",
  "from-indigo-600 to-purple-500",
  "from-fuchsia-600 to-pink-500",
  "from-violet-600 to-indigo-500",
  "from-rose-500 to-orange-400",
  "from-blue-600 to-violet-500",
  "from-pink-500 to-rose-400",
  "from-purple-500 to-cyan-400",
];

export default function EventRail({ onOpenEvents }: Props) {
  const [events, setEvents] = useState<FeedEvent[]>([]);

  useEffect(() => {
    api_once();
    function api_once() {
      fetch("/api/events")
        .then((r) => (r.ok ? r.json() : { events: [] }))
        .then((d: { events?: FeedEvent[] }) => setEvents((d.events || []).slice(0, 6)))
        .catch(() => {});
    }
  }, []);

  if (events.length === 0) return null;

  return (
    <div className="mb-5">
      <div className="flex items-center justify-between mb-2.5">
        <h3 className="text-xs font-extrabold uppercase tracking-wider text-[#64748B] inline-flex items-center gap-1.5">
          <CalendarDays size={13} /> Upcoming Events
        </h3>
        <button onClick={onOpenEvents} className="text-[11px] font-bold text-[#7C3AED] hover:text-[#A78BFA]">
          See all
        </button>
      </div>
      <div className="flex gap-3 overflow-x-auto pb-1.5">
        {events.map((ev) => {
          const date = new Date(ev.startDate);
          const day = date.toLocaleDateString("en-IN", { day: "numeric" });
          const month = date.toLocaleDateString("en-IN", { month: "short" });
          const grad = GRADIENTS[Math.abs(ev.coverGradient ?? 0) % GRADIENTS.length];
          return (
            <div
              key={ev.id}
              className="shrink-0 w-[230px] rounded-2xl overflow-hidden bg-[#111827]/60 border border-white/[0.05] hover:border-[#7C3AED]/40 transition-colors"
            >
              <div className={`relative h-20 bg-gradient-to-br ${grad}`}>
                {ev.coverImage ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={ev.coverImage} alt="" className="w-full h-full object-cover" />
                ) : null}
                <div className="absolute top-2 left-2 px-2 py-1 rounded-lg bg-black/60 backdrop-blur-sm text-center leading-none">
                  <div className="text-sm font-extrabold text-white">{day}</div>
                  <div className="text-[9px] font-bold uppercase text-white/80">{month}</div>
                </div>
                <span className="absolute bottom-2 left-2 px-2 py-0.5 rounded-full bg-black/60 backdrop-blur-sm text-[9px] font-bold uppercase tracking-wide text-white/90">
                  {ev.eventType === "online" ? "Online" : ev.eventType === "hybrid" ? "Hybrid" : ev.category}
                </span>
              </div>
              <div className="p-2.5">
                <h4 className="text-[13px] font-bold text-white leading-snug line-clamp-1">{ev.title}</h4>
                <p className="text-[11px] text-[#94A3B8] mt-1 flex items-center gap-1">
                  <MapPin size={10} className="shrink-0" />
                  <span className="truncate">{ev.location}</span>
                </p>
                <div className="flex gap-1.5 mt-2">
                  <button
                    onClick={onOpenEvents}
                    className="flex-1 py-1.5 rounded-lg bg-[#7C3AED] text-white text-[11px] font-bold hover:bg-[#6D28D9] transition-colors"
                  >
                    View Event
                  </button>
                  {ev.ticketUrl ? (
                    <a
                      href={ev.ticketUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white/[0.06] border border-white/[0.08] text-[11px] font-bold text-[#C4B5FD] hover:border-[#7C3AED]/50 transition-colors"
                    >
                      <Ticket size={11} /> Tickets
                    </a>
                  ) : null}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
