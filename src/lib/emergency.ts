// The optional emergency contact a participant leaves with a booking.
// Shared by the sign-up form (to check before sending) and the server.

export const EMERGENCY_PHONE = /^[+0-9 ()-]{6,20}$/;
export const EMERGENCY_NAME_MAX = 80;

export type EmergencyContact = { name: string; phone: string };
export type EmergencyParsed =
  | { ok: true; contact: EmergencyContact | null; remember: boolean }
  | { ok: false; error: string };

// Both fields or neither. The messages are the server's (Armenian); the
// browser maps them to the reader's language through serverErrors.
export function parseEmergency(raw: unknown): EmergencyParsed {
  const input = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const name = typeof input.name === "string" ? input.name.trim().replace(/\s+/g, " ") : "";
  const phone = typeof input.phone === "string" ? input.phone.trim() : "";
  if (!name && !phone) return { ok: true, contact: null, remember: false };
  if (!name || !phone) {
    return { ok: false, error: "Արտակարգ կոնտակտի համար լրացրեք և՛ անունը, և՛ հեռախոսը, կամ թողեք երկուսն էլ դատարկ։" };
  }
  if (name.length > EMERGENCY_NAME_MAX || !EMERGENCY_PHONE.test(phone)) {
    return { ok: false, error: "Արտակարգ կոնտակտի հեռախոսը կամ անունը սխալ է լրացված։" };
  }
  return { ok: true, contact: { name, phone }, remember: input.remember === true };
}
