// Mock payment gateway for the test mode. Nothing here talks to a real
// acquirer and no money moves — it mirrors how a real gateway would answer so
// the UI, receipts and emails behave exactly as they will in production.
//
// Swap this file for a real provider (Paddle, Lemon Squeezy, a local bank
// gateway…) and the rest of the app keeps working: the API route only needs
// `{ status, message, last4 }` back.

export type ChargeResult = {
  status: "succeeded" | "declined";
  message: string | null;
  last4: string | null;
};

const TEST_CARDS: Record<string, string> = {
  "4242424242424242": "", // succeeds
  "4000000000000002": "Բանկը մերժեց քարտը",
  "4000000000009995": "Քարտի վրա բավարար միջոց չկա",
  "4000000000000069": "Քարտի ժամկետը լրացել է",
};

export function normalizeCardNumber(value: string): string {
  return (value || "").replace(/[\s-]/g, "");
}

export function luhn(digits: string): boolean {
  if (!/^\d{12,19}$/.test(digits)) return false;
  let sum = 0;
  let double = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let d = digits.charCodeAt(i) - 48;
    if (double) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
    double = !double;
  }
  return sum % 10 === 0;
}

export function chargeTestCard(cardNumber: string, exp?: string, cvc?: string): ChargeResult {
  const digits = normalizeCardNumber(cardNumber);
  const last4 = digits.length >= 4 ? digits.slice(-4) : null;

  if (!luhn(digits)) {
    return { status: "declined", message: "Անվավեր քարտի համար", last4 };
  }
  if (exp && !/^\d{2}\/?\d{2}$/.test(exp.replace(/\s/g, ""))) {
    return { status: "declined", message: "Սխալ ժամկետ (օր.՝ 12/28)", last4 };
  }
  if (exp) {
    const m = exp.match(/^(\d{2})\s*\/\s*(\d{2})$/);
    if (m) {
      const month = Number(m[1]);
      const year = 2000 + Number(m[2]);
      const now = new Date();
      const endOfMonth = new Date(year, month, 0, 23, 59, 59);
      if (month < 1 || month > 12) {
        return { status: "declined", message: "Սխալ ժամկետ (օր.՝ 12/28)", last4 };
      }
      if (endOfMonth < now) {
        return { status: "declined", message: "Քարտի ժամկետը լրացել է", last4 };
      }
    }
  }
  if (cvc && !/^\d{3,4}$/.test(cvc)) {
    return { status: "declined", message: "Սխալ CVC", last4 };
  }

  const known = TEST_CARDS[digits];
  if (known !== undefined && known !== "") {
    return { status: "declined", message: known, last4 };
  }

  return { status: "succeeded", message: null, last4 };
}
