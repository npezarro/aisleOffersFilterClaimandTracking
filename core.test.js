import { describe, it, expect } from 'vitest';
import {
  CARD_SELECTOR,
  TAG_SELECTOR,
  AD_BADGE_SELECTOR,
  CARD_TITLE_SELECTORS,
  STORAGE_KEY_PRESETS,
  STORAGE_KEY_ACTIVE,
  STORAGE_KEY_CLAIM_MODE,
  STORAGE_KEY_PROCESSED,
  STORAGE_KEY_HISTORY,
  isDetailPage,
  escapeCSV,
  buildCSV,
  isQuickFreeTag,
  sortTags,
  filterTagsBySearch,
  isDirtyState,
  sanitizeFilename,
  formatLocationsText,
  formatLocationSummary,
  buildHistoryEntry,
  shouldShowCard,
} from './core.js';

// --- Constants ---

describe('constants', () => {
  it('CARD_SELECTOR targets snap-center cards', () => {
    expect(CARD_SELECTOR).toBe('.snap-center');
  });

  it('TAG_SELECTOR includes brand-500 class', () => {
    expect(TAG_SELECTOR).toContain('text-brand-500');
  });

  it('AD_BADGE_SELECTOR targets white text badge', () => {
    expect(AD_BADGE_SELECTOR).toContain('text-white');
  });

  it('CARD_TITLE_SELECTORS has expected fallback order', () => {
    expect(CARD_TITLE_SELECTORS).toEqual(['h5', 'h3', 'h4', '.font-bold.text-slate-900']);
  });

  it('storage keys are unique strings', () => {
    const keys = [STORAGE_KEY_PRESETS, STORAGE_KEY_ACTIVE, STORAGE_KEY_CLAIM_MODE, STORAGE_KEY_PROCESSED, STORAGE_KEY_HISTORY];
    const unique = new Set(keys);
    expect(unique.size).toBe(keys.length);
    keys.forEach(k => expect(typeof k).toBe('string'));
  });
});

// --- isDetailPage ---

describe('isDetailPage', () => {
  it('matches /offers/abc123', () => {
    expect(isDetailPage('https://discover.gotoaisle.com/offers/abc123')).toBe(true);
  });

  it('matches /offers/ABC', () => {
    expect(isDetailPage('https://discover.gotoaisle.com/offers/ABC')).toBe(true);
  });

  it('does not match /offers (list page)', () => {
    expect(isDetailPage('https://discover.gotoaisle.com/offers')).toBe(false);
  });

  it('does not match /offers/ (trailing slash)', () => {
    expect(isDetailPage('https://discover.gotoaisle.com/offers/')).toBe(false);
  });

  it('does not match /offers/abc/edit (nested path)', () => {
    expect(isDetailPage('https://discover.gotoaisle.com/offers/abc/edit')).toBe(false);
  });

  it('does not match offers with special characters', () => {
    expect(isDetailPage('https://discover.gotoaisle.com/offers/abc-123')).toBe(false);
  });
});

// --- escapeCSV ---

describe('escapeCSV', () => {
  it('wraps plain text in double quotes', () => {
    expect(escapeCSV('hello')).toBe('"hello"');
  });

  it('escapes internal double quotes', () => {
    expect(escapeCSV('say "hi"')).toBe('"say ""hi"""');
  });

  it('handles empty string', () => {
    expect(escapeCSV('')).toBe('""');
  });

  it('handles null/undefined', () => {
    expect(escapeCSV(null)).toBe('""');
    expect(escapeCSV(undefined)).toBe('""');
  });

  it('handles commas (no special escaping needed, just quoted)', () => {
    expect(escapeCSV('a,b,c')).toBe('"a,b,c"');
  });

  it('handles newlines inside values', () => {
    expect(escapeCSV('line1\nline2')).toBe('"line1\nline2"');
  });
});

// --- buildCSV ---

