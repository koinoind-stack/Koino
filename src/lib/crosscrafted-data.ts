// CrossCrafted — Sample Data
// All data is seeded locally; no backend required.

export type ServiceTime = {
  language: string; // e.g. "English", "Hindi", "Tamil"
  time: string; // e.g. "8:00 AM - 11:00 AM"
  day: string; // e.g. "Sunday", "Wednesday"
};

export type Church = {
  id: string;
  name: string;
  description: string;
  state: string;
  city: string;
  location: string;
  service_times: ServiceTime[];
  languages: string[];
  followers_count: number;
  cover_gradient: number;
  cover_image?: string;
  images?: string[];
  status: "verified" | "pending" | "PENDING" | "PUBLISHED" | "REJECTED" | "CANCELLED";
  featured?: boolean;
  denomination: string;
  whatsapp_number?: string;
  // Admin-only fields (populated by /api/admin/churches, never by public /api/churches)
  rejectionReason?: string | null;
  reviewedBy?: string | null;
  reviewedAt?: string | null;
  createdById?: string | null;
  createdByEmail?: string | null;
  createdAt?: string;
  updatedAt?: string;
};

export type EventType = "in-person" | "online" | "hybrid";

export type EventItem = {
  id: string;
  title: string;
  description: string;
  date: string; // ISO (start date)
  end_date?: string;
  startTime?: string;  // "HH:MM"
  endTime?: string;    // "HH:MM"
  allDay?: boolean;
  country: string;
  state: string;
  city: string;
  address?: string;
  venueName?: string;       // venue name for in-person/hybrid
  location: string;
  languages: string[];
  category: string;
  eventType: EventType;
  is_online: boolean;
  onlineUrl?: string;
  registrationType?: "free" | "paid" | "registration_required" | "no_registration";
  ticketUrl?: string;
  whatsappNumber?: string;
  organizerName?: string;
  organizerEmail?: string;
  organizerPhone?: string;
  organizerWebsite?: string;
  is_free: boolean;
  price: number;
  attendees: number;
  cover_gradient: number;
  cover_image?: string;
  images?: string[];
  church: string;
  whatsapp_number?: string; // backward compat
  status?: "upcoming" | "cancelled" | "ended" | "pending_review" | "approved" | "rejected" | "published";
  featured?: boolean;
};

export type PrayerPost = {
  id: string;
  title: string;
  content: string;
  category: string;
  author: string;
  is_anonymous: boolean;
  pray_count: number;
  comment_count: number;
  created_at: string;
};

export type ApologeticsPost = {
  id: string;
  title: string;
  body: string;
  author: string;
  topic: string;
  date: string;
  likes: number;
  comments: number;
  cover_gradient: number;
  cover_image?: string;
  slug?: string; // for DB-backed articles — links to /apologetics/[slug]
  featured?: boolean;
};

export type ApologeticsAnswer = {
  id: string;
  author: string;
  authorRole: "Pastor" | "Church Leader" | "Admin" | "Member";
  authorChurch?: string;
  body: string;
  date: string;
  is_accepted: boolean;
  likes: number;
};

export type ApologeticsQuestion = {
  id: string;
  title: string;
  body: string;
  author: string;
  topic: string;
  date: string;
  likes: number;
  answers: ApologeticsAnswer[];
  status: "open" | "answered" | "closed";
};

export type ProductVariation = {
  name: string;       // e.g. "Size", "Color"
  options: string[];  // e.g. ["S","M","L","XL"] or ["Black","White"]
};

export type ProductAttribute = {
  label: string;  // e.g. "Material"
  value: string;  // e.g. "100% Cotton"
};

export type SellerType = "believ" | "marketplace";

export type Product = {
  id: string;
  name: string;
  description: string;
  price: number;
  mrp: number;
  category: string;
  subcategory?: string;
  vendor: string;
  sellerType: SellerType;        // believ = official Koino Store, marketplace = third-party seller
  state: string;                 // e.g. "Karnataka" — empty for online-only
  city: string;                  // e.g. "Bengaluru"
  rating: number;
  reviews: number;
  cover_gradient: number;
  cover_image?: string;
  images?: string[];
  in_stock: boolean;
  whatsapp_number?: string;
  buyUrl?: string;              // external buy/checkout link — Koino does NOT process payments
  status?: "draft" | "pending_review" | "published" | "rejected" | "unlisted";
  featured?: boolean;
  // Optional variations (e.g. sizes, colors) and attributes (e.g. material, weight).
  variations?: ProductVariation[];
  attributes?: ProductAttribute[];
};

export type Business = {
  id: string;
  name: string;
  description: string;
  category: string;             // see BUSINESS_CATEGORIES
  country: string;              // "India"
  state: string;
  city: string;
  address?: string;
  languages: string[];
  logo?: string;
  cover_image?: string;
  whatsapp_number?: string;
  website?: string;
  phone?: string;
  email?: string;
  hours?: string;               // free-text business hours for now (e.g. "Mon-Sat 9am-7pm")
  services?: string[];         // list of services the business offers
  social?: { label: string; url: string }[]; // optional social links (Instagram, Facebook, etc.)
  rating?: number;              // average rating (1-5) — only set if real reviews exist
  reviews?: number;             // review count — only set if real reviews exist
  cover_gradient: number;
  status?: "pending" | "approved" | "rejected" | "suspended";
  featured?: boolean;
  verified?: boolean;           // shown as ✓ Verified badge when true
  productIds?: string[];        // IDs of Marketplace products associated with this business
  ownerId?: string;             // userId of the business owner (server-side enforced)
  createdAt?: string;           // ISO timestamp for "Newest" sorting
};

export type TriviaQuestion = {
  id: string;
  question: string;
  options: string[];
  answer: number;
  explanation: string;
  points: number;
  difficulty: "beginners" | "intermediate" | "skilled" | "expert";
  category: "full_bible" | "new_testament" | "old_testament" | "apologetics";
};

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

export const INDIAN_STATES = [
  "Andhra Pradesh", "Assam", "Bihar", "Chhattisgarh", "Delhi", "Goa", "Gujarat",
  "Haryana", "Karnataka", "Kerala", "Madhya Pradesh", "Maharashtra", "Odisha",
  "Punjab", "Rajasthan", "Tamil Nadu", "Telangana", "Uttar Pradesh", "West Bengal",
];

// Single source of truth for the city dropdown that depends on the selected state.
// Add cities here as the platform grows — keep this colocated with INDIAN_STATES
// so state/city data is never split across multiple files.
export const INDIAN_CITIES_BY_STATE: Record<string, string[]> = {
  "Andhra Pradesh": ["Visakhapatnam", "Vijayawada", "Guntur", "Tirupati", "Nellore", "Kurnool"],
  "Assam": ["Guwahati", "Dibrugarh", "Silchar", "Jorhat"],
  "Bihar": ["Patna", "Gaya", "Bhagalpur", "Muzaffarpur"],
  "Chhattisgarh": ["Raipur", "Bhilai", "Bilaspur"],
  "Delhi": ["New Delhi", "Dwarka", "Rohini", "Saket"],
  "Goa": ["Panaji", "Margao", "Vasco da Gama"],
  "Gujarat": ["Ahmedabad", "Surat", "Vadodara", "Rajkot", "Gandhinagar"],
  "Haryana": ["Gurugram", "Faridabad", "Panipat", "Ambala"],
  "Karnataka": ["Bengaluru", "Mysuru", "Mangaluru", "Hubli", "Belagavi"],
  "Kerala": ["Kochi", "Thiruvananthapuram", "Kozhikode", "Thrissur", "Kollam"],
  "Madhya Pradesh": ["Bhopal", "Indore", "Jabalpur", "Gwalior"],
  "Maharashtra": ["Mumbai", "Pune", "Nagpur", "Nashik", "Aurangabad"],
  "Odisha": ["Bhubaneswar", "Cuttack", "Rourkela"],
  "Punjab": ["Ludhiana", "Amritsar", "Jalandhar", "Patiala"],
  "Rajasthan": ["Jaipur", "Jodhpur", "Udaipur", "Kota", "Ajmer"],
  "Tamil Nadu": ["Chennai", "Coimbatore", "Madurai", "Tiruchirappalli", "Salem"],
  "Telangana": ["Hyderabad", "Warangal", "Nizamabad", "Karimnagar", "Khammam"],
  "Uttar Pradesh": ["Lucknow", "Kanpur", "Agra", "Varanasi", "Meerut", "Noida"],
  "West Bengal": ["Kolkata", "Howrah", "Durgapur", "Siliguri"],
};

// Returns the cities for a given state (or empty array if state has no city list yet).
export function getCitiesForState(state: string): string[] {
  return INDIAN_CITIES_BY_STATE[state] || [];
}

export const LANGUAGES = [
  "Hindi", "English", "Tamil", "Telugu", "Malayalam",
  "Kannada", "Marathi", "Gujarati", "Punjabi", "Bengali", "Odia",
];

export const CHURCH_GRADIENTS = [
  "linear-gradient(135deg, #A855F7, #3B82F6)",
  "linear-gradient(135deg, #EC4899, #A855F7)",
  "linear-gradient(135deg, #3B82F6, #6366F1)",
  "linear-gradient(135deg, #F97316, #EC4899)",
  "linear-gradient(135deg, #6366F1, #A855F7)",
  "linear-gradient(135deg, #22C55E, #3B82F6)",
  "linear-gradient(135deg, #F59E0B, #EF4444)",
  "linear-gradient(135deg, #14B8A6, #6366F1)",
];

