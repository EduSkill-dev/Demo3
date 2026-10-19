// Names used across the admin area (safe to import from client components).
// The admin area is Armenian only.

export const ADMIN_PERMS = ["individuals", "clubs", "tours", "pages", "news", "messages"] as const;
export type AdminPerm = (typeof ADMIN_PERMS)[number];

export const PERM_LABELS: Record<AdminPerm, string> = {
  individuals: "Անհատների հաշիվների կառավարում",
  clubs: "Ակումբների հաշիվների կառավարում",
  tours: "Արշավների հայտարարությունների կառավարում",
  pages: "Հարթակի էջերի կառավարում",
  news: "Հարթակի նորություններ օգտատերերին (կայք, էլ. նամակ, Telegram)",
  messages: "Օգտատերերի հաղորդագրություններ՝ օգնության չաթ և առաջարկներ",
};

export type AccountStatus = "active" | "frozen" | "blocked";
export const STATUS_LABELS: Record<AccountStatus, string> = {
  active: "Ակտիվ",
  frozen: "Սառեցված",
  blocked: "Արգելափակված",
};

export const ROLE_LABELS: Record<string, string> = {
  individual: "Անհատ",
  club: "Ակումբ",
  admin: "Ադմին",
  super: "Սուպեր ադմին",
};

// Single functions an admin can force off for one account.
export const ACCOUNT_LIMITS = {
  post: { role: "club", label: "Նոր հայտարարություններ", short: "Հրապարակում" },
  receive: { role: "club", label: "Նոր հայտերի ընդունում", short: "Հայտեր" },
  book: { role: "individual", label: "Արշավների ամրագրում", short: "Ամրագրում" },
  request: { role: "individual", label: "Անհատական հայտի ստեղծում", short: "Հայտի ստեղծում" },
  chat: { role: "individual", label: "Օգնության չաթ", short: "Չաթ" },
  clubChat: { role: "club", label: "Օգնության չաթ", short: "Չաթ" },
} as const;
export type AccountLimit = keyof typeof ACCOUNT_LIMITS;

// activity_log.action → what the log page shows.
export const ACTION_LABELS: Record<string, string> = {
  "auth.login": "Մուտք գործեց",
  "account.created": "Ստեղծեց հաշիվ",
  "account.deleted": "Ջնջեց իր հաշիվը",
  "profile.updated": "Խմբագրեց իր տվյալները",
  "club.updated": "Խմբագրեց ակումբի տվյալները",
  "tour.created": "Ավելացրեց հայտարարություն",
  "tour.updated": "Խմբագրեց հայտարարությունը",
  "tour.deleted": "Ջնջեց հայտարարությունը",
  "tour.cancelled": "Չեղարկեց արշավը",
  "tour.hidden": "Թաքցրեց հայտարարությունը",
  "tour.shown": "Վերադարձրեց հայտարարությունը",
  "booking.created": "Ամրագրեց արշավ",
  "booking.cancelled": "Չեղարկեց ամրագրումը",
  "review.created": "Թողեց գնահատական",
  "tour.liked": "Հավանեց արշավը",
  "club.liked": "Հավանեց ակումբը",
  "request.created": "Թողեց անհատական պատվեր",
  "request.closed": "Փակեց իր պատվերը",
  "offer.sent": "Առաջարկ ուղարկեց պատվերին",
  "offer.accepted": "Ընդունեց ակումբի առաջարկը",
  "payment.made": "Կատարեց վճարում",
  "security.ip_blocked": "Պաշտպանություն՝ IP հասցեն արգելափակվեց",
  "security.function_paused": "Պաշտպանություն՝ ֆունկցիան ժամանակավորապես անջատվեց",
  "admin.account_frozen": "Սառեցրեց հաշիվը",
  "admin.admin_blocked": "Արգելափակեց ադմինին",
  "admin.admin_unblocked": "Բացեց ադմինի արգելափակումը",
  "security.admin_locked": "Պաշտպանություն՝ ադմինի մուտքը փակվեց 5 սխալ գաղտնաբառից հետո",
  "admin.account_blocked": "Արգելափակեց հաշիվը",
  "admin.account_activated": "Ակտիվացրեց հաշիվը",
  "admin.account_deleted": "Ջնջեց հաշիվը",
  "admin.limit_on": "Անջատեց հաշվի ֆունկցիան",
  "admin.limit_off": "Վերադարձրեց հաշվի ֆունկցիան",
  "admin.tour_closed": "Փակեց հայտարարությունը",
  "admin.tour_opened": "Բացեց հայտարարությունը",
  "admin.text_saved": "Խմբագրեց կայքի տեքստը",
  "admin.sight_saved": "Խմբագրեց տեսարժան վայրերի ցանկը",
  "admin.share_saved": "Փոխեց սոց. ցանցերում կիսվելու կարգավորումները",
  "admin.club_share_set": "Փոխեց ակումբի կիսվելու հնարավորությունը",
  "admin.block_removed": "Բացեց ավտոմատ արգելքը",
  "admin.club_report_set": "Փոխեց ակումբի հաշվետվության տողերը",
  "admin.news_posted": "Գրառում արեց նորությունների ալիքում",
  "admin.message_answered": "Պատասխանեց օգտատիրոջ հաղորդագրությանը",
  "admin.bio_cleared": "Հեռացրեց արշավականի անձնագրի տեքստը",
  "admin.plan_saved": "Փոխեց փաթեթի կարգավորումները",
  "admin.club_plan_set": "Փոխեց ակումբի փաթեթը",
  "admin.admin_created": "Ստեղծեց ադմին",
  "admin.admin_updated": "Փոխեց ադմինի թույլտվությունները",
  "admin.admin_password_reset": "Տվեց նոր մեկանգամյա գաղտնաբառ",
  "admin.admin_deleted": "Հեռացրեց ադմինին",
  "admin.password_changed": "Փոխեց իր գաղտնաբառը",
};