describe('buildCSV', () => {
  it('returns header row for empty history', () => {
    const csv = buildCSV([]);
    expect(csv).toBe('Date,Brand,Product,Offer,Locations\n');
  });

  it('formats a single history entry', () => {
    const csv = buildCSV([{ date: '1/1/2026', brand: 'Kraft', product: 'Cheese', offer: 'Free', locations: 'Walmart' }]);
    const lines = csv.split('\n');
    expect(lines[0]).toBe('Date,Brand,Product,Offer,Locations');
    expect(lines[1]).toContain('"Kraft"');
    expect(lines[1]).toContain('"Cheese"');
    expect(lines[1]).toContain('"Free"');
  });

  it('escapes quotes in brand names', () => {
    const csv = buildCSV([{ date: '1/1', brand: 'Ben & Jerry\'s "Ice"', product: 'P', offer: 'O', locations: 'L' }]);
    expect(csv).toContain('""Ice""');
  });

  it('handles multiple entries', () => {
    const entries = [
      { date: '1/1', brand: 'A', product: 'B', offer: 'C', locations: 'D' },
      { date: '1/2', brand: 'E', product: 'F', offer: 'G', locations: 'H' },
    ];
    const lines = buildCSV(entries).split('\n').filter(l => l);
    expect(lines.length).toBe(3); // header + 2 rows
  });
});

// --- isQuickFreeTag ---

describe('isQuickFreeTag', () => {
  it('accepts "Free Product"', () => {
    expect(isQuickFreeTag('Free Product')).toBe(true);
  });

  it('accepts "free item" (case insensitive)', () => {
    expect(isQuickFreeTag('free item')).toBe(true);
  });

  it('accepts "FREE SAMPLE"', () => {
    expect(isQuickFreeTag('FREE SAMPLE')).toBe(true);
  });

  it('rejects "Buy One Get Free"', () => {
    expect(isQuickFreeTag('Buy One Get Free')).toBe(false);
  });

  it('rejects "Earn Free Points"', () => {
    expect(isQuickFreeTag('Earn Free Points')).toBe(false);
  });

  it('rejects tags without "free"', () => {
    expect(isQuickFreeTag('50% Off')).toBe(false);
  });

  it('rejects "buy free earn" (has both buy and free)', () => {
    expect(isQuickFreeTag('buy free earn')).toBe(false);
  });
});

// --- sortTags ---

describe('sortTags', () => {
  it('puts selected tags first', () => {
    const entries = [['Dairy', 5], ['Free', 3]];
    const selected = new Set(['Free']);
    const result = sortTags(entries, selected);
    expect(result[0][0]).toBe('Free');
  });

  it('sorts unselected by count descending', () => {
    const entries = [['A', 2], ['B', 10], ['C', 5]];
    const result = sortTags(entries, new Set());
    expect(result.map(e => e[0])).toEqual(['B', 'C', 'A']);
  });

  it('breaks ties alphabetically', () => {
    const entries = [['Zebra', 5], ['Apple', 5]];
    const result = sortTags(entries, new Set());
    expect(result[0][0]).toBe('Apple');
    expect(result[1][0]).toBe('Zebra');
  });

  it('selected tags among themselves sort by count then alpha', () => {
    const entries = [['B', 3], ['A', 5]];
    const selected = new Set(['A', 'B']);
    const result = sortTags(entries, selected);
    expect(result[0][0]).toBe('A'); // higher count
    expect(result[1][0]).toBe('B');
  });

  it('does not mutate original array', () => {
    const entries = [['B', 1], ['A', 2]];
    const original = [...entries];
    sortTags(entries, new Set());
    expect(entries).toEqual(original);
  });

  it('handles empty array', () => {
    expect(sortTags([], new Set())).toEqual([]);
  });
});

// --- filterTagsBySearch ---

