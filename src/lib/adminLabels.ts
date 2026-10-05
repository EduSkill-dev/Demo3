// Names used across the admin area (safe to import from client components).
// The admin area is Armenian only.

export const ADMIN_PERMS = ["individuals", "clubs", "tours", "pages"] as const;
export type AdminPerm = (typeof ADMIN_PERMS)[number];

export const PERM_LABELS: Record<AdminPerm, string> = {
  individuals: "Անհատների հաշիվների կառավարում",
  clubs: "Ակումբների հաշիվների կառավարում",
  tours: "Արշավների հայտարարությունների կառավարում",
  pages: "Հարթակի էջերի կառավարում",
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
  "booking.created": "Գրանցվեց արշավին",
  "booking.cancelled": "Չեղարկեց գրանցումը",
  "review.created": "Թողեց գնահատական",
  "payment.made": "Կատարեց վճարում",
  "admin.account_frozen": "Սառեցրեց հաշիվը",
  "admin.account_blocked": "Արգելափակեց հաշիվը",
  "admin.account_activated": "Ակտիվացրեց հաշիվը",
  "admin.account_deleted": "Ջնջեց հաշիվը",
  "admin.tour_closed": "Փակեց հայտարարությունը",
  "admin.tour_opened": "Բացեց հայտարարությունը",
  "admin.text_saved": "Խմբագրեց կայքի տեքստը",
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
      ["tour", "Արշավի էջ"],
      ["signup", "Արշավի գրանցում"],
      ["clubsPage", "Ակումբներ"],
      ["clubPage", "Ակումբի էջ"],
      ["faq", "Հաճախ տրվող հարցեր"],
      ["legal", "Պայմաններ, գաղտնիություն, օգնություն"],
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
      ["applications", "Հայտեր"],
      ["clubData", "Ակումբի տվյալներ"],
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
