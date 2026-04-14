/**
 * Pure, testable logic extracted from script.js
 * Aisle Offer Filter — address history, CSV export, tag filtering, URL matching
 */

// --- Configuration Constants ---
export const CARD_SELECTOR = '.snap-center';
export const TAG_SELECTOR = 'div.text-xs.capitalize.leading-snug.text-brand-500.bg-\\[\\#F4F4FF\\].rounded-lg.p-1\\.5.mt-2';
export const AD_BADGE_SELECTOR = 'span.text-white.text-xs.font-semibold';
export const CARD_TITLE_SELECTORS = ['h5', 'h3', 'h4', '.font-bold.text-slate-900'];

export const CLAIM_PAGE_CHECKBOX_SELECTOR = '#aisle-opted';
export const CLAIM_SUBMIT_SELECTOR = 'button.bg-brand-500';

export const INFO_BRAND_SELECTOR = 'h4';
export const INFO_PRODUCT_SELECTOR = 'h3';
export const INFO_OFFER_SELECTOR = 'div.text-base.mt-2.bg-\\[\\#F4F4FE\\]';

export const STORAGE_KEY_PRESETS = 'aisle_filter_presets';
export const STORAGE_KEY_ACTIVE = 'aisle_active_filters';
export const STORAGE_KEY_CLAIM_MODE = 'aisle_claim_mode';
export const STORAGE_KEY_PROCESSED = 'aisle_processed_titles';
export const STORAGE_KEY_HISTORY = 'aisle_claim_history_log';

// --- URL Matching ---

/**
 * Returns true if the URL is an individual offer detail page (e.g. /offers/abc123)
 */
export function isDetailPage(url) {
  return /\/offers\/[a-zA-Z0-9]+$/.test(url);
}

// --- CSV Export ---

/**
 * Escape a value for safe inclusion in a CSV field.
 * Wraps in double quotes and escapes internal double quotes.
 */
export function escapeCSV(text) {
  return `"${String(text || '').replace(/"/g, '""')}"`;
}

/**
 * Build a complete CSV string from a history array.
 * Returns the CSV content (without the data URI prefix).
 */
export function buildCSV(history) {
  let csv = 'Date,Brand,Product,Offer,Locations\n';
  history.forEach(row => {
    csv += `${escapeCSV(row.date)},${escapeCSV(row.brand)},${escapeCSV(row.product)},${escapeCSV(row.offer)},${escapeCSV(row.locations)}\n`;
  });
  return csv;
}

// --- Tag Filtering ---

/**
 * Returns true if a tag name qualifies for the "Quick Free" filter.
 * Must contain "free" but not "buy" or "earn".
 */
export function isQuickFreeTag(tagName) {
  const lower = tagName.toLowerCase();
  return lower.includes('free') && !lower.includes('buy') && !lower.includes('earn');
}

/**
 * Sort tag entries (array of [name, count]) with selected tags first,
 * then by count descending, then alphabetically.
 * @param {Array<[string, number]>} entries - tag entries
 * @param {Set<string>} selectedTags - currently selected tags
 * @returns {Array<[string, number]>}
 */
export function sortTags(entries, selectedTags) {
  return [...entries].sort((a, b) => {
    const aName = a[0], bName = b[0];
    const aSel = selectedTags.has(aName);
    const bSel = selectedTags.has(bName);
    if (aSel && !bSel) return -1;
    if (!aSel && bSel) return 1;
    if (b[1] !== a[1]) return b[1] - a[1];
    return aName.localeCompare(bName);
  });
}

/**
 * Filter tag entries by search term (case-insensitive substring match).
 * @param {Array<[string, number]>} entries
 * @param {string} searchTerm
 * @returns {Array<[string, number]>}
 */
export function filterTagsBySearch(entries, searchTerm) {
  if (!searchTerm) return entries;
  const lower = searchTerm.toLowerCase();
  return entries.filter(([name]) => name.toLowerCase().includes(lower));
}

// --- Dirty State ---

/**
 * Returns true if the draft tags differ from applied tags.
 * @param {Set<string>} appliedTags
 * @param {Set<string>} draftTags
 * @returns {boolean}
 */
export function isDirtyState(appliedTags, draftTags) {
  if (appliedTags.size !== draftTags.size) return true;
  for (const tag of draftTags) {
    if (!appliedTags.has(tag)) return true;
  }
  return false;
}

// --- Filename & Content ---

/**
 * Sanitize brand + product into a safe filename (no special chars).
 */
export function sanitizeFilename(brand, product) {
  return `${brand} - ${product}`.replace(/[^a-z0-9 \-_]/gi, '').trim() + '.txt';
}

/**
 * Build the text content for a claim log file.
 */
export function buildClaimContent(brand, product, offer, url, locationsText) {
  return `Brand: ${brand}\nProduct: ${product}\nOffer Details: ${offer}\nClaim Date: ${new Date().toLocaleString()}\nURL: ${url}${locationsText}`;
}

// --- Location Formatting ---

/**
 * Format location data into a multi-line text block for file export.
 * @param {Array<{name: string, address: string, dist: string}>} locationData
 * @returns {string}
 */
export function formatLocationsText(locationData) {
  if (!locationData || locationData.length === 0) {
    return '\n\nEligible Locations Near You:\nNo specific locations found (or parsed).';
  }
  let text = '\n\nEligible Locations Near You:\n';
  locationData.forEach(loc => {
    text += `* ${loc.name} - ${loc.address} ${loc.dist}\n`;
  });
  return text;
}

/**
 * Format location data into a semicolon-separated summary for the history table.
 * @param {Array<{name: string, address: string, dist: string}>} locationData
 * @returns {string}
 */
export function formatLocationSummary(locationData) {
  if (!locationData || locationData.length === 0) {
    return 'No locations found';
  }
  return locationData.map(l => `${l.name} (${l.address})`).join('; ');
}

// --- History ---

/**
 * Build a history entry object. Caller provides the ID and date.
 * @param {number} id
 * @param {string} dateStr
 * @param {string} brand
 * @param {string} product
 * @param {string} offer
 * @param {string} locations
 * @returns {{id: number, date: string, brand: string, product: string, offer: string, locations: string}}
 */
export function buildHistoryEntry(id, dateStr, brand, product, offer, locations) {
  return {
    id,
    date: dateStr,
    brand: brand,
    product: product,
    offer: offer,
    locations: locations || 'N/A',
  };
}

// --- Card Filtering ---

/**
 * Determine if a card should be visible given the applied tag filters.
 * @param {string} cardTagsString - pipe-delimited tag string from card.dataset.aisleTags
 * @param {Set<string>} appliedTags - currently active filters
 * @param {boolean} isAd - whether the card has an AD badge
 * @returns {boolean} true if the card should be visible
 */
export function shouldShowCard(cardTagsString, appliedTags, isAd) {
  if (isAd) return false;
  if (appliedTags.size === 0) return true;
  const cardTags = (cardTagsString || '').split('|');
  return Array.from(appliedTags).some(tag => cardTags.includes(tag));
}
