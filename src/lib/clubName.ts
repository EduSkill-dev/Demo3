// A club's name (Gor, 2026-10-28): up to 50 characters; letters of ONE
// alphabet — Armenian, Russian or English — plus digits and "_"; words
// separated by a single space. Upper and lower case are both fine. The
// database checks the same rule (0083_club_name_rules.sql) for new names.
export const CLUB_NAME_MAX = 50;

const SCRIPTS = ["Ա-Ֆա-և", "А-яЁё", "A-Za-z"];
const RULES = SCRIPTS.map((letters) => ({
  shape: new RegExp(`^[${letters}0-9_]+( [${letters}0-9_]+)*$`),
  letter: new RegExp(`[${letters}]`),
}));

// Spaces at the ends dropped and runs of spaces made one — the only fix made
// for the writer; everything else is theirs to correct.
export const tidyClubName = (value: string) => value.trim().replace(/\s+/g, " ");

export function clubNameOk(name: string): boolean {
  if (name.length < 2 || name.length > CLUB_NAME_MAX) return false;
  return RULES.some((r) => r.shape.test(name) && r.letter.test(name));
}
