// ==UserScript==
// @name         Aisle Offer Filter (Address in History v16.6)
// @namespace    http://tampermonkey.net/
// @version      16.6
// @description  Filter Aisle offers, Auto Claim, Wide History Table with full addresses.
// @author       Gemini
// @match        https://discover.gotoaisle.com/offers
// @match        https://discover.gotoaisle.com/offers/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=gotoaisle.com
// @grant        GM_addStyle
// @run-at       document-idle
// ==/UserScript==

(function() {
    'use strict';

    // --- Configuration ---
    const CARD_SELECTOR = '.snap-center';
    const TAG_SELECTOR = 'div.text-xs.capitalize.leading-snug.text-brand-500.bg-\\[\\#F4F4FF\\].rounded-lg.p-1\\.5.mt-2';
    const AD_BADGE_SELECTOR = 'span.text-white.text-xs.font-semibold';
    const CARD_TITLE_SELECTORS = ['h5', 'h3', 'h4', '.font-bold.text-slate-900'];

    // Auto Claim Selectors
    const CLAIM_PAGE_CHECKBOX_SELECTOR = '#aisle-opted';

    // Detail Page Info
    const INFO_BRAND_SELECTOR = 'h4';
    const INFO_PRODUCT_SELECTOR = 'h3';
    const INFO_OFFER_SELECTOR = 'div.text-base.mt-2.bg-\\[\\#F4F4FE\\]';

    // Storage Keys
    const STORAGE_KEY_PRESETS = 'aisle_filter_presets';
    const STORAGE_KEY_ACTIVE = 'aisle_active_filters';
    const STORAGE_KEY_CLAIM_MODE = 'aisle_claim_mode';
    const STORAGE_KEY_PROCESSED = 'aisle_processed_titles';
    const STORAGE_KEY_HISTORY = 'aisle_claim_history_log';

    // --- State ---
    let appliedTags = new Set();
    let draftTags = new Set();
    let tagCounts = new Map();
    let isOverlayOpen = false;
    let isHistoryOpen = false;
    let currentUrl = window.location.href;
    let debounceTimer = null;

    // --- Styles ---
    GM_addStyle(`
        /* Main Filter Button */
        #aisle-tag-filter-btn {
            position: fixed; bottom: 20px; right: 20px; z-index: 10000;
            background-color: #2563eb; color: white; border: none; border-radius: 50px;
            padding: 12px 24px; font-size: 16px; font-weight: bold;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3); cursor: pointer; transition: transform 0.2s;
            font-family: sans-serif;
        }
        #aisle-tag-filter-btn:hover { background-color: #1d4ed8; transform: scale(1.05); }
        #aisle-tag-filter-btn.active { background-color: #ea580c; }
        #aisle-tag-filter-btn.active:hover { background-color: #c2410c; }

        /* Floating Action Buttons */
        .aisle-float-btn {
            position: fixed; right: 20px; z-index: 10000;
            color: white; border: none; border-radius: 50px;
            padding: 8px 20px; font-size: 13px; font-weight: bold;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3); cursor: pointer;
            transition: transform 0.2s; font-family: sans-serif;
            display: flex; align-items: center; justify-content: center; width: 220px;
        }
        .aisle-float-btn:hover { transform: scale(1.05); }

        #aisle-claim-single { bottom: 80px; background-color: #059669; }
        #aisle-claim-single:hover { background-color: #047857; }

        #aisle-claim-batch { bottom: 125px; background-color: #7c3aed; }
        #aisle-claim-batch:hover { background-color: #6d28d9; }

        #aisle-view-history { bottom: 170px; background-color: #9333ea; }
        #aisle-view-history:hover { background-color: #7e22ce; }

        /* Overlay Styles */
        .aisle-overlay {
            position: fixed; top: 0; left: 0; width: 100%; height: 100%;
            background: rgba(255, 255, 255, 0.98); z-index: 10001;
            display: none; flex-direction: column; padding: 20px; box-sizing: border-box;
            font-family: sans-serif;
            align-items: center;
        }
        .aisle-overlay.open { display: flex; }

        .aisle-overlay-header {
            display: flex; justify-content: space-between; align-items: center;
            margin-bottom: 10px; padding-bottom: 10px; border-bottom: 1px solid #e5e7eb;
            flex-shrink: 0; width: 95%;
        }
        .aisle-overlay-title { font-size: 24px; font-weight: bold; color: #1f2937; }
        .aisle-close-btn { background: none; border: none; font-size: 32px; cursor: pointer; color: #6b7280; line-height: 1; }

        .aisle-presets-area { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 15px; padding-bottom: 10px; border-bottom: 1px dashed #e5e7eb; align-items: center; width: 95%; }
        .aisle-preset-chip { background: #e0e7ff; color: #3730a3; padding: 4px 10px; border-radius: 12px; font-size: 12px; font-weight: 600; cursor: pointer; border: 1px solid transparent; display: flex; align-items: center; gap: 5px; }
        .aisle-preset-chip:hover { border-color: #4338ca; }
        .aisle-preset-delete { font-size: 14px; color: #3730a3; cursor: pointer; opacity: 0.5; }
        .aisle-preset-delete:hover { opacity: 1; color: red; }

        .aisle-controls { margin-bottom: 15px; display: flex; gap: 10px; align-items: center; flex-shrink: 0; flex-wrap: wrap; width: 95%; }
        .aisle-search-input { flex-grow: 1; padding: 10px 15px; border-radius: 8px; border: 1px solid #d1d5db; font-size: 16px; outline: none; min-width: 200px; }
        .aisle-control-btn { padding: 10px 16px; border-radius: 8px; border: 1px solid #d1d5db; background: white; cursor: pointer; font-size: 14px; font-weight: 600; white-space: nowrap; color: #374151; transition: all 0.2s; }
        .aisle-control-btn:hover { background: #f9fafb; }

        #aisle-apply-btn { background-color: #e5e7eb; color: #9ca3af; border-color: #d1d5db; cursor: not-allowed; }
        #aisle-apply-btn.dirty { background-color: #16a34a; color: white; border-color: #15803d; cursor: pointer; box-shadow: 0 2px 5px rgba(22, 163, 74, 0.3); }
        #aisle-apply-btn.dirty:hover { background-color: #15803d; }

        .aisle-tags-container { display: flex; flex-wrap: wrap; gap: 8px; padding-bottom: 40px; overflow-y: auto; flex-grow: 1; width: 95%; }
        .aisle-tag { padding: 6px 14px; background-color: #f3f4f6; border: 1px solid #d1d5db; border-radius: 20px; cursor: pointer; font-size: 13px; user-select: none; color: #374151; display: flex; align-items: center; gap: 6px; }
        .aisle-tag:hover { background-color: #e5e7eb; border-color: #9ca3af; }
        .aisle-tag.selected { background-color: #2563eb; color: white; border-color: #2563eb; }
        .aisle-tag-count { font-size: 11px; opacity: 0.7; background: rgba(0,0,0,0.1); padding: 1px 6px; border-radius: 10px; }

        /* History Table Styles - WIDE MODE */
        .aisle-history-table-container {
            overflow-y: auto;
            flex-grow: 1;
            border: 1px solid #e5e7eb;
            border-radius: 8px;
            max-height: 80vh;
            width: 95%;
        }
        #aisle-history-table {
            width: 100%;
            border-collapse: collapse;
        }
        #aisle-history-table th { background: #f9fafb; position: sticky; top: 0; text-align: left; padding: 12px; font-size: 14px; color: #374151; border-bottom: 2px solid #e5e7eb; z-index: 10; }
        #aisle-history-table td { padding: 10px 12px; border-bottom: 1px solid #e5e7eb; font-size: 14px; color: #1f2937; vertical-align: top; }
        #aisle-history-table tr:nth-child(even) { background-color: #fcfcfc; }
        #aisle-history-table tr:hover { background-color: #f3f4f6; }

        /* Column Widths */
        #aisle-history-table th:nth-child(1) { width: 140px; min-width: 140px; } /* Date */
        #aisle-history-table th:nth-child(2) { width: 15%; min-width: 100px; }   /* Brand */
        #aisle-history-table th:nth-child(3) { width: 15%; min-width: 100px; }   /* Product */
        #aisle-history-table th:nth-child(4) { width: 15%; min-width: 100px; }   /* Offer */

        .aisle-empty-history { padding: 40px; text-align: center; color: #6b7280; font-size: 16px; }

        .aisle-loc-cell {
            font-size: 11px;
            color: #555;
            white-space: normal; /* WRAP TEXT */
            word-break: break-word;
            line-height: 1.4;
        }

        .aisle-hidden-offer { display: none !important; }
    `);

    // --- MAIN LOOP ---

    setInterval(() => {
        const newUrl = window.location.href;
        if (newUrl !== currentUrl) {
            currentUrl = newUrl;
            if (!newUrl.match(/\/offers\/[a-zA-Z0-9]+$/)) {
                createButtons();
                updateFilterButtonState();
                if (sessionStorage.getItem(STORAGE_KEY_CLAIM_MODE) === 'BATCH') {
                    console.log("Aisle: Returning to list in Batch Mode. waiting...");
                    setTimeout(triggerNextClaim, 2000);
                }
            }
        }
        if (newUrl.match(/\/offers\/[a-zA-Z0-9]+$/)) {
            runAutoClaimPageLogic();
        } else {
            runListLogic();
        }
    }, 500);

    // --- History Persistence Logic ---

    function getHistory() {
        const stored = localStorage.getItem(STORAGE_KEY_HISTORY);
        return stored ? JSON.parse(stored) : [];
    }

    function logClaimToHistory(brand, product, offer, locations) {
        const history = getHistory();
        const entry = {
            id: Date.now(),
            date: new Date().toLocaleString(),
            brand: brand,
            product: product,
            offer: offer,
            locations: locations || "N/A"
        };
        history.unshift(entry);
        localStorage.setItem(STORAGE_KEY_HISTORY, JSON.stringify(history));
    }

    function clearHistory() {
        if(confirm("Are you sure you want to clear your claim history?")) {
            localStorage.removeItem(STORAGE_KEY_HISTORY);
            renderHistoryTable();
        }
    }

    function exportHistoryToCSV() {
        const history = getHistory();
        if(history.length === 0) { alert("No history to export."); return; }
        let csvContent = "data:text/csv;charset=utf-8,";
        csvContent += "Date,Brand,Product,Offer,Locations\n";
        history.forEach(row => {
            const escape = (t) => `"${String(t || '').replace(/"/g, '""')}"`;
            csvContent += `${escape(row.date)},${escape(row.brand)},${escape(row.product)},${escape(row.offer)},${escape(row.locations)}\n`;
        });
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", "aisle_claim_history.csv");
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    // --- Logic: Individual Offer Page (Auto Claim + Download) ---

    function runAutoClaimPageLogic() {
        const claimMode = sessionStorage.getItem(STORAGE_KEY_CLAIM_MODE);
        if (!claimMode) return;

        const checkbox = document.querySelector(CLAIM_PAGE_CHECKBOX_SELECTOR);
        const buttons = Array.from(document.querySelectorAll('button'));
        const claimBtn = buttons.find(b => b.textContent.includes('Claim Offer'));
        const submittedBtn = buttons.find(b => b.textContent.includes('Submitted'));

        if (submittedBtn) {
            console.log("Aisle: Offer already submitted.");
            finishPageAction();
            return;
        }

        if (checkbox && claimBtn) {
            if (checkbox.getAttribute('aria-checked') === 'false') {
                checkbox.click();
            } else if (!claimBtn.disabled) {
                // Info Scraping
                let brand = "Unknown", product = "Unknown", offer = "Unknown";
                let locationsText = ""; // For File
                let locationsSummary = ""; // For History Table

                try {
                    brand = document.querySelector(INFO_BRAND_SELECTOR)?.innerText || "Unknown Brand";
                    product = document.querySelector(INFO_PRODUCT_SELECTOR)?.innerText || "Unknown Product";
                    offer = document.querySelector(INFO_OFFER_SELECTOR)?.innerText || "Unknown Offer";

                    // --- 1. Scrape Locations (Robust) ---
                    const locationData = scrapeLocations();

                    if (locationData.length > 0) {
                        locationsText = "\n\nEligible Locations Near You:\n";
                        locationData.forEach(loc => {
                            locationsText += `* ${loc.name} - ${loc.address} ${loc.dist}\n`;
                        });

                        // --- INCLUDE ADDRESS IN SUMMARY ---
                        locationsSummary = locationData.map(l => `${l.name} (${l.address})`).join('; ');

                    } else {
                        locationsText = "\n\nEligible Locations Near You:\nNo specific locations found (or parsed).";
                        locationsSummary = "No locations found";
                    }

                    // --- 2. Save to History Table (Now with locations) ---
                    logClaimToHistory(brand, product, offer, locationsSummary);

                    // --- 3. Download Text Log ---
                    const content = `Brand: ${brand}\nProduct: ${product}\nOffer Details: ${offer}\nClaim Date: ${new Date().toLocaleString()}\nURL: ${window.location.href}${locationsText}`;
                    const safeFilename = `${brand} - ${product}`.replace(/[^a-z0-9 \-_]/gi, '').trim() + ".txt";

                    downloadFile(safeFilename, content);
                } catch (e) { console.error("Log error", e); }

                claimBtn.click();
            }
        }
    }

    function scrapeLocations() {
        const results = [];
        try {
            // Strategy 1: Find header
            const allHeaders = Array.from(document.querySelectorAll('h3, h4, h5, h6, div, span'));
            const header = allHeaders.find(el =>
                el.textContent && el.textContent.toLowerCase().includes('eligible locations')
            );

            let container = null;

            if (header) {
                const parentSection = header.closest('section') || header.parentElement;
                if (parentSection) {
                    container = parentSection.querySelector('.overflow-x-scroll');
                }
            }

            // Strategy 2: Fallback global search for ANY scroll container with h3/p inside
            if (!container) {
                const allScrolls = document.querySelectorAll('.overflow-x-scroll');
                for (const box of allScrolls) {
                    // Quick check for store-like content
                    if (box.querySelector('h3') && box.querySelector('p')) {
                        container = box;
                        break;
                    }
                }
            }

            if (container) {
                const cards = Array.from(container.children);
                cards.forEach(card => {
                    const nameEl = card.querySelector('h3');
                    const addressEl = card.querySelector('p');
                    const distEl = card.querySelector('span');

                    if (nameEl && addressEl) {
                        const name = nameEl.innerText.trim();
                        const address = addressEl.innerText.trim();
                        const dist = distEl ? `(${distEl.innerText.trim()})` : '';
                        if (name) {
                            results.push({ name, address, dist });
                        }
                    }
                });
            }
        } catch (e) { console.error("Loc Scrape Error", e); }
        return results;
    }

    function downloadFile(filename, text) {
        const element = document.createElement('a');
        element.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(text));
        element.setAttribute('download', filename);
        element.style.display = 'none';
        document.body.appendChild(element);
        element.click();
        document.body.removeChild(element);
    }

    function finishPageAction() {
        const mode = sessionStorage.getItem(STORAGE_KEY_CLAIM_MODE);
        if (mode === 'SINGLE') {
            sessionStorage.removeItem(STORAGE_KEY_CLAIM_MODE);
        }

        const backSvg = document.querySelector('.lucide-chevron-left');
        const backBtn = backSvg ? backSvg.closest('button') : null;
        if (backBtn) backBtn.click();
        else window.history.back();
    }

    // --- Logic: Offer List Page ---

    function runListLogic() {
        if (!window.aisleFiltersLoaded) {
            loadPersistedFilters();
            window.aisleFiltersLoaded = true;
        }
        createButtons();
        createOverlays();
        scanTags();
        applyFilters();
    }

    function scanTags() {
        tagCounts.clear();
        const tagElements = document.querySelectorAll(TAG_SELECTOR);

        tagElements.forEach(el => {
            const card = el.closest(CARD_SELECTOR);
            if (card) {
                const adBadge = card.querySelector(AD_BADGE_SELECTOR);
                if (adBadge && adBadge.textContent.trim() === "AD") return;
            }

            const rawText = el.textContent.trim();
            if (!rawText) return;
            const currentCount = tagCounts.get(rawText) || 0;
            tagCounts.set(rawText, currentCount + 1);

            if (card) {
                let currentCardTags = card.dataset.aisleTags ? card.dataset.aisleTags.split('|') : [];
                if (!currentCardTags.includes(rawText)) {
                    currentCardTags.push(rawText);
                    card.dataset.aisleTags = currentCardTags.join('|');
                }
            }
        });

        if(isOverlayOpen && document.getElementById('aisle-tags-list').children.length === 0) {
             renderTagsInOverlay(document.getElementById('aisle-tag-search')?.value || '');
        }
    }

    function applyFilters() {
        const cards = document.querySelectorAll(CARD_SELECTOR);
        cards.forEach(card => {
            const adBadge = card.querySelector(AD_BADGE_SELECTOR);
            if (adBadge && adBadge.textContent.trim() === "AD") {
                card.classList.add('aisle-hidden-offer');
                return;
            }

            if (appliedTags.size > 0) {
                const cardTags = (card.dataset.aisleTags || "").split('|');
                const match = Array.from(appliedTags).some(tag => cardTags.includes(tag));
                if (!match) {
                    card.classList.add('aisle-hidden-offer');
                    return;
                }
            }
            card.classList.remove('aisle-hidden-offer');
        });
        updateFilterButtonState();
    }

    function updateFilterButtonState() {
        const btn = document.getElementById('aisle-tag-filter-btn');
        if (!btn) return;
        if (appliedTags.size > 0) {
            btn.classList.add('active');
            btn.innerText = `Filter Tags (Filtered: ${appliedTags.size})`;
        } else {
            btn.classList.remove('active');
            btn.innerText = 'Filter Tags';
        }
    }

    // --- Helpers ---

    function getProcessedTitles() {
        const stored = sessionStorage.getItem(STORAGE_KEY_PROCESSED);
        return stored ? JSON.parse(stored) : [];
    }

    function addProcessedTitle(title) {
        const list = getProcessedTitles();
        if (!list.includes(title)) {
            list.push(title);
            sessionStorage.setItem(STORAGE_KEY_PROCESSED, JSON.stringify(list));
        }
    }

    function loadPersistedFilters() {
        const stored = localStorage.getItem(STORAGE_KEY_ACTIVE);
        if (stored) {
            try {
                const tags = JSON.parse(stored);
                if (Array.isArray(tags)) {
                    appliedTags = new Set(tags);
                    draftTags = new Set(tags);
                }
            } catch (e) { console.error("Aisle Filter: Error loading persistence", e); }
        }
    }

    function saveActiveFilters() {
        localStorage.setItem(STORAGE_KEY_ACTIVE, JSON.stringify(Array.from(appliedTags)));
    }

    // --- Auto Claim Triggers ---

    function triggerNextClaim() {
        const headers = Array.from(document.querySelectorAll('h3'));
        const allOffersHeader = headers.find(h => h.textContent.trim() === "All Offers");

        if (!allOffersHeader) { console.log("Aisle: 'All Offers' header not found."); return; }

        const allCards = Array.from(document.querySelectorAll(CARD_SELECTOR));
        const processed = getProcessedTitles();

        const eligibleCards = allCards.filter(card => {
            const position = allOffersHeader.compareDocumentPosition(card);
            const isAfterHeader = position & Node.DOCUMENT_POSITION_FOLLOWING;
            const isVisible = !card.classList.contains('aisle-hidden-offer');

            let title = "";
            for (let selector of CARD_TITLE_SELECTORS) {
                const el = card.querySelector(selector);
                if (el) { title = el.textContent.trim(); break; }
            }

            return isAfterHeader && isVisible && title && !processed.includes(title);
        });

        if (eligibleCards.length === 0) {
            console.log("Aisle: No eligible offers found.");
            if (sessionStorage.getItem(STORAGE_KEY_CLAIM_MODE) === 'BATCH') {
                sessionStorage.removeItem(STORAGE_KEY_CLAIM_MODE);
                alert("Batch Claim Complete.");
            }
            return;
        }

        const nextCard = eligibleCards[0];
        let nextTitle = "Unknown";
        for (let selector of CARD_TITLE_SELECTORS) {
            const el = nextCard.querySelector(selector);
            if (el) { nextTitle = el.textContent.trim(); break; }
        }

        const clickTarget = nextCard.querySelector('img');

        if (clickTarget) {
            console.log(`Aisle: Clicking ${nextTitle}...`);
            addProcessedTitle(nextTitle);
            nextCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
            setTimeout(() => { clickTarget.click(); }, 500);
        }
    }

    function startClaim(mode) {
        sessionStorage.setItem(STORAGE_KEY_CLAIM_MODE, mode);
        triggerNextClaim();
    }

    // --- UI Construction ---

    function createButtons() {
        if (!document.getElementById('aisle-tag-filter-btn')) {
            const btn = document.createElement('button');
            btn.id = 'aisle-tag-filter-btn';
            btn.innerText = 'Filter Tags';
            btn.addEventListener('click', toggleFilterOverlay);
            document.body.appendChild(btn);
        }

        if (!document.getElementById('aisle-claim-single')) {
            const btn = document.createElement('button');
            btn.id = 'aisle-claim-single';
            btn.className = 'aisle-float-btn';
            btn.innerHTML = '🤖 Auto Claim First';
            btn.addEventListener('click', () => startClaim('SINGLE'));
            document.body.appendChild(btn);
        }

        if (!document.getElementById('aisle-claim-batch')) {
            const btn = document.createElement('button');
            btn.id = 'aisle-claim-batch';
            btn.className = 'aisle-float-btn';
            btn.innerHTML = '∞ Auto Claim All Filtered';
            btn.addEventListener('click', () => {
                if (sessionStorage.getItem(STORAGE_KEY_CLAIM_MODE) === 'BATCH') {
                    sessionStorage.removeItem(STORAGE_KEY_CLAIM_MODE);
                    alert("Batch Claim Stopped.");
                } else {
                    startClaim('BATCH');
                }
            });
            document.body.appendChild(btn);
        }

        if (!document.getElementById('aisle-view-history')) {
            const btn = document.createElement('button');
            btn.id = 'aisle-view-history';
            btn.className = 'aisle-float-btn';
            btn.innerHTML = '📜 Claimed Offers';
            btn.addEventListener('click', toggleHistoryOverlay);
            document.body.appendChild(btn);
        }
    }

    function createOverlays() {
        // --- Filter Overlay ---
        if (!document.getElementById('aisle-filter-overlay')) {
            const overlay = document.createElement('div');
            overlay.id = 'aisle-filter-overlay';
            overlay.className = 'aisle-overlay';
            overlay.innerHTML = `
                <div class="aisle-overlay-header">
                    <span class="aisle-overlay-title">Filter Offers</span>
                    <button class="aisle-close-btn">&times;</button>
                </div>
                <div class="aisle-presets-area" id="aisle-presets-list"></div>
                <div class="aisle-controls">
                    <input type="text" id="aisle-tag-search" class="aisle-search-input" placeholder="Search filters..." autocomplete="off">
                    <button id="aisle-quick-free" class="aisle-control-btn">⚡ Quick Free</button>
                    <button id="aisle-clear-filters" class="aisle-control-btn">Clear All</button>
                    <button id="aisle-save-preset" class="aisle-control-btn" style="color:#2563eb;">💾 Save Set</button>
                    <button id="aisle-apply-btn" class="aisle-control-btn">Set</button>
                </div>
                <div class="aisle-tags-container" id="aisle-tags-list"></div>
            `;
            document.body.appendChild(overlay);

            // Filter Overlay Events
            overlay.querySelector('.aisle-close-btn').addEventListener('click', toggleFilterOverlay);
            overlay.querySelector('#aisle-tag-search').addEventListener('input', (e) => renderTagsInOverlay(e.target.value));
            overlay.querySelector('#aisle-clear-filters').addEventListener('click', () => {
                draftTags.clear();
                document.getElementById('aisle-tag-search').value = '';
                renderTagsInOverlay();
                checkDirtyState();
            });
            overlay.querySelector('#aisle-quick-free').addEventListener('click', () => {
                draftTags.clear();
                for (const [tagName] of tagCounts) {
                    const lower = tagName.toLowerCase();
                    if (lower.includes('free') && !lower.includes('buy') && !lower.includes('earn')) {
                        draftTags.add(tagName);
                    }
                }
                document.getElementById('aisle-tag-search').value = '';
                renderTagsInOverlay();
                checkDirtyState();
            });
            overlay.querySelector('#aisle-save-preset').addEventListener('click', savePreset);
            overlay.querySelector('#aisle-apply-btn').addEventListener('click', () => {
                appliedTags = new Set(draftTags);
                saveActiveFilters();
                applyFilters();
                toggleFilterOverlay();
            });
        }

        // --- History Overlay ---
        if (!document.getElementById('aisle-history-overlay')) {
            const hOverlay = document.createElement('div');
            hOverlay.id = 'aisle-history-overlay';
            hOverlay.className = 'aisle-overlay';
            hOverlay.innerHTML = `
                <div class="aisle-overlay-header">
                    <span class="aisle-overlay-title">Claim History</span>
                    <button class="aisle-close-btn">&times;</button>
                </div>
                <div class="aisle-controls">
                    <button id="aisle-export-csv" class="aisle-control-btn">Export CSV</button>
                    <button id="aisle-clear-history" class="aisle-control-btn" style="color:red;">Clear History</button>
                </div>
                <div class="aisle-history-table-container">
                    <table id="aisle-history-table">
                        <thead>
                            <tr>
                                <th>Date</th>
                                <th>Brand</th>
                                <th>Product</th>
                                <th>Offer</th>
                                <th>Locations</th>
                            </tr>
                        </thead>
                        <tbody id="aisle-history-tbody"></tbody>
                    </table>
                </div>
            `;
            document.body.appendChild(hOverlay);

            // History Overlay Events
            hOverlay.querySelector('.aisle-close-btn').addEventListener('click', toggleHistoryOverlay);
            hOverlay.querySelector('#aisle-export-csv').addEventListener('click', exportHistoryToCSV);
            hOverlay.querySelector('#aisle-clear-history').addEventListener('click', clearHistory);
        }
    }

    // --- Overlay Toggles ---

    function toggleFilterOverlay() {
        const overlay = document.getElementById('aisle-filter-overlay');
        if (!overlay) return;
        isOverlayOpen = !isOverlayOpen;
        if (isOverlayOpen) {
            draftTags = new Set(appliedTags);
            scanTags();
            renderPresets();
            renderTagsInOverlay();
            checkDirtyState();
            overlay.classList.add('open');
            document.body.style.overflow = 'hidden';
        } else {
            overlay.classList.remove('open');
            document.body.style.overflow = '';
        }
    }

    function toggleHistoryOverlay() {
        const overlay = document.getElementById('aisle-history-overlay');
        if (!overlay) return;
        isHistoryOpen = !isHistoryOpen;
        if (isHistoryOpen) {
            renderHistoryTable();
            overlay.classList.add('open');
            document.body.style.overflow = 'hidden';
        } else {
            overlay.classList.remove('open');
            document.body.style.overflow = '';
        }
    }

    function renderHistoryTable() {
        const tbody = document.getElementById('aisle-history-tbody');
        if(!tbody) return;
        tbody.innerHTML = '';
        const history = getHistory();

        if (history.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" class="aisle-empty-history">No claims recorded yet.</td></tr>';
            return;
        }

        history.forEach(item => {
            const tr = document.createElement('tr');
            const locs = item.locations || "N/A";

            const tdDate = document.createElement('td');
            tdDate.textContent = item.date;

            const tdBrand = document.createElement('td');
            const brandStrong = document.createElement('strong');
            brandStrong.textContent = item.brand;
            tdBrand.appendChild(brandStrong);

            const tdProduct = document.createElement('td');
            tdProduct.textContent = item.product;

            const tdOffer = document.createElement('td');
            const offerSpan = document.createElement('span');
            offerSpan.textContent = item.offer;
            offerSpan.style.cssText = 'background:#F4F4FE; color:#4C48FF; padding:2px 6px; border-radius:4px; font-size:12px; font-weight:600;';
            tdOffer.appendChild(offerSpan);

            const tdLoc = document.createElement('td');
            tdLoc.className = 'aisle-loc-cell';
            tdLoc.textContent = locs;

            tr.appendChild(tdDate);
            tr.appendChild(tdBrand);
            tr.appendChild(tdProduct);
            tr.appendChild(tdOffer);
            tr.appendChild(tdLoc);
            tbody.appendChild(tr);
        });
    }

    // --- Filter Helpers (Presets, Tags, etc) ---

    function getPresets() {
        const stored = localStorage.getItem(STORAGE_KEY_PRESETS);
        return stored ? JSON.parse(stored) : {};
    }

    function savePreset() {
        if (draftTags.size === 0) { alert("Select filters first!"); return; }
        const name = prompt("Name this collection:");
        if (!name) return;
        const presets = getPresets();
        presets[name] = Array.from(draftTags);
        localStorage.setItem(STORAGE_KEY_PRESETS, JSON.stringify(presets));
        renderPresets();
    }

    function loadPreset(name) {
        const presets = getPresets();
        if (presets[name]) {
            draftTags = new Set(presets[name]);
            document.getElementById('aisle-tag-search').value = '';
            renderTagsInOverlay();
            checkDirtyState();
        }
    }

    function deletePreset(name) {
        if(confirm(`Delete "${name}"?`)) {
            const presets = getPresets();
            delete presets[name];
            localStorage.setItem(STORAGE_KEY_PRESETS, JSON.stringify(presets));
            renderPresets();
        }
    }

    function renderPresets() {
        const container = document.getElementById('aisle-presets-list');
        if (!container) return;
        container.innerHTML = '<span style="font-size:12px; color:#666; font-weight:bold;">Saved Sets:</span>';
        const presets = getPresets();
        const names = Object.keys(presets);
        if (names.length === 0) {
            container.innerHTML += '<span style="font-size:12px; color:#999; margin-left:5px;">None saved.</span>';
            return;
        }
        names.forEach(name => {
            const chip = document.createElement('div');
            chip.className = 'aisle-preset-chip';
            const label = document.createElement('span');
            label.innerText = name;
            label.onclick = () => loadPreset(name);
            const del = document.createElement('span');
            del.innerHTML = '&times;';
            del.className = 'aisle-preset-delete';
            del.onclick = (e) => { e.stopPropagation(); deletePreset(name); };
            chip.appendChild(label);
            chip.appendChild(del);
            container.appendChild(chip);
        });
    }

    function renderTagsInOverlay(searchTerm = '') {
        const container = document.getElementById('aisle-tags-list');
        if (!container) return;
        container.innerHTML = '';

        let tagsArray = Array.from(tagCounts.entries()).sort((a, b) => {
            const aName = a[0], bName = b[0];
            const aSel = draftTags.has(aName);
            const bSel = draftTags.has(bName);
            if (aSel && !bSel) return -1;
            if (!aSel && bSel) return 1;
            if (b[1] !== a[1]) return b[1] - a[1];
            return aName.localeCompare(bName);
        });

        if (searchTerm) {
            const lower = searchTerm.toLowerCase();
            tagsArray = tagsArray.filter(([name]) => name.toLowerCase().includes(lower));
        }

        if (tagsArray.length === 0) {
            container.innerHTML = '<p style="color:#666; width:100%; text-align:center; margin-top:20px;">No matching tags.</p>';
            return;
        }

        const frag = document.createDocumentFragment();
        tagsArray.forEach(([tagName, count]) => {
            const tagEl = document.createElement('div');
            tagEl.className = 'aisle-tag';
            if (draftTags.has(tagName)) tagEl.classList.add('selected');
            const tagLabel = document.createElement('span');
            tagLabel.textContent = tagName;
            const tagCount = document.createElement('span');
            tagCount.className = 'aisle-tag-count';
            tagCount.textContent = count;
            tagEl.appendChild(tagLabel);
            tagEl.appendChild(tagCount);
            tagEl.addEventListener('click', () => {
                if (draftTags.has(tagName)) draftTags.delete(tagName);
                else draftTags.add(tagName);
                tagEl.classList.toggle('selected');
                checkDirtyState();
            });
            frag.appendChild(tagEl);
        });
        container.appendChild(frag);
    }

    function checkDirtyState() {
        const btn = document.getElementById('aisle-apply-btn');
        if (!btn) return;
        let isDirty = false;
        if (appliedTags.size !== draftTags.size) isDirty = true;
        else {
            for (let tag of draftTags) {
                if (!appliedTags.has(tag)) { isDirty = true; break; }
            }
        }
        if (isDirty) {
            btn.classList.add('dirty');
            btn.innerText = `Set Filters (${draftTags.size})`;
        } else {
            btn.classList.remove('dirty');
            btn.innerText = "Set";
        }
    }

    // --- Init ---

    function init() {
        if (window.location.href.match(/\/offers\/[a-zA-Z0-9]+$/)) {
            runAutoClaimPageLogic();
        } else {
            createButtons();
            createOverlays();
            setTimeout(scanTags, 2000);

            const observer = new MutationObserver((mutations) => {
                let shouldScan = false;
                mutations.forEach(m => { if (m.addedNodes.length > 0) shouldScan = true; });
                if (shouldScan) {
                    if (debounceTimer) clearTimeout(debounceTimer);
                    debounceTimer = setTimeout(() => {
                        scanTags();
                        applyFilters();
                    }, 1000);
                }
            });
            observer.observe(document.body, { childList: true, subtree: true });
        }
    }

    init();

})();