// Single source of truth for event categories.
// Used by the Events filter row, the create-event form, and (eventually)
// the admin event form / server-side validation. Do NOT duplicate this list.
export const EVENT_CATEGORIES = [
  { value: "worship", label: "Worship", color: "#EC4899" },
  { value: "conference", label: "Conference", color: "#F59E0B" },
  { value: "prayer", label: "Prayer", color: "#A855F7" },
  { value: "bible-study", label: "Bible Study", color: "#6366F1" },
  { value: "youth", label: "Youth", color: "#3B82F6" },
  { value: "young-adults", label: "Young Adults", color: "#0EA5E9" },
  { value: "men", label: "Men", color: "#0284C7" },
  { value: "women", label: "Women", color: "#DB2777" },
  { value: "family", label: "Family", color: "#16A34A" },
  { value: "children", label: "Children", color: "#65A30D" },
  { value: "music", label: "Music", color: "#F43F5E" },
  { value: "workshop", label: "Workshop", color: "#14B8A6" },
  { value: "seminar", label: "Seminar", color: "#8B5CF6" },
  { value: "outreach", label: "Outreach", color: "#06B6D4" },
  { value: "fellowship", label: "Fellowship", color: "#22C55E" },
  { value: "retreat", label: "Retreat", color: "#10B981" },
  { value: "concert", label: "Concert", color: "#EF4444" },
  { value: "other", label: "Other", color: "#94A3B8" },
] as const;

// Date filter pills used by the Events filter row.
// Single source of truth so the create-event date picker and the
// admin filters don't drift.
export const EVENT_DATE_FILTERS = [
  { v: "all", l: "All Events" },
  { v: "today", l: "Today" },
  { v: "tomorrow", l: "Tomorrow" },
  { v: "weekend", l: "This Weekend" },
  { v: "week", l: "This Week" },
  { v: "month", l: "This Month" },
] as const;

export const QUIZ_LEVELS = [
  { id: "beginners", label: "Beginners", points: 10, color: "#22C55E", icon: "🌱", description: "New to Bible study" },
  { id: "intermediate", label: "Intermediate", points: 20, color: "#3B82F6", icon: "📖", description: "Regular Bible reader" },
  { id: "skilled", label: "Skilled", points: 30, color: "#A855F7", icon: "🎓", description: "Deep Bible knowledge" },
  { id: "expert", label: "Expert", points: 50, color: "#EF4444", icon: "🏆", description: "Theology scholar level" },
] as const;

export const QUIZ_CATEGORIES = [
  { id: "full_bible", label: "Full Bible", color: "#A855F7", icon: "BookOpen" },
  { id: "new_testament", label: "New Testament", color: "#3B82F6", icon: "Cross" },
  { id: "old_testament", label: "Old Testament", color: "#F59E0B", icon: "Scroll" },
  { id: "apologetics", label: "Apologetics", color: "#EF4444", icon: "Shield" },
] as const;

export const PRIZE_TIERS = [
  { minPoints: 0, title: "Faith Seeker", icon: "🌱", reward: "Welcome badge" },
  { minPoints: 100, title: "Bible Student", icon: "📖", reward: "Profile badge + 1 free church listing" },
  { minPoints: 500, title: "Spiritual Disciple", icon: "✝️", reward: "Featured profile + 3 church listings" },
  { minPoints: 1500, title: "Bible Teacher", icon: "🎓", reward: "Verified badge + priority event listing" },
  { minPoints: 3000, title: "Theology Scholar", icon: "🏆", reward: "Expert badge + free business listing" },
  { minPoints: 5000, title: "Word Warrior", icon: "⚔️", reward: "Champion badge + featured on homepage" },
  { minPoints: 10000, title: "Bible Master", icon: "👑", reward: "Master badge + admin recognition" },
] as const;

export const APOLOGETICS_TOPICS = [
  { id: "gods_existence", label: "God's Existence", color: "#A855F7" },
  { id: "problem_of_evil", label: "Problem of Evil", color: "#EF4444" },
  { id: "resurrection", label: "Resurrection", color: "#22C55E" },
  { id: "bible_reliability", label: "Bible Reliability", color: "#3B82F6" },
  { id: "science_faith", label: "Science & Faith", color: "#F59E0B" },
  { id: "world_religions", label: "World Religions", color: "#EC4899" },
] as const;

export const PRAYER_CATEGORIES = [
  "All", "Healing", "Family", "Guidance", "Thanksgiving", "Salvation", "Provision",
] as const;

// ─────────────────────────────────────────────────────────────────────────────
// MARKETPLACE / KOINO STORE
// ─────────────────────────────────────────────────────────────────────────────

// Single source of truth for Marketplace + Koino Store product categories.
// Used by the ShopView filter row, the List Item form, and (eventually) the
// admin product form / server-side validation. Do NOT duplicate this list.
export const MARKETPLACE_CATEGORIES = [
  "Bibles",
  "Books",
  "Christian Clothing",
  "T-Shirts",
  "Hoodies",
  "Accessories",
  "Phone Covers",
  "Christian Art",
  "Wall Art",
  "Gifts",
  "Home & Living",
  "Music",
  "Kids",
  "Stationery",
  "Apparel",
  "Other",
] as const;

// ─────────────────────────────────────────────────────────────────────────────
// CHRISTIAN BUSINESS DIRECTORY
// ─────────────────────────────────────────────────────────────────────────────

// Single source of truth for Business Directory categories.
// Used by the BusinessDirectoryView filter row, the ListYourEntity (business
// variant) form, and admin category management. Do NOT duplicate.
export const BUSINESS_CATEGORIES = [
  "Christian Bookstores",
  "Bibles & Christian Books",
  "Christian Clothing",
  "Christian Gifts & Merchandise",
  "Christian Wedding Services",
  "Wedding Caterers",
  "Christian Event Planners",
  "Christian Photographers",
  "Christian Videographers",
  "Christian Bakers",
  "Christian Home Bakers",
  "Christian Restaurants & Cafes",
  "Christian Schools & Education",
  "Christian Counselling",
  "Christian Travel Services",
  "Christian Media",
  "Christian Music",
  "Church Supplies",
  "Christian Designers",
  "Christian Printers",
  "Christian IT & Digital Services",
  "Christian Marketing",
  "Christian Real Estate",
  "Christian Professionals",
  "Other Christian Businesses",
] as const;

// ─────────────────────────────────────────────────────────────────────────────
// CHURCHES
// ─────────────────────────────────────────────────────────────────────────────

