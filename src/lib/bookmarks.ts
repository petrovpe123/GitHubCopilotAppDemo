export interface Bookmark {
  url: string;
  slug: string;
}

export const STORAGE_KEY = 'mona-bookmarks';
export const SEPARATOR = ' :: ';

const BASE62 = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
const SLUG_PATTERN = /^mona-[0-9A-Za-z]+$/;

/** Normalise user input to an absolute http(s) URL, or return null if invalid. */
export function normalizeUrl(input: unknown): string | null {
  if (typeof input !== 'string') return null;
  const trimmed = input.trim();
  if (!trimmed || /\s/.test(trimmed)) return null;
  const candidate = /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const parsed = new URL(candidate);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return null;
    if (!parsed.hostname) return null;
    const href = parsed.href;
    return parsed.pathname === '/' && !parsed.search && !parsed.hash ? href.replace(/\/$/, '') : href;
  } catch {
    return null;
  }
}

/** Create a "mona-" slug with `length` base62 characters. `random` returns an int in [0, 62). */
export function generateSlug(random: (max: number) => number = defaultRandom, length = 4): string {
  let out = '';
  for (let i = 0; i < length; i++) out += BASE62[random(BASE62.length) % BASE62.length];
  return `mona-${out}`;
}

function defaultRandom(max: number): number {
  const buf = new Uint32Array(1);
  globalThis.crypto.getRandomValues(buf);
  return buf[0] % max;
}

/** Generate a slug not present in `existing`. */
export function uniqueSlug(existing: Bookmark[], random?: (max: number) => number): string {
  const taken = new Set(existing.map((b) => b.slug));
  for (let i = 0; i < 50; i++) {
    const slug = generateSlug(random);
    if (!taken.has(slug)) return slug;
  }
  return generateSlug(random, 8);
}

/** Build a bookmark from raw input; returns null if the URL is invalid. */
export function createBookmark(input: unknown, existing: Bookmark[], random?: (max: number) => number): Bookmark | null {
  const url = normalizeUrl(input);
  return url ? { url, slug: uniqueSlug(existing, random) } : null;
}

/**
 * Validate an untrusted parsed value. Keeps well-formed {url, slug} objects,
 * migrates legacy plain-string URLs, and drops everything else.
 */
export function sanitizeBookmarks(value: unknown): Bookmark[] {
  if (!Array.isArray(value)) return [];
  const result: Bookmark[] = [];
  const slugs = new Set<string>();
  for (const item of value) {
    let url: string | null = null;
    let slug: string | null = null;
    if (typeof item === 'string') {
      url = normalizeUrl(item);
    } else if (item && typeof item === 'object' && !Array.isArray(item)) {
      const rec = item as Record<string, unknown>;
      if (typeof rec.slug === 'string' && SLUG_PATTERN.test(rec.slug)) {
        url = normalizeUrl(rec.url);
        slug = rec.slug;
      }
    }
    if (!url) continue;
    if (!slug || slugs.has(slug)) slug = uniqueSlug([...result]);
    slugs.add(slug);
    result.push({ url, slug });
  }
  return result;
}

/** Parse a raw localStorage string. Never throws. */
export function parseStored(raw: string | null | undefined): Bookmark[] {
  if (typeof raw !== 'string' || raw.trim() === '') return [];
  try {
    return sanitizeBookmarks(JSON.parse(raw));
  } catch {
    return [];
  }
}

export function formatBookmark(b: Bookmark): string {
  return `${b.url}${SEPARATOR}${b.slug}`;
}

interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

/** Load bookmarks; never throws even if storage is unavailable. */
export function loadBookmarks(storage: StorageLike | undefined): Bookmark[] {
  try {
    return parseStored(storage?.getItem(STORAGE_KEY));
  } catch {
    return [];
  }
}

/** Save bookmarks; returns false if storage failed (quota, privacy mode). */
export function saveBookmarks(storage: StorageLike | undefined, list: Bookmark[]): boolean {
  try {
    storage?.setItem(STORAGE_KEY, JSON.stringify(list));
    return !!storage;
  } catch {
    return false;
  }
}
