import type { MessageKey, TFunction } from "@/i18n/translate";

// Database triggers, API routes and the mock gateway answer in Armenian.
// Recognise those messages and show them in the reader's language; anything
// unknown is shown as-is.
const KNOWN: [string, MessageKey][] = [
  ["հաշիվը սառեցված", "errors.frozen"],
  ["կոնտակտային տվյալներ գրել չի կարելի", "requests.errContact"],
  ["Առաջարկ ուղարկելու համար ընտրեք փաթեթ", "requests.needPackage"],
  ["գրանցվելու հնարավորությունն անջատված", "errors.bookingDisabled"],
  ["ավելացնելու հնարավորությունն անջատված", "errors.postingDisabled"],
  ["Արդեն գրանցված", "errors.alreadyBooked"],
  ["duplicate key", "errors.alreadyBooked"],
  ["Տեղերը սպառված", "errors.seatsGone"],
  ["Տեղերը լրացած", "errors.seatsGone"],
  ["արդեն տեղի է ունեցել", "errors.tourPast"],
  ["գրանցումը փակ է", "errors.bookingClosed"],
  ["ժամանակավորապես փակ", "errors.bookingClosed"],
  ["Ակումբները չեն կարող գրանցվել", "errors.clubsCannotBook"],
  ["հաստատեք Ձեր էլ. հասցեն", "errors.confirmEmail"],
  ["Չեղարկել հնարավոր է միայն", "errors.cancel48"],
  ["ընտրեք փաթեթ", "errors.needPackage"],
  ["փաթեթի սահմանաչափին", "errors.listingLimit"],
  ["ջնջելու փոխարեն չեղարկեք", "errors.bookedTourDelete"],
  ["վճարովի է", "errors.paidTour"],
  ["Մուտք գործիր", "errors.signIn"],
  ["Ավելի փոքր փաթեթ", "errors.packageDowngrade"],
  ["Երկարաձգել կարող եք", "errors.packageNotDue"],
  ["Փաթեթը ակտիվանում է միայն", "errors.packageServerOnly"],
  ["Փաթեթը փոխվում է միայն", "errors.packageServerOnly"],
  ["Անվավեր քարտի", "errors.cardInvalid"],
  ["Սխալ ժամկետ", "errors.cardExpiryFormat"],
  ["Քարտի ժամկետը լրացել", "errors.cardExpired"],
  ["Բանկը մերժեց", "errors.cardDeclined"],
  ["բավարար միջոց", "errors.cardFunds"],
  ["Սխալ CVC", "errors.cardCvc"],
  ["չի գտնվել", "errors.notFound"],
];

export function serverErrorMessage(t: TFunction, message: string | null | undefined): string {
  if (!message) return t("common.error");
  const hit = KNOWN.find(([needle]) => message.includes(needle));
  return hit ? t(hit[1]) : message;
}