export const CHURCHES: Church[] = [
  {
    id: "c1",
    name: "Grace City Church",
    description:
      "A vibrant multi-generational community passionate about Jesus, authentic worship, and reaching the city with the gospel. We meet every Sunday with dedicated ministries for kids, youth, and young adults.",
    state: "Karnataka",
    city: "Bengaluru",
    location: "Indiranagar, 100 Feet Road",
    service_times: [
      { language: "English", day: "Sunday", time: "8:00 AM - 11:00 AM" },
      { language: "Kannada", day: "Sunday", time: "11:30 AM - 2:00 PM" },
      { language: "English", day: "Wednesday", time: "7:00 PM - 8:30 PM" },
    ],
    languages: ["English", "Kannada", "Hindi"],
    followers_count: 1240,
    cover_gradient: 0,
    cover_image: "https://images.unsplash.com/photo-1520637836862-4d197d17c91a?crop=entropy&cs=srgb&fm=jpg&w=800&q=80",
    images: [
      "https://images.unsplash.com/photo-1520637836862-4d197d17c91a?crop=entropy&cs=srgb&fm=jpg&w=800&q=80",
      "https://images.unsplash.com/photo-1516223298848-69b6c3c7a2d5?crop=entropy&cs=srgb&fm=jpg&w=800&q=80",
      "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?crop=entropy&cs=srgb&fm=jpg&w=800&q=80",
    ],
    status: "verified",
    denomination: "Non-denominational",
    whatsapp_number: "+919876543210",
  },
  {
    id: "c2",
    name: "New Life Fellowship",
    description:
      "A Spirit-filled church family where everyone belongs. We focus on Bible teaching, Spirit-led worship, and serving the poor in our city through practical outreach every weekend.",
    state: "Maharashtra",
    city: "Mumbai",
    location: "Bandra West, Hill Road",
    service_times: [
      { language: "English", day: "Sunday", time: "8:00 AM - 10:00 AM" },
      { language: "Hindi", day: "Sunday", time: "10:30 AM - 12:30 PM" },
      { language: "Marathi", day: "Sunday", time: "6:00 PM - 8:00 PM" },
      { language: "English", day: "Friday", time: "7:30 PM - 9:00 PM" },
    ],
    languages: ["English", "Hindi", "Marathi"],
    followers_count: 2180,
    cover_gradient: 1,
    cover_image: "https://images.unsplash.com/photo-1516223298848-69b6c3c7a2d5?crop=entropy&cs=srgb&fm=jpg&w=800&q=80",
    images: [
      "https://images.unsplash.com/photo-1516223298848-69b6c3c7a2d5?crop=entropy&cs=srgb&fm=jpg&w=800&q=80",
      "https://images.unsplash.com/photo-1438032005730-c779502df39b?crop=entropy&cs=srgb&fm=jpg&w=800&q=80",
      "https://images.unsplash.com/photo-1473773508845-188df298d2d1?crop=entropy&cs=srgb&fm=jpg&w=800&q=80",
    ],
    status: "verified",
    denomination: "Pentecostal",
    whatsapp_number: "+919876543211",
  },
  {
    id: "c3",
    name: "Bethel AG Church",
    description:
      "A historic Assemblies of God congregation with a heart for missions, healing, and discipleship. Building strong families and equipping saints for service since 1965.",
    state: "Tamil Nadu",
    city: "Chennai",
    location: "T. Nagar, Pondy Bazaar",
    service_times: [
      { language: "Tamil", day: "Sunday", time: "7:00 AM - 9:00 AM" },
      { language: "English", day: "Sunday", time: "9:30 AM - 11:30 AM" },
      { language: "Tamil", day: "Sunday", time: "6:00 PM - 8:00 PM" },
      { language: "English", day: "Tuesday", time: "7:00 PM - 8:30 PM" },
    ],
    languages: ["English", "Tamil"],
    followers_count: 3420,
    cover_gradient: 2,
    cover_image: "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?crop=entropy&cs=srgb&fm=jpg&w=800&q=80",
    status: "verified",
    denomination: "Assemblies of God",
    whatsapp_number: "+919876543212",
  },
  {
    id: "c4",
    name: "Covenant Community Church",
    description:
      "Reformed in theology, charismatic in practice. We are a church planting church that values expository preaching, deep community, and joyful worship.",
    state: "Telangana",
    city: "Hyderabad",
    location: "Jubilee Hills, Road No. 36",
    service_times: [
      { language: "English", day: "Sunday", time: "9:00 AM - 11:00 AM" },
      { language: "Telugu", day: "Sunday", time: "11:30 AM - 1:30 PM" },
      { language: "English", day: "Wednesday", time: "7:15 PM - 8:45 PM" },
    ],
    languages: ["English", "Telugu"],
    followers_count: 980,
    cover_gradient: 3,
    cover_image: "https://images.unsplash.com/photo-1438032005730-c779502df39b?crop=entropy&cs=srgb&fm=jpg&w=800&q=80",
    status: "verified",
    denomination: "Reformed",
    whatsapp_number: "+919876543213",
  },
  {
    id: "c5",
    name: "Zion Mar Thoma Church",
    description:
      "A traditional Malankara Mar Thoma congregation blending liturgical worship with Spirit-filled preaching. Active youth ministry, Sunday school, and outreach to local villages.",
    state: "Kerala",
    city: "Kochi",
    location: "Edappally, NH 66",
    service_times: [
      { language: "Malayalam", day: "Sunday", time: "6:30 AM - 8:30 AM" },
      { language: "English", day: "Sunday", time: "9:00 AM - 11:00 AM" },
      { language: "Malayalam", day: "Friday", time: "7:00 PM - 8:30 PM" },
    ],
    languages: ["Malayalam", "English"],
    followers_count: 1675,
    cover_gradient: 4,
    cover_image: "https://images.unsplash.com/photo-1546484959-f9a381d1330d?crop=entropy&cs=srgb&fm=jpg&w=800&q=80",
    status: "verified",
    denomination: "Mar Thoma",
    whatsapp_number: "+919876543214",
  },
  {
    id: "c6",
    name: "Delhi Bible Chapel",
    description:
      "An open Brethren assembly committed to the authority of Scripture, weekly remembrance meeting, and expository Bible teaching. Warm fellowship, simple worship, no paid clergy.",
    state: "Delhi",
    city: "New Delhi",
    location: "Saket, District Centre",
    service_times: [
      { language: "English", day: "Sunday", time: "9:30 AM - 11:30 AM" },
      { language: "Hindi", day: "Sunday", time: "11:30 AM - 1:00 PM" },
      { language: "English", day: "Wednesday", time: "7:30 PM - 9:00 PM" },
    ],
    languages: ["English", "Hindi"],
    followers_count: 540,
    cover_gradient: 5,
    cover_image: "https://images.unsplash.com/photo-1473773508845-188df298d2d1?crop=entropy&cs=srgb&fm=jpg&w=800&q=80",
    status: "pending",
    denomination: "Brethren",
    whatsapp_number: "+919876543215",
  },
  {
    id: "c7",
    name: "Calvary Baptist Church",
    description:
      "An old-school Baptist congregation holding to believer's baptism, regenerate church membership, and expositional preaching. Strong Sunday school, missions focus, and community care.",
    state: "Punjab",
    city: "Ludhiana",
    location: "Model Town, Gurmandi Road",
    service_times: [
      { language: "English", day: "Sunday", time: "10:00 AM - 12:00 PM" },
      { language: "Punjabi", day: "Sunday", time: "6:00 PM - 8:00 PM" },
      { language: "English", day: "Thursday", time: "7:00 PM - 8:30 PM" },
    ],
    languages: ["English", "Punjabi", "Hindi"],
    followers_count: 720,
    cover_gradient: 6,
    cover_image: "https://images.unsplash.com/photo-1565728744382-61accd4aa148?crop=entropy&cs=srgb&fm=jpg&w=800&q=80",
    status: "verified",
    denomination: "Baptist",
    whatsapp_number: "+919876543216",
  },
  {
    id: "c8",
    name: "Living Hope Church",
    description:
      "A young plant church in the heart of the city. Casual, contemporary, and gospel-centered. We exist to make disciples who make disciples — come as you are.",
    state: "Karnataka",
    city: "Bengaluru",
    location: "Koramangala, 5th Block",
    service_times: [
      { language: "English", day: "Sunday", time: "10:30 AM - 12:30 PM" },
      { language: "English", day: "Wednesday", time: "7:30 PM - 9:00 PM" },
    ],
    languages: ["English"],
    followers_count: 410,
    cover_gradient: 7,
    cover_image: "https://images.unsplash.com/photo-1496950866446-3253e1470e8e?crop=entropy&cs=srgb&fm=jpg&w=800&q=80",
    status: "pending",
    denomination: "Non-denominational",
    whatsapp_number: "+919876543217",
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// EVENTS
// ─────────────────────────────────────────────────────────────────────────────

const inDays = (days: number) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString();
};

export const EVENTS: EventItem[] = [
  {
    id: "e1",
    title: "Awakening Night of Worship",
    description:
      "Join 1,000+ believers for an unforgettable night of Spirit-led worship, prayer, and a powerful message on revival. Featuring the Grace City Worship team and guest speaker Pastor Philip Cherian.",
    date: inDays(3),
    end_date: inDays(3),
    country: "India",
    state: "Karnataka",
    city: "Bengaluru",
    address: "Palace Grounds, Main Hall, Bengaluru, Karnataka 560001",
    location: "Palace Grounds, Main Hall",
    languages: ["English"],
    category: "worship",
    eventType: "in-person",
    is_online: false,
    ticketUrl: "https://example-tickets.com/awakening-night",
    organizerName: "Philip Cherian",
    is_free: false,
    price: 0,
    attendees: 740,
    cover_gradient: 0,
    cover_image: "https://images.unsplash.com/photo-1516223298848-69b6c3c7a2d5?crop=entropy&cs=srgb&fm=jpg&w=800&q=80",
    church: "Grace City Church",
    whatsapp_number: "+919876543210",
    status: "upcoming",
    featured: true,
  },
  {
    id: "e2",
    title: "Romans: A 6-Week Bible Study",
    description:
      "Deep dive into Paul's masterpiece letter to the Romans. Verse-by-verse teaching, small group discussion, and weekly reflection assignments. All materials provided.",
    date: inDays(7),
    country: "India",
    state: "Maharashtra",
    city: "Mumbai",
    address: "New Life Fellowship, Main Auditorium, Mumbai, Maharashtra 400050",
    location: "New Life Fellowship, Main Auditorium",
    languages: ["English", "Hindi"],
    category: "bible-study",
    eventType: "in-person",
    is_online: false,
    organizerName: "New Life Team",
    is_free: true,
    price: 0,
    attendees: 180,
    cover_gradient: 1,
    cover_image: "https://images.unsplash.com/photo-1513475382585-d06e58bcb5c0?crop=entropy&cs=srgb&fm=jpg&w=800&q=80",
    church: "New Life Fellowship",
    whatsapp_number: "+919876543211",
    status: "upcoming",
    featured: false,
  },
  {
    id: "e3",
    title: "Rooted Youth Conference 2026",
    description:
      "Three days of teaching, worship, sports, and friendship for ages 13–19. Theme: 'Rooted in Christ' from Colossians 2. Speaker: Pastor Samuel Thomas. Registration includes meals and accommodation.",
    date: inDays(14),
    end_date: inDays(16),
    country: "India",
    state: "Tamil Nadu",
    city: "Chennai",
    address: "Bethel Campus, Tambaram, Chennai, Tamil Nadu 600045",
    location: "Bethel Campus, Tambaram",
    languages: ["English", "Tamil"],
    category: "youth",
    eventType: "in-person",
    is_online: false,
    ticketUrl: "https://example-tickets.com/rooted-youth-2026",
    organizerName: "Samuel Thomas",
    is_free: false,
    price: 1500,
    attendees: 420,
    cover_gradient: 2,
    cover_image: "https://images.unsplash.com/photo-1473773508845-188df298d2d1?crop=entropy&cs=srgb&fm=jpg&w=800&q=80",
    church: "Bethel AG Church",
    whatsapp_number: "+919876543212",
    status: "upcoming",
    featured: true,
  },
  {
    id: "e4",
    title: "Silent Retreat: Hearing God",
    description:
      "A 2-day silent retreat focused on prayer, journaling, and listening to God. Limited to 30 participants. Meals provided. No phones in common areas — a true digital detox for the soul.",
    date: inDays(21),
    end_date: inDays(23),
    country: "India",
    state: "Telangana",
    city: "Hyderabad",
    address: "Covenant Retreat Center, Shamirpet, Hyderabad, Telangana 500101",
    location: "Covenant Retreat Center, Shamirpet",
    languages: ["English"],
    category: "retreat",
    eventType: "in-person",
    is_online: false,
    ticketUrl: "https://example-tickets.com/silent-retreat",
    organizerName: "Covenant Team",
    is_free: false,
    price: 2200,
    attendees: 22,
    cover_gradient: 3,
    cover_image: "https://images.unsplash.com/photo-1496950866446-3253e1470e8e?crop=entropy&cs=srgb&fm=jpg&w=800&q=80",
    church: "Covenant Community Church",
    whatsapp_number: "+919876543213",
    status: "upcoming",
    featured: false,
  },
  {
    id: "e5",
    title: "Live Stream: Sunday Worship",
    description:
      "Can't make it in person? Join us online for our weekly Sunday service — live worship, sermon, and chat-based prayer requests. Available on YouTube and our website.",
    date: inDays(2),
    country: "India",
    state: "",
    city: "",
    address: undefined,
    location: "Online — YouTube Live",
    languages: ["Malayalam", "English"],
    category: "worship",
    eventType: "online",
    is_online: true,
    onlineUrl: "https://youtube.com/live/example-sunday-worship",
    organizerName: "Zion Mar Thoma Team",
    is_free: true,
    price: 0,
    attendees: 1200,
    cover_gradient: 4,
    cover_image: "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?crop=entropy&cs=srgb&fm=jpg&w=800&q=80",
    church: "Zion Mar Thoma Church",
    whatsapp_number: "+919876543214",
    status: "upcoming",
    featured: false,
  },
  {
    id: "e6",
    title: "City-Wide Prayer Gathering",
    description:
      "Believers from across the city uniting in prayer for revival, the nation, and the persecuted church. Bring a friend. Worship led by a combined city worship team.",
    date: inDays(5),
    country: "India",
    state: "Delhi",
    city: "New Delhi",
    address: "Delhi Bible Chapel Grounds, New Delhi, Delhi 110001",
    location: "Delhi Bible Chapel Grounds",
    languages: ["English", "Hindi"],
    category: "prayer",
    eventType: "hybrid",
    is_online: true,
    onlineUrl: "https://youtube.com/live/example-city-prayer",
    organizerName: "Delhi Bible Chapel",
    is_free: true,
    price: 0,
    attendees: 290,
    cover_gradient: 5,
    cover_image: "https://images.unsplash.com/photo-1520637836862-4d197d17c91a?crop=entropy&cs=srgb&fm=jpg&w=800&q=80",
    church: "Delhi Bible Chapel",
    whatsapp_number: "+919876543215",
    status: "upcoming",
    featured: true,
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// PRAYER POSTS
// ─────────────────────────────────────────────────────────────────────────────

export const PRAYERS: PrayerPost[] = [
  {
    id: "p1",
    title: "Healing for my mother's cancer treatment",
    content:
      "My mother was diagnosed with stage 3 breast cancer last month. She starts chemo next week. Please pray for complete healing, strength for the journey, and peace for our family. We trust Jehovah Rapha, the Lord who heals.",
    category: "Healing",
    author: "Rebecca Thomas",
    is_anonymous: false,
    pray_count: 142,
    comment_count: 28,
    created_at: inDays(-2),
  },
  {
    id: "p2",
    title: "Job interview — guidance needed",
    content:
      "I have a final-round interview on Friday for a role I've been praying about for 6 months. Please pray for clarity, peace, and God's will to be done — whether this is the door He's opening or closing.",
    category: "Guidance",
    author: "Anonymous",
    is_anonymous: true,
    pray_count: 89,
    comment_count: 12,
    created_at: inDays(-1),
  },
  {
    id: "p3",
    title: "Salvation for my husband",
    content:
      "After 12 years of marriage, my husband still hasn't accepted Christ. He's respectful of my faith but hasn't taken the step himself. Pray that the Holy Spirit would soften his heart and that my life would be a faithful witness.",
    category: "Salvation",
    author: "Grace Sharma",
    is_anonymous: false,
    pray_count: 234,
    comment_count: 45,
    created_at: inDays(-3),
  },
  {
    id: "p4",
    title: "Thanksgiving — baby girl born safely!",
    content:
      "After two miscarriages and 4 years of waiting, God has blessed us with a healthy baby girl, Sarah! She was born yesterday at 3.2kg. Both mother and baby are doing well. Praise God for His faithfulness — He is the God who sees.",
    category: "Thanksgiving",
    author: "Daniel & Esther Kumar",
    is_anonymous: false,
    pray_count: 412,
    comment_count: 96,
    created_at: inDays(-1),
  },
  {
    id: "p5",
    title: "Provision — rent due, no income",
    content:
      "I lost my job 2 months ago. Rent is due in 5 days and I have nothing left. Praying for Jehovah Jireh, the Lord who provides. Even if He doesn't send money, I trust Him to make a way. Please pray for strength and faith.",
    category: "Provision",
    author: "Anonymous",
    is_anonymous: true,
    pray_count: 318,
    comment_count: 67,
    created_at: inDays(-2),
  },
  {
    id: "p6",
    title: "Restoration of marriage",
    content:
      "My wife and I have been separated for 4 months. There's been infidelity and a lot of hurt. I'm believing God for supernatural restoration of our marriage and healing of our hearts. Please stand with me in prayer.",
    category: "Family",
    author: "Joseph Isaac",
    is_anonymous: false,
    pray_count: 196,
    comment_count: 38,
    created_at: inDays(-4),
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// APOLOGETICS POSTS
// ─────────────────────────────────────────────────────────────────────────────

export const APOLOGETICS_POSTS: ApologeticsPost[] = [
  {
    id: "a1",
    title: "How do we know God exists?",
    body: "The existence of God can be argued through multiple lines of reasoning: the cosmological argument (everything that begins to exist has a cause, therefore the universe has a cause), the teleological argument (the fine-tuning of physical constants points to a Designer), the moral argument (objective moral values require a moral lawgiver), and personal experience (millions throughout history have experienced God's presence in transformative ways). No single argument is conclusive on its own, but together they form a powerful cumulative case.",
    author: "Dr. William Craig",
    topic: "gods_existence",
    date: "2025-01-15",
    likes: 142,
    comments: 28,
    cover_gradient: 0,
  },
  {
    id: "a2",
    title: "Why does God allow suffering?",
    body: "The problem of evil is one of the most challenging questions in philosophy of religion. Several responses have been offered: (1) Free Will Defense — God allows evil because He values genuine free will; without the possibility of choosing evil, love and goodness would be meaningless. (2) Soul-Making Theodicy — Suffering produces virtues like courage, compassion, and patience that cannot exist without adversity. (3) Greater Good — Some evils may be necessary for greater goods we cannot yet see. (4) Eternal Perspective — This life is temporary; eternal justice will be served and every tear wiped away.",
    author: "Pastor Ravi Zacharias",
    topic: "problem_of_evil",
    date: "2025-01-12",
    likes: 98,
    comments: 45,
    cover_gradient: 1,
  },
  {
    id: "a3",
    title: "Evidence for the Resurrection of Jesus",
    body: "The resurrection is supported by: (1) The empty tomb — even opponents acknowledged it; they claimed the disciples stole the body, which admits the tomb was empty. (2) Post-resurrection appearances to over 500 witnesses, many still alive when the New Testament was written (1 Cor 15:6). (3) The sudden transformation of the disciples from fearful cowards (who fled at Jesus' arrest) to bold preachers willing to die for their testimony. (4) The origin of the Christian faith itself, which began in Jerusalem — the very city where Jesus was publicly executed — where it could have been easily falsified. (5) The early creeds in 1 Corinthians 15, dated within years of the event.",
    author: "Dr. Gary Habermas",
    topic: "resurrection",
    date: "2025-01-10",
    likes: 210,
    comments: 36,
    cover_gradient: 2,
  },
  {
    id: "a4",
    title: "Is the Bible historically reliable?",
    body: "The Bible's historical reliability is supported by: (1) Manuscript evidence — over 5,800 Greek manuscripts of the New Testament, far more than any other ancient text (compare: Homer's Iliad has 643). (2) Archaeological confirmation — numerous discoveries (e.g. the Pool of Bethesda, the Cyrus Cylinder, the Tel Dan Stele) validate biblical accounts. (3) Internal consistency — 66 books by 40+ authors over 1,500 years with a unified message of redemption. (4) Fulfilled prophecy — hundreds of specific prophecies fulfilled in detail, including the place of Jesus' birth (Micah 5:2), His betrayal price (Zech 11:12), and His crucifixion (Psalm 22).",
    author: "Dr. Norman Geisler",
    topic: "bible_reliability",
    date: "2025-01-08",
    likes: 167,
    comments: 22,
    cover_gradient: 3,
  },
  {
    id: "a5",
    title: "Can science and faith coexist?",
    body: "Science and faith are not inherently in conflict. Many of history's greatest scientists were people of faith — Newton (physics), Pascal (mathematics), Faraday (electromagnetism), Mendel (genetics), Kepler (astronomy). Science answers 'how' questions about the natural world (mechanism), while faith addresses 'why' questions about meaning and purpose (agency). The Big Bang theory itself was proposed by a Catholic priest, Georges Lemaître. The fine-tuning of physical constants (gravity, electromagnetism, cosmological constant) continues to point beyond mere chance to a Designer.",
    author: "Dr. John Lennox",
    topic: "science_faith",
    date: "2025-01-05",
    likes: 185,
    comments: 31,
    cover_gradient: 4,
  },
  {
    id: "a6",
    title: "What makes Christianity unique among world religions?",
    body: "Christianity is unique in several key ways: (1) Grace over works — salvation is a gift received by faith, not earned through rituals or karma. (2) God became human — the incarnation, where the Creator entered His creation, is unique to Christianity. (3) A verified resurrection — no other religion claims its founder rose from the dead with multiple eyewitness testimony. (4) A personal God — God is relational and loving, not distant or unknowable. (5) Falsifiable claims — Christianity makes historical claims that can be investigated, not just philosophical assertions.",
    author: "Dr. Tim Keller",
    topic: "world_religions",
    date: "2025-01-02",
    likes: 156,
    comments: 42,
    cover_gradient: 5,
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// PRODUCTS
// ─────────────────────────────────────────────────────────────────────────────

export const PRODUCTS: Product[] = [
  {
    id: "pr1",
    name: "ESV Study Bible (Hardcover)",
    description:
      "The English Standard Version Study Bible with 20,000+ study notes, 50+ articles, 200+ charts, and full-color maps. The most comprehensive study Bible available.",
    price: 1299,
    mrp: 1899,
    category: "Bibles",
    subcategory: "Study Bible",
    vendor: "Word of Life Books",
    sellerType: "marketplace",
    state: "Karnataka",
    city: "Bengaluru",
    rating: 4.8,
    reviews: 234,
    cover_gradient: 0,
    cover_image: "https://images.unsplash.com/photo-1546484959-f9a381d1330d?crop=entropy&cs=srgb&fm=jpg&w=800&q=80",
    images: [
      "https://images.unsplash.com/photo-1546484959-f9a381d1330d?crop=entropy&cs=srgb&fm=jpg&w=800&q=80",
      "https://images.unsplash.com/photo-1520637836862-4d197d17c91a?crop=entropy&cs=srgb&fm=jpg&w=800&q=80",
      "https://images.unsplash.com/photo-1565728744382-61accd4aa148?crop=entropy&cs=srgb&fm=jpg&w=800&q=80",
    ],
    in_stock: true,
    whatsapp_number: "+919876543220",
    buyUrl: "https://example-store.com/esv-study-bible",
    status: "published",
    featured: true,
  },
  {
    id: "pr2",
    name: "Handcrafted Olive Wood Cross",
    description:
      "Beautifully carved olive wood cross from Bethlehem, the birthplace of Jesus. Each piece is unique due to the natural grain. Comes with a certificate of authenticity.",
    price: 899,
    mrp: 1499,
    category: "Gifts",
    subcategory: "Decor",
    vendor: "Holy Land Crafts",
    sellerType: "marketplace",
    state: "Maharashtra",
    city: "Mumbai",
    rating: 4.9,
    reviews: 156,
    cover_gradient: 1,
    cover_image: "https://images.unsplash.com/photo-1565728744382-61accd4aa148?crop=entropy&cs=srgb&fm=jpg&w=800&q=80",
    images: [
      "https://images.unsplash.com/photo-1565728744382-61accd4aa148?crop=entropy&cs=srgb&fm=jpg&w=800&q=80",
      "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?crop=entropy&cs=srgb&fm=jpg&w=800&q=80",
      "https://images.unsplash.com/photo-1496950866446-3253e1470e8e?crop=entropy&cs=srgb&fm=jpg&w=800&q=80",
    ],
    in_stock: true,
    whatsapp_number: "+919876543221",
    status: "published",
    featured: false,
  },
  {
    id: "pr3",
    name: "Worship Album: 'Awake My Soul'",
    description:
      "12 original worship songs by the Grace City Worship team. Recorded live. Includes chord charts and lyric sheets. Streaming + CD bundle.",
    price: 499,
    mrp: 699,
    category: "Music",
    subcategory: "Worship",
    vendor: "Grace City Music",
    sellerType: "marketplace",
    state: "Karnataka",
    city: "Bengaluru",
    rating: 4.7,
    reviews: 89,
    cover_gradient: 2,
    cover_image: "https://images.unsplash.com/photo-1516223298848-69b6c3c7a2d5?crop=entropy&cs=srgb&fm=jpg&w=800&q=80",
    in_stock: true,
    whatsapp_number: "+919876543222",
    buyUrl: "https://example-store.com/awake-my-soul",
    status: "published",
    featured: false,
  },
  {
    id: "pr4",
    name: "Faith Over Fear T-Shirt",
    description:
      "Premium 100% cotton T-shirt with 'Faith Over Fear' design printed using water-based eco-friendly ink. Available in multiple sizes and colors. Pre-shrunk fabric, machine washable.",
    price: 799,
    mrp: 999,
    category: "T-Shirts",
    subcategory: "Christian Clothing",
    vendor: "CrossThread Co.",
    sellerType: "marketplace",
    state: "Tamil Nadu",
    city: "Chennai",
    rating: 4.6,
    reviews: 24,
    cover_gradient: 3,
    cover_image: "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?crop=entropy&cs=srgb&fm=jpg&w=800&q=80",
    images: [
      "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?crop=entropy&cs=srgb&fm=jpg&w=800&q=80",
      "https://images.unsplash.com/photo-1503342217505-b0a15ec3261c?crop=entropy&cs=srgb&fm=jpg&w=800&q=80",
      "https://images.unsplash.com/photo-1576566588028-4147f3842f27?crop=entropy&cs=srgb&fm=jpg&w=800&q=80",
    ],
    in_stock: true,
    whatsapp_number: "+919876543223",
    buyUrl: "https://crossthread.example-shop.com/faith-over-fear",
    status: "published",
    featured: true,
    variations: [
      { name: "Size", options: ["S", "M", "L", "XL", "XXL"] },
      { name: "Color", options: ["Black", "White", "Navy"] },
    ],
    attributes: [
      { label: "Material", value: "100% Cotton" },
      { label: "Fit", value: "Regular Fit" },
      { label: "Weight", value: "180 GSM" },
      { label: "Care", value: "Machine Wash" },
    ],
  },
  {
    id: "pr5",
    name: "Romans Bible Study Guide",
    description:
      "A 6-week deep-dive Bible study guide through the book of Romans. Includes daily reflection prompts, group discussion questions, and a free downloadable companion app.",
    price: 299,
    mrp: 399,
    category: "Books",
    subcategory: "Bible Study",
    vendor: "Word of Life Books",
    sellerType: "marketplace",
    state: "Karnataka",
    city: "Bengaluru",
    rating: 4.9,
    reviews: 178,
    cover_gradient: 4,
    cover_image: "https://images.unsplash.com/photo-1543002588-bfa74002ed7e?crop=entropy&cs=srgb&fm=jpg&w=800&q=80",
    in_stock: true,
    whatsapp_number: "+919876543220",
    status: "published",
    featured: false,
  },
  {
    id: "pr6",
    name: "Christian Phone Cover - Cross Design",
    description:
      "Premium hard-case phone cover with minimalist cross design. Compatible with iPhone 13/14/15 and Samsung Galaxy S21-S24. Shock-absorbing edges, precise cutouts.",
    price: 499,
    mrp: 799,
    category: "Phone Covers",
    subcategory: "Accessories",
    vendor: "Holy Land Crafts",
    sellerType: "marketplace",
    state: "Maharashtra",
    city: "Mumbai",
    rating: 4.5,
    reviews: 67,
    cover_gradient: 5,
    cover_image: "https://images.unsplash.com/photo-1592434134753-a70baf7979d5?crop=entropy&cs=srgb&fm=jpg&w=800&q=80",
    in_stock: false,
    whatsapp_number: "+919876543221",
    buyUrl: "https://example-store.com/cross-phone-cover",
    status: "published",
    featured: false,
    variations: [
      { name: "Model", options: ["iPhone 13/14/15", "Samsung Galaxy S21-S24"] },
    ],
    attributes: [
      { label: "Material", value: "Hard PC + TPU" },
      { label: "Compatibility", value: "Multiple models" },
    ],
  },
  {
    id: "pr7",
    name: "Koino Signature T-Shirt",
    description:
      "Official Koino T-shirt with the Koino wordmark. 100% premium combed cotton. Every purchase supports Koino's mission to bring the Bible to every language. Available exclusively from the Koino Store.",
    price: 699,
    mrp: 999,
    category: "T-Shirts",
    subcategory: "Koino Merchandise",
    vendor: "Koino",
    sellerType: "believ",
    state: "Telangana",
    city: "Hyderabad",
    rating: 4.8,
    reviews: 312,
    cover_gradient: 6,
    cover_image: "https://images.unsplash.com/photo-1576566588028-4147f3842f27?crop=entropy&cs=srgb&fm=jpg&w=800&q=80",
    images: [
      "https://images.unsplash.com/photo-1576566588028-4147f3842f27?crop=entropy&cs=srgb&fm=jpg&w=800&q=80",
      "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?crop=entropy&cs=srgb&fm=jpg&w=800&q=80",
    ],
    in_stock: true,
    whatsapp_number: "+919876543200",
    // Koino Store products use the in-app "Add to Cart" flow (no buyUrl).
    // Previously pointed to shop.believ.app (dead brand domain) — removed.
    status: "published",
    featured: true,
    variations: [
      { name: "Size", options: ["S", "M", "L", "XL", "XXL"] },
      { name: "Color", options: ["Black", "White"] },
    ],
    attributes: [
      { label: "Material", value: "100% Combed Cotton" },
      { label: "Fit", value: "Regular Fit" },
      { label: "Brand", value: "Koino" },
    ],
  },
  {
    id: "pr8",
    name: "Koino Hoodie - Scripture Edition",
    description:
      "Official Koino hoodie with embroidered John 3:16 reference. Heavyweight 320 GSM fleece interior, perfect for cooler weather. Official Koino Store product.",
    price: 1499,
    mrp: 1999,
    category: "Hoodies",
    subcategory: "Koino Merchandise",
    vendor: "Koino",
    sellerType: "believ",
    state: "Telangana",
    city: "Hyderabad",
    rating: 4.9,
    reviews: 145,
    cover_gradient: 7,
    cover_image: "https://images.unsplash.com/photo-1556821840-3a63f95609a7?crop=entropy&cs=srgb&fm=jpg&w=800&q=80",
    images: [
      "https://images.unsplash.com/photo-1556821840-3a63f95609a7?crop=entropy&cs=srgb&fm=jpg&w=800&q=80",
      "https://images.unsplash.com/photo-1620799140408-edc6dcb6d633?crop=entropy&cs=srgb&fm=jpg&w=800&q=80",
    ],
    in_stock: true,
    whatsapp_number: "+919876543200",
    // Koino Store products use the in-app "Add to Cart" flow (no buyUrl).
    // Previously pointed to shop.believ.app (dead brand domain) — removed.
    status: "published",
    featured: true,
    variations: [
      { name: "Size", options: ["S", "M", "L", "XL", "XXL"] },
      { name: "Color", options: ["Black", "Navy"] },
    ],
    attributes: [
      { label: "Material", value: "80% Cotton, 20% Polyester" },
      { label: "Weight", value: "320 GSM" },
      { label: "Brand", value: "Koino" },
    ],
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// CHRISTIAN BUSINESS DIRECTORY — mock data
// (Mock data for now — when a real Prisma Business model is added, this array
//  maps 1:1 to it. New listings created via ListYourEntity get prepended to
//  this list in component state, with status="pending" so they don't appear
//  in the public directory until "approved".)
// ─────────────────────────────────────────────────────────────────────────────

const _daysAgo = (n: number) => new Date(Date.now() - n * 24 * 60 * 60 * 1000).toISOString();

export const BUSINESSES: Business[] = [
  {
    id: "b1",
    name: "Grace Christian Caterers",
    description: "Christian catering for weddings, receptions, and church events. Multi-cuisine menus, hygienic preparation, and dedicated service teams. Serving Hyderabad and surrounding areas for over 10 years.",
    category: "Wedding Caterers",
    country: "India",
    state: "Telangana",
    city: "Hyderabad",
    address: "Plot 12, Hitech City Road, Madhapur, Hyderabad, Telangana 500081",
    languages: ["English", "Telugu", "Hindi"],
    cover_image: "https://images.unsplash.com/photo-1555244162-803834f70033?crop=entropy&cs=srgb&fm=jpg&w=800&q=80",
    whatsapp_number: "+919876544001",
    phone: "+9140665544001",
    email: "hello@gracecaterers.example",
    website: "https://gracecaterers.example",
    hours: "Mon-Sat 9:00 AM - 7:00 PM",
    services: ["Wedding Catering", "Reception Catering", "Church Event Catering", "Custom Menus"],
    rating: 4.8,
    reviews: 124,
    cover_gradient: 0,
    status: "approved",
    verified: true,
    featured: true,
    createdAt: _daysAgo(120),
  },
  {
    id: "b2",
    name: "Word of Life Christian Bookstore",
    description: "Your one-stop Christian bookstore for Bibles (ESV, NIV, KJV, Telugu, Hindi), devotionals, Bible study guides, Christian living books, and children's Bible stories. Special orders welcome.",
    category: "Christian Bookstores",
    country: "India",
    state: "Karnataka",
    city: "Bengaluru",
    address: "Shop 4, Brigade Road, Bengaluru, Karnataka 560001",
    languages: ["English", "Kannada", "Hindi"],
    cover_image: "https://images.unsplash.com/photo-1521587760476-6c12a4b040da?crop=entropy&cs=srgb&fm=jpg&w=800&q=80",
    whatsapp_number: "+919876544002",
    phone: "+918022554002",
    email: "orders@wordoflifebooks.example",
    website: "https://wordoflifebooks.example",
    hours: "Mon-Sat 10:00 AM - 8:30 PM, Sun closed",
    services: ["Bibles", "Christian Books", "Devotionals", "Children's Books", "Special Orders"],
    rating: 4.9,
    reviews: 89,
    cover_gradient: 1,
    status: "approved",
    verified: true,
    featured: true,
    productIds: ["pr1", "pr5"], // links to ESV Study Bible + Romans Bible Study Guide in Marketplace
    createdAt: _daysAgo(95),
  },
  {
    id: "b3",
    name: "Holy Moments Photography",
    description: "Christian wedding and event photography. Pre-wedding shoots, candid coverage, church events, baptisms, and dedication ceremonies. Cinematic editing and same-day teaser delivery.",
    category: "Christian Photographers",
    country: "India",
    state: "Tamil Nadu",
    city: "Chennai",
    address: "Studio 7, T. Nagar, Chennai, Tamil Nadu 600017",
    languages: ["English", "Tamil"],
    cover_image: "https://images.unsplash.com/photo-1519225421980-715cb0215aed?crop=entropy&cs=srgb&fm=jpg&w=800&q=80",
    whatsapp_number: "+919876544003",
    phone: "+914422554003",
    email: "book@holymomentsphoto.example",
    website: "https://holymomentsphoto.example",
    hours: "Mon-Sat 9:00 AM - 8:00 PM",
    services: ["Wedding Photography", "Pre-Wedding Shoots", "Church Events", "Baptism Coverage", "Cinematic Films"],
    rating: 4.7,
    reviews: 56,
    cover_gradient: 2,
    status: "approved",
    verified: true,
    featured: false,
    createdAt: _daysAgo(60),
  },
  {
    id: "b4",
    name: "Manna Home Bakers",
    description: "Christian home bakery specializing in custom celebration cakes for birthdays, weddings, and church events. Eggless options available. Made-to-order with 48 hours notice.",
    category: "Christian Home Bakers",
    country: "India",
    state: "Maharashtra",
    city: "Mumbai",
    address: "Flat 3B, Andheri West, Mumbai, Maharashtra 400058",
    languages: ["English", "Hindi", "Marathi"],
    cover_image: "https://images.unsplash.com/photo-1578985545062-69928b1d9790?crop=entropy&cs=srgb&fm=jpg&w=800&q=80",
    whatsapp_number: "+919876544004",
    phone: "+912240055004",
    email: "orders@mannabakers.example",
    hours: "Mon-Sat 8:00 AM - 6:00 PM",
    services: ["Custom Cakes", "Eggless Cakes", "Cupcakes", "Wedding Cakes", "Church Event Desserts"],
    rating: 4.9,
    reviews: 78,
    cover_gradient: 3,
    status: "approved",
    verified: true,
    featured: false,
    createdAt: _daysAgo(45),
  },
  {
    id: "b5",
    name: "CrossThread Christian Apparel",
    description: "Christian clothing brand designing faith-inspired T-shirts, hoodies, and accessories. Custom designs for churches, youth groups, and worship teams. Bulk orders welcome.",
    category: "Christian Clothing",
    country: "India",
    state: "Tamil Nadu",
    city: "Chennai",
    address: "Unit 5, Guindy Industrial Estate, Chennai, Tamil Nadu 600032",
    languages: ["English", "Tamil"],
    cover_image: "https://images.unsplash.com/photo-1441986300917-64674bd600d8?crop=entropy&cs=srgb&fm=jpg&w=800&q=80",
    whatsapp_number: "+919876543223",
    phone: "+914422554005",
    email: "hello@crossthread.example",
    website: "https://crossthread.example",
    hours: "Mon-Sat 10:00 AM - 7:00 PM",
    services: ["Christian T-Shirts", "Hoodies", "Custom Church Apparel", "Bulk Orders", "Youth Group Designs"],
    rating: 4.6,
    reviews: 24,
    cover_gradient: 4,
    status: "approved",
    verified: true,
    featured: true,
    productIds: ["pr4"], // links to Faith Over Fear T-Shirt in Marketplace
    createdAt: _daysAgo(30),
  },
  {
    id: "b6",
    name: "Redeemer Christian School",
    description: "CBSE-affiliated Christian school offering education from pre-K to 12th grade. Christ-centered values integrated into the curriculum. Daily morning assembly, weekly chapel, and character-building programs.",
    category: "Christian Schools & Education",
    country: "India",
    state: "Telangana",
    city: "Hyderabad",
    address: "Survey 32, Kondapur, Hyderabad, Telangana 500084",
    languages: ["English"],
    cover_image: "https://images.unsplash.com/photo-1580582932707-520aed937b7b?crop=entropy&cs=srgb&fm=jpg&w=800&q=80",
    whatsapp_number: "+919876544006",
    phone: "+914023005006",
    email: "admissions@redeemerschool.example",
    website: "https://redeemerschool.example",
    hours: "Mon-Fri 8:30 AM - 3:30 PM (Office 9-5)",
    services: ["Pre-K to 12th", "CBSE Curriculum", "Christian Values", "Weekly Chapel", "Sports & Arts"],
    rating: 4.7,
    reviews: 145,
    cover_gradient: 5,
    status: "approved",
    verified: true,
    featured: false,
    createdAt: _daysAgo(15),
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// TRIVIA QUESTIONS
// ─────────────────────────────────────────────────────────────────────────────

export const TRIVIA_QUESTIONS: TriviaQuestion[] = [
  // BEGINNERS — FULL BIBLE
  {
    id: "q1",
    question: "Who created the heavens and the earth?",
    options: ["Adam", "Noah", "God", "Moses"],
    answer: 2,
    explanation: "Genesis 1:1 — In the beginning God created the heavens and the earth.",
    points: 10,
    difficulty: "beginners",
    category: "full_bible",
  },
  {
    id: "q2",
    question: "Who was the first man?",
    options: ["Abraham", "Adam", "Noah", "David"],
    answer: 1,
    explanation: "Genesis 2:7 — The Lord God formed man from the dust of the ground.",
    points: 10,
    difficulty: "beginners",
    category: "full_bible",
  },
  {
    id: "q3",
    question: "Who built the ark?",
    options: ["Abraham", "Moses", "Noah", "David"],
    answer: 2,
    explanation: "Genesis 6:14 — Make yourself an ark of cypress wood.",
    points: 10,
    difficulty: "beginners",
    category: "full_bible",
  },
  {
    id: "q4",
    question: "How many days did God take to create the world?",
    options: ["5", "6", "7", "10"],
    answer: 1,
    explanation: "Genesis 2:2 — By the seventh day God had finished the work he had been doing.",
    points: 10,
    difficulty: "beginners",
    category: "full_bible",
  },
  {
    id: "q5",
    question: "Who was thrown into the lions' den?",
    options: ["Daniel", "David", "Elijah", "Joseph"],
    answer: 0,
    explanation: "Daniel 6:16 — Daniel was brought and thrown into the den of lions.",
    points: 10,
    difficulty: "beginners",
    category: "full_bible",
  },
  {
    id: "q6",
    question: "Who parted the Red Sea?",
    options: ["Joshua", "Aaron", "Moses", "Elijah"],
    answer: 2,
    explanation: "Exodus 14:21 — Moses stretched out his hand over the sea.",
    points: 10,
    difficulty: "beginners",
    category: "full_bible",
  },
  {
    id: "q7",
    question: "What is the first book of the Bible?",
    options: ["Exodus", "Genesis", "Leviticus", "Matthew"],
    answer: 1,
    explanation: "Genesis is the first book of the Bible.",
    points: 10,
    difficulty: "beginners",
    category: "full_bible",
  },
  {
    id: "q8",
    question: "Who killed Goliath?",
    options: ["Saul", "Jonathan", "David", "Samuel"],
    answer: 2,
    explanation: "1 Samuel 17:50 — David triumphed over the Philistine with a sling and a stone.",
    points: 10,
    difficulty: "beginners",
    category: "full_bible",
  },
  {
    id: "q9",
    question: "Where was Jesus born?",
    options: ["Nazareth", "Bethlehem", "Jerusalem", "Capernaum"],
    answer: 1,
    explanation: "Matthew 2:1 — Jesus was born in Bethlehem of Judea.",
    points: 10,
    difficulty: "beginners",
    category: "full_bible",
  },
  {
    id: "q10",
    question: "Who betrayed Jesus?",
    options: ["Peter", "Judas", "Thomas", "James"],
    answer: 1,
    explanation: "Matthew 26:14 — Judas Iscariot went to the chief priests.",
    points: 10,
    difficulty: "beginners",
    category: "full_bible",
  },

  // INTERMEDIATE — NEW TESTAMENT
  {
    id: "q11",
    question: "How many beatitudes are in the Sermon on the Mount?",
    options: ["7", "8", "9", "10"],
    answer: 1,
    explanation: "Matthew 5:3-10 lists 8 beatitudes (Blessed are the poor in spirit...).",
    points: 20,
    difficulty: "intermediate",
    category: "new_testament",
  },
  {
    id: "q12",
    question: "Who was the tax collector that climbed the sycamore tree?",
    options: ["Matthew", "Zacchaeus", "Levi", "Bartimaeus"],
    answer: 1,
    explanation: "Luke 19:4 — Zacchaeus climbed a sycamore tree to see Jesus.",
    points: 20,
    difficulty: "intermediate",
    category: "new_testament",
  },
  {
    id: "q13",
    question: "What was Paul's original name?",
    options: ["Stephen", "Saul", "Silas", "Simon"],
    answer: 1,
    explanation: "Acts 9:4 — Saul (later renamed Paul) encountered Jesus on the road to Damascus.",
    points: 20,
    difficulty: "intermediate",
    category: "new_testament",
  },
  {
    id: "q14",
    question: "Which apostle denied Jesus three times?",
    options: ["John", "Peter", "Andrew", "Judas"],
    answer: 1,
    explanation: "Luke 22:54-62 — Peter denied Jesus three times before the rooster crowed.",
    points: 20,
    difficulty: "intermediate",
    category: "new_testament",
  },
  {
    id: "q15",
    question: "Who walked on water with Jesus?",
    options: ["John", "Peter", "James", "Andrew"],
    answer: 1,
    explanation: "Matthew 14:29 — Peter stepped out of the boat and walked on water toward Jesus.",
    points: 20,
    difficulty: "intermediate",
    category: "new_testament",
  },
  {
    id: "q16",
    question: "What is the first miracle of Jesus recorded in John?",
    options: ["Healing a leper", "Turning water into wine", "Feeding 5000", "Walking on water"],
    answer: 1,
    explanation: "John 2:1-11 — Jesus turned water into wine at the wedding in Cana.",
    points: 20,
    difficulty: "intermediate",
    category: "new_testament",
  },
  {
    id: "q17",
    question: "Which gospel is the shortest?",
    options: ["Matthew", "Mark", "Luke", "John"],
    answer: 1,
    explanation: "Mark is the shortest of the four gospels, with 16 chapters.",
    points: 20,
    difficulty: "intermediate",
    category: "new_testament",
  },

  // SKILLED — OLD TESTAMENT
  {
    id: "q18",
    question: "How many sons did Jacob have?",
    options: ["10", "11", "12", "13"],
    answer: 2,
    explanation: "Genesis 35:22-26 — Jacob had 12 sons who became the 12 tribes of Israel.",
    points: 30,
    difficulty: "skilled",
    category: "old_testament",
  },
  {
    id: "q19",
    question: "Who succeeded Moses as leader of Israel?",
    options: ["Aaron", "Joshua", "Caleb", "Samuel"],
    answer: 1,
    explanation: "Deuteronomy 34:9 — Joshua son of Nun was filled with the spirit of wisdom.",
    points: 30,
    difficulty: "skilled",
    category: "old_testament",
  },
  {
    id: "q20",
    question: "What was the name of Ruth's mother-in-law?",
    options: ["Orpah", "Naomi", "Hannah", "Esther"],
    answer: 1,
    explanation: "Ruth 1:4 — Naomi was the mother-in-law of Ruth and Orpah.",
    points: 30,
    difficulty: "skilled",
    category: "old_testament",
  },
  {
    id: "q21",
    question: "Which king built the first temple in Jerusalem?",
    options: ["David", "Solomon", "Hezekiah", "Josiah"],
    answer: 1,
    explanation: "1 Kings 6 — Solomon built the temple in Jerusalem over 7 years.",
    points: 30,
    difficulty: "skilled",
    category: "old_testament",
  },
  {
    id: "q22",
    question: "How many years did the Israelites wander in the wilderness?",
    options: ["20", "30", "40", "50"],
    answer: 2,
    explanation: "Numbers 14:33 — Your children will be shepherds here for forty years.",
    points: 30,
    difficulty: "skilled",
    category: "old_testament",
  },

  // EXPERT — APOLOGETICS
  {
    id: "q23",
    question: "Which argument states that 'everything that begins to exist has a cause'?",
    options: ["Teleological", "Cosmological", "Moral", "Ontological"],
    answer: 1,
    explanation: "The Cosmological Argument (Kalam version) states: Everything that begins to exist has a cause; the universe began to exist; therefore the universe has a cause.",
    points: 50,
    difficulty: "expert",
    category: "apologetics",
  },
  {
    id: "q24",
    question: "How many Greek manuscripts of the New Testament exist (approx.)?",
    options: ["~500", "~1,500", "~5,800", "~10,000"],
    answer: 2,
    explanation: "There are approximately 5,800 Greek manuscripts of the New Testament, far more than any other ancient text.",
    points: 50,
    difficulty: "expert",
    category: "apologetics",
  },
  {
    id: "q25",
    question: "Which scientist proposed the Big Bang theory?",
    options: ["Isaac Newton", "Albert Einstein", "Georges Lemaître", "Stephen Hawking"],
    answer: 2,
    explanation: "Georges Lemaître, a Catholic priest and physicist, first proposed what became the Big Bang theory in 1927.",
    points: 50,
    difficulty: "expert",
    category: "apologetics",
  },
];

export const MOCK_LEADERBOARD = [
  { name: "Rebecca Thomas", points: 8420, rank: 1, tier: "Word Warrior" },
  { name: "Philip Cherian", points: 6150, rank: 2, tier: "Word Warrior" },
  { name: "Grace Sharma", points: 4320, rank: 3, tier: "Theology Scholar" },
  { name: "Daniel Kumar", points: 2800, rank: 4, tier: "Theology Scholar" },
  { name: "Esther Raj", points: 1650, rank: 5, tier: "Bible Teacher" },
  { name: "Samuel Mathew", points: 980, rank: 6, tier: "Bible Student" },
  { name: "Ruth Philip", points: 520, rank: 7, tier: "Spiritual Disciple" },
  { name: "Joshua Isaac", points: 280, rank: 8, tier: "Bible Student" },
];

export const DAILY_VERSES = [
  {
    verse: "Do not be anxious about anything, but in every situation, by prayer and petition, with thanksgiving, present your requests to God.",
    reference: "Philippians 4:6",
    reflection: "No matter how big or small your request, God cares for you. Sharing your heart with Him and your brothers and sisters in Christ brings peace that transcends understanding.",
  },
  {
    verse: "Therefore confess your sins to each other and pray for each other so that you may be healed. The prayer of a righteous person is powerful and effective.",
    reference: "James 5:16",
    reflection: "Fellowship isn't just about sharing good times; it's about lifting each other's burdens. When we pray together, God moves in extraordinary ways.",
  },
  {
    verse: "For where two or three gather in my name, there am I with them.",
    reference: "Matthew 18:20",
    reflection: "We are never alone in our faith. Even online, when we unite our spirits in prayer, Jesus Christ is right here in our midst, coordinating grace.",
  },
  {
    verse: "Be joyful in hope, patient in affliction, faithful in prayer.",
    reference: "Romans 12:12",
    reflection: "Prayer is not a last resort, but our first response. Maintain steady faith and support each other through seasons of waiting and transformation.",
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// APOLOGETICS Q&A — Questions asked by users, answered by pastors/admins
// ─────────────────────────────────────────────────────────────────────────────

export const APOLOGETICS_QUESTIONS: ApologeticsQuestion[] = [
  {
    id: "qa1",
    title: "If God is good, why is there so much suffering in the world?",
    body: "I've been struggling with this question for a long time. My friend was diagnosed with cancer at 28 and I don't understand why a loving God would allow this. Please help me understand.",
    author: "Anonymous",
    topic: "problem_of_evil",
    date: "2025-01-18",
    likes: 67,
    status: "answered",
    answers: [
      {
        id: "qa1a1",
        author: "Pastor Ravi Zacharias",
        authorRole: "Pastor",
        authorChurch: "New Life Fellowship",
        body: "Your question is one of the most honest and difficult ones we can ask. I'm so sorry about your friend. Here's how I've come to understand it: God created us with genuine free will — without the possibility of choosing evil, love would be forced, not love. But God didn't stay distant from suffering; He entered it. Jesus wept at Lazarus's tomb. He sweat blood in Gethsemane. He cried 'My God, why have you forsaken me?' on the cross. God's answer to suffering isn't an explanation — it's His presence. And He promises that one day He will wipe every tear (Rev 21:4). In the meantime, we walk with Him and with each other. Praying for your friend right now.",
        date: "2025-01-19",
        is_accepted: true,
        likes: 89,
      },
      {
        id: "qa1a2",
        author: "Dr. William Craig",
        authorRole: "Church Leader",
        body: "Adding to Pastor Ravi's beautiful response — philosophically, the 'soul-making theodicy' (John Hick) suggests that suffering can produce virtues like courage, compassion, and patience that cannot exist without adversity. This doesn't make suffering 'good' but explains how God can redeem it. Romans 8:28 promises He works all things for good for those who love Him.",
        date: "2025-01-20",
        is_accepted: false,
        likes: 34,
      },
    ],
  },
  {
    id: "qa2",
    title: "How can I be sure Jesus actually rose from the dead?",
    body: "I believe in God but I struggle with the resurrection. It feels like a story. What's the actual historical evidence?",
    author: "Daniel Kumar",
    topic: "resurrection",
    date: "2025-01-16",
    likes: 124,
    status: "answered",
    answers: [
      {
        id: "qa2a1",
        author: "Dr. Gary Habermas",
        authorRole: "Church Leader",
        authorChurch: "Bethel AG Church",
        body: "Great question. Even skeptical historians accept these facts: (1) Jesus died by crucifixion. (2) His tomb was found empty. (3) Multiple people, including skeptics like Paul and James, claimed to see Him alive after. (4) The disciples were transformed from fearful cowards to bold preachers willing to die for this claim. The best explanation that fits all the data is that He actually rose. Read 'The Case for the Resurrection of Jesus' for a deep dive.",
        date: "2025-01-17",
        is_accepted: true,
        likes: 156,
      },
    ],
  },
  {
    id: "qa3",
    title: "Is evolution compatible with Christianity?",
    body: "I'm a biology student and I see strong evidence for evolution. Can I be a Christian and believe in evolution?",
    author: "Grace Sharma",
    topic: "science_faith",
    date: "2025-01-14",
    likes: 92,
    status: "open",
    answers: [],
  },
  {
    id: "qa4",
    title: "Why are there so many different Christian denominations?",
    body: "If there's one Bible and one Jesus, why are there Catholics, Baptists, Pentecostals, etc.? It's confusing for a new believer.",
    author: "Joshua Isaac",
    topic: "world_religions",
    date: "2025-01-12",
    likes: 48,
    status: "open",
    answers: [],
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// TRIVIA — Real prizes (admin-listed physical gifts)
// ─────────────────────────────────────────────────────────────────────────────

export type TriviaGift = {
  id: string;
  title: string;
  description: string;
  image_url: string;
  points_required: number;
  tier: "bronze" | "silver" | "gold" | "platinum";
  stock: number;
};

export const TRIVIA_GIFTS: TriviaGift[] = [
  {
    id: "g1",
    title: "Koino T-Shirt",
    description: "Premium cotton tee with the Koino logo. Available in S, M, L, XL. Choose your size at checkout.",
    image_url: "https://images.unsplash.com/photo-1438032005730-c779502df39b?crop=entropy&cs=srgb&fm=jpg&w=400&q=80",
    points_required: 500,
    tier: "bronze",
    stock: 50,
  },
  {
    id: "g2",
    title: "Personalized Bible (ESV)",
    description: "English Standard Version Bible with your name embossed on the cover. Genuine leather binding.",
    image_url: "https://images.unsplash.com/photo-1546484959-f9a381d1330d?crop=entropy&cs=srgb&fm=jpg&w=400&q=80",
    points_required: 1500,
    tier: "silver",
    stock: 20,
  },
  {
    id: "g3",
    title: "Olive Wood Cross from Bethlehem",
    description: "Hand-carved olive wood cross imported from Bethlehem. Each piece is unique. Comes with certificate of authenticity.",
    image_url: "https://images.unsplash.com/photo-1565728744382-61accd4aa148?crop=entropy&cs=srgb&fm=jpg&w=400&q=80",
    points_required: 3000,
    tier: "gold",
    stock: 10,
  },
  {
    id: "g4",
    title: "Worship Album Bundle (5 CDs)",
    description: "5 acclaimed worship albums from leading Christian artists. Plus a digital download code.",
    image_url: "https://images.unsplash.com/photo-1513475382585-d06e58bcb5c0?crop=entropy&cs=srgb&fm=jpg&w=400&q=80",
    points_required: 1000,
    tier: "bronze",
    stock: 30,
  },
  {
    id: "g5",
    title: "Devotional Library (10 Books)",
    description: "Curated collection of 10 classic devotionals including Lewis, Tozer, Chambers, and Piper. Hardcover editions.",
    image_url: "https://images.unsplash.com/photo-1520637836862-4d197d17c91a?crop=entropy&cs=srgb&fm=jpg&w=400&q=80",
    points_required: 5000,
    tier: "platinum",
    stock: 5,
  },
  {
    id: "g6",
    title: "Jerusalem Pilgrimage Voucher",
    description: "Partial sponsorship voucher for a guided Holy Land tour. Visit Jerusalem, Bethlehem, and Galilee.",
    image_url: "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?crop=entropy&cs=srgb&fm=jpg&w=400&q=80",
    points_required: 10000,
    tier: "platinum",
    stock: 2,
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// TRIVIA — Church vs Church Competitions
// ─────────────────────────────────────────────────────────────────────────────

export type TriviaCompetition = {
  id: string;
  title: string;
  description: string;
  start_date: string;
  end_date: string;
  prize: string;
  prize_image?: string;
  participants: { church_id: string; church_name: string; score: number; players: number }[];
  status: "upcoming" | "live" | "ended";
  organizer: string;
};

export const TRIVIA_COMPETITIONS: TriviaCompetition[] = [
  {
    id: "comp1",
    title: "Bangalore Bible Bowl 2025",
    description:
      "Annual Bible trivia championship for churches across Bengaluru. Each church fields 5 players. Top 3 churches win cash prizes + trophies. Individual MVP wins a personalized Bible.",
    start_date: inDays(7),
    end_date: inDays(9),
    prize: "₹25,000 cash + Trophy + Personalized Bibles",
    prize_image: "https://images.unsplash.com/photo-1546484959-f9a381d1330d?crop=entropy&cs=srgb&fm=jpg&w=400&q=80",
    organizer: "Koino + Grace City Church",
    status: "upcoming",
    participants: [
      { church_id: "c1", church_name: "Grace City Church", score: 0, players: 5 },
      { church_id: "c8", church_name: "Living Hope Church", score: 0, players: 4 },
    ],
  },
  {
    id: "comp2",
    title: "South India Scripture Showdown",
    description:
      "Inter-state competition for churches in Tamil Nadu, Kerala, Karnataka, and Telangana. 7-day trivia marathon. Categories: Full Bible, NT, OT, Apologetics.",
    start_date: inDays(-3),
    end_date: inDays(4),
    prize: "₹50,000 + Featured spot on Koino home page",
    prize_image: "https://images.unsplash.com/photo-1565728744382-61accd4aa148?crop=entropy&cs=srgb&fm=jpg&w=400&q=80",
    organizer: "Koino",
    status: "live",
    participants: [
      { church_id: "c1", church_name: "Grace City Church", score: 4280, players: 12 },
      { church_id: "c3", church_name: "Bethel AG Church", score: 5140, players: 18 },
      { church_id: "c4", church_name: "Covenant Community Church", score: 3620, players: 8 },
      { church_id: "c5", church_name: "Zion Mar Thoma Church", score: 4890, players: 15 },
    ],
  },
  {
    id: "comp3",
    title: "Mumbai Revival Trivia Challenge",
    description:
      "Solo player competition for individuals across Maharashtra. Top 10 players win worship album bundles and Koino merchandise.",
    start_date: inDays(-30),
    end_date: inDays(-1),
    prize: "Worship Album Bundle + Koino T-Shirts",
    prize_image: "https://images.unsplash.com/photo-1513475382585-d06e58bcb5c0?crop=entropy&cs=srgb&fm=jpg&w=400&q=80",
    organizer: "New Life Fellowship",
    status: "ended",
    participants: [
      { church_id: "c2", church_name: "New Life Fellowship", score: 6720, players: 24 },
      { church_id: "c7", church_name: "Calvary Baptist Church", score: 5340, players: 16 },
    ],
  },
];

// Player invitations - share links for inviting friends/groups
// The share text contains a deep link back to Koino on the canonical
// production domain (https://www.koino.in). The SPA reads the `view`
// and `comp` query params on load and routes the user straight to the
// competition. This URL MUST stay on www.koino.in — never use the
// raw Vercel deployment URL (crosscraftedapp.vercel.app) or any old
// brand domain (crosscrafted.app / believ.app) here.
export function generateInviteLink(competitionId: string, playerName: string): string {
  const invite = `Hey! ${playerName} invited you to join a Bible Trivia competition on Koino. Play now: https://www.koino.in/?view=trivia&comp=${competitionId}&invited_by=${encodeURIComponent(playerName)}`;
  return invite;
}

