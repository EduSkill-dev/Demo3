import type { Locale } from "./config";
import hy, { type Dictionary } from "./dictionaries/hy";
import ru from "./dictionaries/ru";
import en from "./dictionaries/en";

export type DeepPartial<T> = { [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K] };

// "common.save" | "region.yerevan" | ... — every leaf path of the dictionary.
type Leaves<T, P extends string = ""> = {
  [K in keyof T & string]: T[K] extends string ? `${P}${K}` : Leaves<T[K], `${P}${K}.`>;
}[keyof T & string];
export type MessageKey = Leaves<Dictionary>;
// Keys built at runtime from stored values, e.g. `region.${tour.regions[0]}`.
// Unknown ones fall back to the key itself.
export type DynamicKey = `${keyof Dictionary & string}.${string}`;

export type Vars = Record<string, string | number>;
export type TFunction = (key: MessageKey | DynamicKey, vars?: Vars) => string;

// Admin-edited texts for one language: "home.heroTitle" → replacement.
export type Overrides = Record<string, string>;

export const DICTIONARIES: Record<Locale, DeepPartial<Dictionary>> = { hy, ru, en };

function lookup(dict: unknown, key: string): string | undefined {
  let node: unknown = dict;
  for (const part of key.split(".")) {
    if (node == null || typeof node !== "object") return undefined;
    node = (node as Record<string, unknown>)[part];
  }
  return typeof node === "string" ? node : undefined;
}

// An admin's replacement wins; missing translations fall back to Armenian,
// then to the key itself.
export function makeT(locale: Locale, overrides?: Overrides): TFunction {
  const dict = DICTIONARIES[locale];
  return (key, vars) => {
    const raw = overrides?.[key] ?? lookup(dict, key) ?? lookup(hy, key) ?? key;
    if (!vars) return raw;
    return raw.replace(/\{(\w+)\}/g, (m, name: string) =>
      name in vars ? String(vars[name]) : m
    );
  };
}
