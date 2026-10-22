// English (base) — all UI strings that should be translated.
//
// Naming convention:
//   section.subsection.label  (e.g. "nav.bible", "signin.title")
//
// Adding a new key here means adding it to every language file. If a key
// is missing in a translation file, the i18n hook falls back to English.
// If it's missing in English too, it returns the key itself.

export const en: Record<string, string> = {
  // ─── Branding ───
  "brand.name": "Koino",
  "brand.tagline": "Faith. Fellowship. Belong.",

  // ─── Landing hero ───
  "landing.badge": "Faith Community Platform",
  "landing.title": "Koino",
  "landing.titleGradient": "Faith. Fellowship. Belong.",
  "landing.subtitle":
    "An all-in-one Christian faith platform where believers can grow in faith, explore Scripture, connect with churches and communities, discover events, pray together, learn, and support Christian businesses.",
  "landing.cta.enterKoino": "Enter Koino",
  "landing.cta.readBible": "Read the Bible",
  "landing.cta.tryTrivia": "Try Trivia",
  "landing.stats.questions": "Bible Questions",
  "landing.stats.tiers": "Prize Tiers",
  "landing.stats.languages": "Languages",
  "landing.stats.free": "Free",
  "landing.stats.toUse": "To Use",

  // ─── Bible section ───
  "bible.badge": "The Holy Bible",
  "bible.title": "Read God's Word Daily",
  "bible.subtitle":
    "All 66 books, in KJV and WEB translations. Search any verse by keyword, bookmark favorites, and follow daily reading plans — Bible in 90 Days, Gospels in 14 Days, Psalms & Proverbs in 31 Days.",
  "bible.stat.books": "66 Books",
  "bible.stat.booksSub": "39 OT · 27 NT",
  "bible.stat.translations": "2 Translations",
  "bible.stat.translationsSub": "KJV · WEB",
  "bible.stat.plans": "4 Plans",
  "bible.stat.plansSub": "14 – 90 days",
  "bible.stat.langs": "11 Langs",
  "bible.stat.langsSub": "Indian UIs",
  "bible.cta.open": "Open the Bible",
  "bible.cta.plans": "Browse Reading Plans",
  "bible.cta.free": "Free · Works offline after first read",

  // ─── Features section ───
  "features.title": "Everything for Your Faith Journey",
  "features.subtitle":
    "From Bible reading to Bible Comics, churches, events, prayer, trivia, marketplace and business directory — everything a Christian community needs, in one place.",
  "feature.bible.title": "Holy Bible",
  "feature.bible.desc":
    "Read the entire Bible — all 66 books — in KJV or WEB translation. Search by keyword, bookmark verses, and follow daily reading plans.",
  "feature.comics.title": "Bible Comics",
  "feature.comics.desc":
    "Experience Bible stories through original visual storytelling. Genesis and more — panel-by-panel illustrated Scripture.",
  "feature.trivia.title": "Bible Trivia",
  "feature.trivia.desc":
    "Test your Bible knowledge across 4 difficulty levels. Choose Full Bible, New Testament, Old Testament, or Apologetics. Earn Faith Points and unlock rewards.",
  "feature.churches.title": "Churches",
  "feature.churches.desc":
    "Find churches across India filtered by state, city, and language. Follow churches you attend or want to stay connected with.",
  "feature.events.title": "Events",
  "feature.events.desc":
    "Discover Christian events, conferences, worship gatherings and community activities. Filter by state, city, date and category.",
  "feature.prayer.title": "Prayer Wall",
  "feature.prayer.desc":
    "Share prayer requests, pray for others and encourage one another in faith.",
  "feature.marketplace.title": "Marketplace",
  "feature.marketplace.desc":
    "Discover Christian products and connect with sellers — Bibles, books, music, apparel, and more.",
  "feature.businessDirectory.title": "Business Directory",
  "feature.businessDirectory.desc":
    "Discover Christian businesses, services and professionals across India.",
  "feature.community.title": "Community",
  "feature.community.desc":
    "Connect with believers and grow together in faith.",

  // ─── Trivia section ───
  "trivia.badge": "Bible Trivia Challenge",
  "trivia.title": "How Well Do You Know the Bible?",
  "trivia.subtitle": "4 difficulty levels, 4 categories, growing question pool, Faith Points and real rewards",
  "trivia.cta.start": "Start Challenge",
  "trivia.cta.free": "Free to play. Earn badges and recognition",

  // ─── Languages section ───
  "languages.title": "Available in Indian Languages",

  // ─── CTA section ───
  "cta.title": "Grow in Faith, Together",
  "cta.subtitle":
    "Join the Koino community — explore the Bible, read Bible Comics, find churches and events, share prayer, test your Bible knowledge, and discover Christian businesses and products.",
  "cta.button": "Enter Koino",

  // ─── Header nav ───
  "nav.bible": "Bible",
  "nav.churches": "Churches",
  "nav.events": "Events",
  "nav.trivia": "Trivia",
  "nav.prayer": "Prayer",
  "nav.shop": "Marketplace",
  "nav.enterApp": "Enter Koino",
  "nav.admin": "Admin",

  // ─── Sign-in page ───
  "signin.title": "Koino",
  "signin.subtitle": "Faith. Fellowship. Belong. — Sign in to track your Faith Points",
  "signin.google": "Continue with Google",
  "signin.google.loading": "Redirecting...",
  "signin.divider.signin": "or sign in with email",
  "signin.divider.signup": "or sign up with email",
  "signin.email": "Email",
  "signin.emailPlaceholder": "you@example.com",
  "signin.password": "Password",
  "signin.passwordPlaceholder": "Your password",
  "signin.passwordSignupPlaceholder": "At least 6 characters",
  "signin.name": "Name (optional)",
  "signin.namePlaceholder": "Your name",
  "signin.submit.signin": "Sign in",
  "signin.submit.signup": "Create account",
  "signin.submit.signinLoading": "Signing in...",
  "signin.submit.signupLoading": "Creating account...",
  "signin.toggle.toSignup": "Don't have an account?",
  "signin.toggle.toSignupLink": "Sign up",
  "signin.toggle.toSignin": "Already have an account?",
  "signin.toggle.toSigninLink": "Sign in",
  "signin.back": "← Back to home",
  "signin.fpBanner.title": "Faith Points",
  "signin.fpBanner.desc":
    "Sign in to earn and track Faith Points securely. Your points are stored server-side — no more localStorage farming!",
  "signin.error.invalid": "Please enter your email and password.",
  "signin.error.shortPassword": "Password must be at least 6 characters.",
  "signin.error.default": "Something went wrong. Please try again.",
  "signin.info.confirmEmail":
    "Check your inbox — we sent you a confirmation link. Click it to verify your email, then sign in.",

  // ─── Header user section ───
  "user.fpoints": "FP",
  "user.signIn": "Sign In",
  "user.signOut": "Sign out",

  // ─── Admin tabs ───
  "admin.tab.dashboard": "Dashboard",
  "admin.tab.churches": "Churches",
  "admin.tab.events": "Events",
  "admin.tab.marketplace": "Marketplace",
  "admin.tab.prayers": "Prayers",
  "admin.tab.apologetics": "Apologetics",
  "admin.tab.competitions": "Competitions",
  "admin.tab.announcements": "Announcements",
  "admin.tab.redemptions": "Redemptions",
  "admin.tab.donations": "Donations",
  "admin.tab.analytics": "Analytics",
  "admin.tab.bibleComics": "Bible Comics",
  "admin.tab.members": "Members",
  "admin.tab.contactMessages": "Contact Messages",
  "admin.tab.partnerInquiries": "Partner Inquiries",
  "admin.tab.contributors": "Contributors",
  "admin.tab.blog": "Blog",

  // ─── Trivia view ───
  "triviaView.title": "Bible Trivia",
  "triviaView.verified": "Verified: {points} FP",
  "triviaView.signInPrompt": "Sign in to earn Faith Points",
  "triviaView.tab.play": "Play",
  "triviaView.tab.compete": "Compete",
  "triviaView.tab.rewards": "Rewards",
  "triviaView.tab.leaderboard": "Leaderboard",
  "triviaView.tab.stats": "Stats",

  // ─── Rewards tab ───
  "rewards.header": "Koino Rewards",
  "rewards.available": "Turn your Faith Points into real Koino rewards",
  "rewards.signInPrompt": "Sign in to view your points",
  "rewards.signInRequired": "Sign in to redeem gifts. Your claims persist across devices.",
  "rewards.signInButton": "Sign In",
  "rewards.button.redeem": "Redeem",
  "rewards.button.pickAndRedeem": "Pick & Redeem",
  "rewards.button.claimed": "✓ Claimed",
  "rewards.button.claiming": "Claiming...",
  "rewards.button.signIn": "Sign in",
  "rewards.button.outOfStock": "Out of stock",
  "rewards.button.moreFP": "{points} more FP",
  "rewards.optionsBadge": "{count} options",
  "rewards.claimed.label": "Claimed",
  "rewards.orderSummary": "Order Summary",
  "rewards.orderSummary.detail": "{title} · {variations}",
  "rewards.orderSummary.disclaimer": "{points} FP will be deducted. Admin will contact you on WhatsApp.",
  "rewards.redeemButton": "Redeem for {points} FP",
  "rewards.cancel": "Cancel",
  "rewards.specifications": "Specifications",
  "rewards.claimSuccess.title": "Claimed: {title}!",
  "rewards.claimSuccess.desc": "Admin will contact you via WhatsApp. {variations} Points spent: {points} FP.",

  // ─── Marketplace ───
  "marketplace.title": "Marketplace",
  "marketplace.subtitle": "Bibles, books, music & more",
  "marketplace.cart": "Cart",
  "marketplace.listItem": "List Item",
  "marketplace.search": "Search products...",
  "marketplace.contactSeller": "Contact Seller",
  "marketplace.addToCart": "Add to Cart",
  "marketplace.wishlist": "Wishlist",
  "marketplace.empty": "No products found.",
  "marketplace.outOfStock": "Out of Stock",
  "marketplace.optionBadge": "{count} options",
  "marketplace.specifications": "Specifications",
  "marketplace.vendor": "Vendor",
  "marketplace.save": "Save ₹{amount}",
  "marketplace.discount": "-{percent}%",

  // ─── Common UI ───
  "common.cancel": "Cancel",
  "common.save": "Save",
  "common.edit": "Edit",
  "common.delete": "Delete",
  "common.add": "Add",
  "common.loading": "Loading...",
  "common.error": "Something went wrong",
  "common.retry": "Try again",
  "common.close": "Close",
  "common.confirm": "Confirm",
  "common.back": "Back",
  "common.next": "Next",
  "common.previous": "Previous",

  // ─── Language switcher ───
  "language.switch": "Switch language",
  "language.current": "Current language",
  "language.choose": "Choose your language",

  // ─── Header user section ───
  "user.greeting": "Hi, {name}",
  "user.loading": "Loading...",

  // ─── Coming soon / placeholder ───
  "comingSoon.title": "Coming Soon",
  "comingSoon.body":
    "This section is coming soon. We're building {title} with the same care and prayer as everything else on Koino. Check back shortly — or explore Churches, Trivia, Apologetics, and more in the meantime!",

  // ─── TriviaView ───
  "triviaView.setup.mode.earn": "Earn Points",
  "triviaView.setup.mode.practice": "Practice",
  "triviaView.setup.startButton": "Start Quiz",
  "triviaView.setup.questionsCount": "{count} questions",
  "triviaView.playing.question": "Question {current} of {total}",
  "triviaView.playing.timeLeft": "{seconds}s",
  "triviaView.playing.submit": "Submit Answer",
  "triviaView.playing.next": "Next Question",
  "triviaView.playing.skip": "Skip",
  "triviaView.results.title": "Quiz Complete!",
  "triviaView.results.correct": "Correct: {count}/{total}",
  "triviaView.results.pointsEarned": "{points} FP earned",
  "triviaView.results.noPoints": "Practice mode — no points earned",
  "triviaView.results.shareText": "Bible Trivia! Correct: {correct}/{total}. Play on Koino!",
  "triviaView.results.playAgain": "Play Again",
  "triviaView.results.backToSetup": "Back to Setup",
  "triviaView.setup.difficulty": "Choose Difficulty",
  "triviaView.setup.category": "Choose Category",
  "triviaView.setup.questions": "Questions",
  "triviaView.setup.level.beginner": "Beginners",
  "triviaView.setup.level.intermediate": "Intermediate",
  "triviaView.setup.level.skilled": "Skilled",
  "triviaView.setup.level.expert": "Expert",
  "triviaView.setup.cat.full": "Full Bible",
  "triviaView.setup.cat.nt": "New Testament",
  "triviaView.setup.cat.ot": "Old Testament",
  "triviaView.setup.cat.apologetics": "Apologetics",

  // ─── Rewards tab ───
  "rewards.optionsBadgeSingular": "{count} option",

  // ─── Marketplace ───
  "marketplace.wishlisted": "Added to wishlist!",
  "marketplace.removedWishlist": "Removed from wishlist",
  "marketplace.addedToCart": "Added \"{name}\" to cart!",
  "marketplace.contactViaWhatsapp": "Buyers can now contact you on WhatsApp to purchase.",
  "marketplace.optionBadgeSingular": "{count} option",
  "marketplace.category.all": "All",
  "marketplace.category.bibles": "Bibles",
  "marketplace.category.books": "Books",
  "marketplace.category.music": "Music",
  "marketplace.category.apparel": "Apparel",
  "marketplace.category.gifts": "Gifts",
  "marketplace.listModal.title": "List an Item",
  "marketplace.listModal.noPaymentNeeded": "No payment gateway needed",
  "marketplace.listModal.noPaymentDesc":
    "Buyers will contact you directly on WhatsApp. You arrange payment & delivery with them.",
  "marketplace.listModal.name": "Product Name *",
  "marketplace.listModal.namePlaceholder": "e.g. ESV Study Bible",
  "marketplace.listModal.description": "Description",
  "marketplace.listModal.descriptionPlaceholder": "Condition, features, what's included...",
  "marketplace.listModal.price": "Selling Price *",
  "marketplace.listModal.mrp": "MRP (optional)",
  "marketplace.listModal.category": "Category",
  "marketplace.listModal.state": "State",
  "marketplace.listModal.city": "City",
  "marketplace.listModal.vendor": "Vendor / Your Name",
  "marketplace.listModal.photos": "Product Photos",
  "marketplace.listModal.whatsapp": "WhatsApp Number *",
  "marketplace.listModal.whatsappHint":
    "Buyers will see a \"Contact Seller\" button that opens WhatsApp with this number.",
  "marketplace.listModal.cancel": "Cancel",
  "marketplace.listModal.submit": "List Item",
  "marketplace.listModal.success": "Product listed!",
  "marketplace.listModal.successDesc": "Buyers can now contact you on WhatsApp to purchase.",
  "marketplace.listModal.variations": "Variations",
  "marketplace.listModal.variationsHint": "(sizes, colors...)",
  "marketplace.listModal.variationsEmpty": "Optional. Add a \"Size\" with options like S, M, L, XL or a \"Color\" with Black, White.",
  "marketplace.listModal.attributes": "Attributes",
  "marketplace.listModal.attributesHint": "(material, weight...)",
  "marketplace.listModal.attributesEmpty": "Optional. Add specs like \"Material: 100% Cotton\".",
  "marketplace.listModal.add": "Add",
  "marketplace.listModal.addOptionPlaceholder": "Add option + Enter",

  // ─── Churches ───
  "churches.title": "Churches",
  "churches.subtitle": "Find a community near you",
  "churches.search": "Search churches...",
  "churches.followers": "{count} followers",
  "churches.follow": "Follow",
  "churches.following": "Following",
  "churches.serviceTimes": "Service Times",
  "churches.contact": "Contact",
  "churches.empty": "No churches found.",
  "churches.denomination": "Denomination",
  "churches.languages": "Languages",
  "churches.listYourChurch": "List Your Church",
  "churches.viewDetails": "View Details",
  "churches.share": "Share",

  // ─── Prayer wall ───
  "prayer.title": "Prayer Wall",
  "prayer.subtitle": "Lift up needs and praise God for answered prayers",
  "prayer.sharePrayer": "Share Prayer Request",
  "prayer.prayFor": "I'll Pray",
  "prayer.prayedFor": "Prayed",
  "prayer.empty": "No prayers yet. Be the first to share.",
  "prayer.category.all": "All",
  "prayer.category.healing": "Healing",
  "prayer.category.family": "Family",
  "prayer.category.guidance": "Guidance",
  "prayer.category.thanksgiving": "Thanksgiving",
  "prayer.category.salvation": "Salvation",
  "prayer.category.provision": "Provision",

  // ─── Events ───
  "events.title": "Events",
  "events.subtitle": "Conferences, retreats, worship nights & more",
  "events.register": "Register",
  "events.viewDetails": "View Details",
  "events.share": "Share",
  "events.empty": "No events found.",
  "events.category.all": "All",
  "events.category.worship": "Worship Service",
  "events.category.bibleStudy": "Bible Study",
  "events.category.conference": "Conference",
  "events.category.retreat": "Retreat",
  "events.category.youth": "Youth Event",
  "events.category.concert": "Concert",
  "events.category.prayer": "Prayer Meeting",
  "events.category.outreach": "Outreach",

  // ─── Apologetics ───
  "apologetics.title": "Apologetics",
  "apologetics.subtitle": "Defending the faith with reason and Scripture",
  "apologetics.askQuestion": "Ask a Question",
  "apologetics.viewAnswers": "View Answers",
  "apologetics.answer": "Answer",
  "apologetics.empty": "No questions yet. Ask the first one!",
  "apologetics.topic.godsExistence": "God's Existence",
  "apologetics.topic.problemOfEvil": "Problem of Evil",
  "apologetics.topic.resurrection": "Resurrection",
  "apologetics.topic.bibleReliability": "Bible Reliability",
  "apologetics.topic.scienceFaith": "Science & Faith",
  "apologetics.topic.worldReligions": "World Religions",

  // ─── Bible ───
  "bible.read": "Read",
  "bible.search": "Search the Bible...",
  "bible.bookmark": "Bookmark",
  "bible.bookmarked": "Bookmarked!",
  "bible.empty": "No results found.",
  "bible.translations.kjv": "KJV",
  "bible.translations.web": "WEB",
  "bible.plans": "Reading Plans",
  "bible.plan.bible90": "Bible in 90 Days",
  "bible.plan.gospels14": "Gospels in 14 Days",
  "bible.plan.psalms31": "Psalms & Proverbs in 31 Days",
  "bible.plan.nt30": "New Testament in 30 Days",

  // ─── Admin ───
  "admin.title": "Admin Panel",
  "admin.signedInAs": "Signed in as {name}",
  "admin.access.title": "Admin Access",
  "admin.access.subtitle": "Sign in with an admin account",
  "admin.access.signIn": "Sign In",
  "admin.access.bootstrapped":
    "Admin authorization is verified server-side via your authenticated session role. Only users with the admin role in the database can access this panel.",
  "admin.accessDenied.title": "Access Denied",
  "admin.accessDenied.body":
    "You're signed in as {name}, but your account doesn't have admin privileges.",
  "admin.accessDenied.help":
    "Admin access is granted by setting role = \"admin\" in the database User table. Contact the site administrator if you believe this is an error.",
  "admin.back": "Back to home",
  "admin.gifts.title": "Reward Gifts",
  "admin.gifts.addGift": "Add Gift",
  "admin.gifts.cancel": "Cancel",
  "admin.gifts.tip":
    "Gifts you add appear instantly in the Trivia → Rewards tab for players to redeem. Default gifts (without the \"Admin\" badge) are seeded examples and can't be edited or removed — only gifts you add here can be modified. When a player redeems a gift, contact them on WhatsApp to arrange delivery.",
  "admin.redemptions.title": "Gift Redemptions",
  "admin.redemptions.empty": "No redemptions yet.",
  "admin.redemptions.emptyDesc":
    "When players claim gifts from Trivia → Rewards, they'll appear here with the size/color they picked.",
  "admin.redemptions.workflow":
    "Workflow: When a player redeems a gift, it appears here as Pending. Contact them via WhatsApp (use their email/username), then mark as Contacted → Shipped → Delivered. The size/color they selected is shown so you know what to ship.",
  "admin.redemptions.noVariations": "No variations selected",
  "admin.redemptions.fpSpent": "{points} FP spent",
  "admin.redemptions.stats.total": "Total",
  "admin.redemptions.stats.pending": "Pending",
  "admin.redemptions.stats.contacted": "Contacted",
  "admin.redemptions.stats.shipped": "Shipped",
  "admin.redemptions.stats.delivered": "Delivered",
  "admin.redemptions.status.pending": "Pending",
  "admin.redemptions.status.contacted": "Contacted",
  "admin.redemptions.status.shipped": "Shipped",
  "admin.redemptions.status.delivered": "Delivered",

  // ─── Common UI ───
  "common.remove": "Remove",
  "common.search": "Search",
  "common.filter": "Filter",
  "common.all": "All",
  "common.optional": "(optional)",
  "common.required": "*",
  "common.points": "{count} pts",
  "common.faithPoints": "{count} FP",
  "common.stock": "{count} in stock",
  "common.left": "{count} left",
  "common.followers": "{count} followers",
  "common.reviews": "({count} reviews)",
  "common.saveAmount": "Save ₹{amount}",
  "common.discount": "-{percent}%",
};

export default en;