// Dictionary sections as the text editor lists them, grouped the way the
// site is laid out. Sections not named here are listed under their key.
export const TEXT_SECTIONS: { title: string; sections: [string, string][] }[] = [
  {
    title: "Հիմնական էջեր",
    sections: [
      ["home", "Գլխավոր էջ"],
      ["about", "Մեր մասին"],
      ["toursPage", "Արշավներ"],
      ["calendar", "Արշավների օրացույց"],
      ["support", "Օգնության չաթ"],
      ["share", "Արշավով կիսվելը"],
      ["planner", "Պլանավորիչ"],
      ["tour", "Արշավի էջ"],
      ["signup", "Արշավի ամրագրում"],
      ["clubsPage", "Ակումբներ"],
      ["clubPage", "Ակումբի էջ"],
      ["faq", "Հաճախ տրվող հարցեր"],
      ["legal", "Պայմաններ, գաղտնիություն, օգնություն"],
      ["requests", "Անհատական պատվերներ"],
      ["custom", "Անհատական արշավի հրավեր"],
      ["sights", "Տեսարժան վայրերի ընտրիչ"],
    ],
  },
  {
    title: "Վերնամաս և ստորին մաս",
    sections: [
      ["header", "Վերնամաս (մենյու)"],
      ["footer", "Ստորին մաս"],
      ["contact", "Առաջարկի հաստատում"],
      ["newsletter", "Բաժանորդագրության էջեր"],
    ],
  },
  {
    title: "Մուտք և գրանցում",
    sections: [["auth", "Մուտք, գրանցում, գաղտնաբառ"]],
  },
  {
    title: "Անհատի բաժին",
    sections: [
      ["account", "Անձնական էջ"],
      ["rating", "Գնահատականներ"],
      ["payment", "Վճարում"],
      ["receipt", "Անդորրագիր"],
    ],
  },
  {
    title: "Ակումբի բաժին",
    sections: [
      ["nav", "Բաժինների անվանումներ"],
      ["dashboard", "Վահանակ"],
      ["announcements", "Հայտարարություններ"],
      ["tourForm", "Հայտարարության ձև"],
      ["bring", "Ինչ վերցնել (ցանկ)"],
      ["applications", "Հայտեր"],
      ["clubData", "Ակումբի տվյալներ"],
      ["report", "Ամսական հաշվետվություն"],
      ["packagesPage", "Փաթեթների էջ"],
      ["package", "Փաթեթներ"],
    ],
  },
  {
    title: "Ընդհանուր բառեր",
    sections: [
      ["common", "Ընդհանուր"],
      ["region", "Մարզեր"],
      ["terrain", "Տեղանք"],
      ["difficulty", "Բարդություն"],
      ["focus", "Ուղղվածություններ"],
      ["errors", "Սխալների հաղորդագրություններ"],
      ["theme", "Տեսք"],
      ["language", "Լեզու"],
    ],
  },
];