describe('filterTagsBySearch', () => {
  const tags = [['Free Product', 10], ['Dairy', 5], ['Free Sample', 3], ['Meat', 2]];

  it('returns all tags when search is empty', () => {
    expect(filterTagsBySearch(tags, '')).toEqual(tags);
  });

  it('returns all tags when search is falsy', () => {
    expect(filterTagsBySearch(tags, null)).toEqual(tags);
    expect(filterTagsBySearch(tags, undefined)).toEqual(tags);
  });

  it('filters by substring match', () => {
    const result = filterTagsBySearch(tags, 'free');
    expect(result.length).toBe(2);
    expect(result.every(([name]) => name.toLowerCase().includes('free'))).toBe(true);
  });

  it('is case insensitive', () => {
    const result = filterTagsBySearch(tags, 'FREE');
    expect(result.length).toBe(2);
  });

  it('returns empty for no matches', () => {
    expect(filterTagsBySearch(tags, 'zzzzz')).toEqual([]);
  });

  it('matches partial words', () => {
    const result = filterTagsBySearch(tags, 'air');
    expect(result.length).toBe(1);
    expect(result[0][0]).toBe('Dairy');
  });
});

// --- isDirtyState ---

describe('isDirtyState', () => {
  it('returns false when both sets are empty', () => {
    expect(isDirtyState(new Set(), new Set())).toBe(false);
  });

  it('returns false when sets are identical', () => {
    expect(isDirtyState(new Set(['a', 'b']), new Set(['a', 'b']))).toBe(false);
  });

  it('returns true when draft has extra tags', () => {
    expect(isDirtyState(new Set(['a']), new Set(['a', 'b']))).toBe(true);
  });

  it('returns true when draft has fewer tags', () => {
    expect(isDirtyState(new Set(['a', 'b']), new Set(['a']))).toBe(true);
  });

  it('returns true when tags are completely different', () => {
    expect(isDirtyState(new Set(['a']), new Set(['b']))).toBe(true);
  });

  it('returns true when applied is empty but draft has tags', () => {
    expect(isDirtyState(new Set(), new Set(['a']))).toBe(true);
  });

  it('returns true when draft is empty but applied has tags', () => {
    expect(isDirtyState(new Set(['a']), new Set())).toBe(true);
  });
});

// --- sanitizeFilename ---

describe('sanitizeFilename', () => {
  it('joins brand and product with dash', () => {
    expect(sanitizeFilename('Kraft', 'Cheese')).toBe('Kraft - Cheese.txt');
  });

  it('removes special characters', () => {
    expect(sanitizeFilename('Ben & Jerry\'s', 'Ice Cream!')).toBe('Ben  Jerrys - Ice Cream.txt');
  });

  it('keeps numbers and hyphens', () => {
    expect(sanitizeFilename('Brand-1', 'Product-2')).toBe('Brand-1 - Product-2.txt');
  });

  it('keeps underscores', () => {
    expect(sanitizeFilename('my_brand', 'my_product')).toBe('my_brand - my_product.txt');
  });

  it('trims trailing spaces', () => {
    const result = sanitizeFilename('A@', 'B#');
    expect(result).not.toMatch(/\s\.txt$/);
  });

  it('ends with .txt', () => {
    expect(sanitizeFilename('X', 'Y')).toMatch(/\.txt$/);
  });
});

// --- formatLocationsText ---

describe('formatLocationsText', () => {
  it('returns "no locations" message for empty array', () => {
    const result = formatLocationsText([]);
    expect(result).toContain('No specific locations found');
  });

  it('returns "no locations" message for null', () => {
    const result = formatLocationsText(null);
    expect(result).toContain('No specific locations found');
  });

  it('formats single location', () => {
    const locs = [{ name: 'Walmart', address: '123 Main St', dist: '(2.1 mi)' }];
    const result = formatLocationsText(locs);
    expect(result).toContain('Eligible Locations Near You');
    expect(result).toContain('* Walmart - 123 Main St (2.1 mi)');
  });

  it('formats multiple locations', () => {
    const locs = [
      { name: 'Store A', address: 'Addr A', dist: '(1 mi)' },
      { name: 'Store B', address: 'Addr B', dist: '(3 mi)' },
    ];
    const result = formatLocationsText(locs);
    expect(result).toContain('* Store A');
    expect(result).toContain('* Store B');
  });

  it('starts with double newline', () => {
    const result = formatLocationsText([{ name: 'X', address: 'Y', dist: '' }]);
    expect(result.startsWith('\n\n')).toBe(true);
  });
});

