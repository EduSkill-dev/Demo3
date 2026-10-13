// An individual who signed in through Google (or another outside account)
// arrives with a name and an email only. Before using the platform they add
// what every individual account has: first name, surname, birth date,
// gender and phone. Accounts made with the sign-up form already have these.
// Safe to import anywhere.

export type ProfileFields = {
  role?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  birth_date?: string | null;
  age?: number | null; // legacy accounts
  gender?: string | null;
  phone?: string | null;
};

// True for an account that came from an outside provider, not email + password.
export function isExternalAccount(user: { app_metadata?: Record<string, unknown> } | null | undefined): boolean {
  const provider = user?.app_metadata?.provider;
  return typeof provider === "string" && provider !== "email";
}

export function missingProfileFields(p: ProfileFields | null | undefined): string[] {
  if (!p || p.role !== "individual") return [];
  const missing: string[] = [];
  if (!p.first_name?.trim()) missing.push("first_name");
  if (!p.last_name?.trim()) missing.push("last_name");
  if (!p.birth_date && p.age == null) missing.push("birth_date");
  if (!p.gender) missing.push("gender");
  if (!p.phone?.trim()) missing.push("phone");
  return missing;
}

// Where an unfinished account is sent, and the message the server gives when
// it tries to act before finishing.
export const COMPLETE_PATH = "/account/complete";
export const INCOMPLETE_ERROR = "Նախ լրացրեք Ձեր տվյալները (անուն, ազգանուն, ծննդյան ամսաթիվ, սեռ, հեռախոս)։";