// --- formatLocationSummary ---

describe('formatLocationSummary', () => {
  it('returns "No locations found" for empty array', () => {
    expect(formatLocationSummary([])).toBe('No locations found');
  });

  it('returns "No locations found" for null', () => {
    expect(formatLocationSummary(null)).toBe('No locations found');
  });

  it('formats single location as "name (address)"', () => {
    const result = formatLocationSummary([{ name: 'Walmart', address: '123 Main' }]);
    expect(result).toBe('Walmart (123 Main)');
  });

  it('joins multiple locations with semicolon', () => {
    const locs = [
      { name: 'A', address: 'Addr A' },
      { name: 'B', address: 'Addr B' },
    ];
    expect(formatLocationSummary(locs)).toBe('A (Addr A); B (Addr B)');
  });
});

// --- buildHistoryEntry ---

describe('buildHistoryEntry', () => {
  it('builds entry with all fields', () => {
    const entry = buildHistoryEntry(123, '1/1/2026', 'Kraft', 'Cheese', 'Free', 'Walmart');
    expect(entry).toEqual({
      id: 123,
      date: '1/1/2026',
      brand: 'Kraft',
      product: 'Cheese',
      offer: 'Free',
      locations: 'Walmart',
    });
  });

  it('defaults locations to "N/A" when empty', () => {
    const entry = buildHistoryEntry(1, 'now', 'B', 'P', 'O', '');
    expect(entry.locations).toBe('N/A');
  });

  it('defaults locations to "N/A" when null', () => {
    const entry = buildHistoryEntry(1, 'now', 'B', 'P', 'O', null);
    expect(entry.locations).toBe('N/A');
  });

  it('defaults locations to "N/A" when undefined', () => {
    const entry = buildHistoryEntry(1, 'now', 'B', 'P', 'O', undefined);
    expect(entry.locations).toBe('N/A');
  });

  it('preserves numeric id', () => {
    const entry = buildHistoryEntry(999, 'x', 'B', 'P', 'O', 'L');
    expect(entry.id).toBe(999);
  });
});

// --- shouldShowCard ---

describe('shouldShowCard', () => {
  it('hides AD cards regardless of filters', () => {
    expect(shouldShowCard('Free|Dairy', new Set(), true)).toBe(false);
  });

  it('shows all non-AD cards when no filters active', () => {
    expect(shouldShowCard('', new Set(), false)).toBe(true);
  });

  it('shows card when it matches an active filter', () => {
    expect(shouldShowCard('Free|Dairy', new Set(['Dairy']), false)).toBe(true);
  });

  it('hides card when it does not match any active filter', () => {
    expect(shouldShowCard('Meat|Snacks', new Set(['Dairy']), false)).toBe(false);
  });

  it('handles empty tag string with active filters', () => {
    expect(shouldShowCard('', new Set(['Free']), false)).toBe(false);
  });

  it('handles null tag string with no filters', () => {
    expect(shouldShowCard(null, new Set(), false)).toBe(true);
  });

  it('matches any one of multiple active filters', () => {
    expect(shouldShowCard('Snacks|Chips', new Set(['Dairy', 'Chips', 'Frozen']), false)).toBe(true);
  });

  it('hides AD card even when tags match filters', () => {
    expect(shouldShowCard('Free', new Set(['Free']), true)).toBe(false);
  });
});
