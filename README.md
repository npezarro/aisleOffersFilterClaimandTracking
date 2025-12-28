# Aisle Offer Filter & Auto-Claimer

A powerful Tampermonkey UserScript to enhance the **Aisle** (discover.gotoaisle.com) experience. This tool allows for advanced filtering of offers, automated claiming, location scraping, and detailed history tracking.

## 🚀 Features

### 🔍 Advanced Filtering
- **Tag Filtering:** Filter offers based on specific tags (e.g., "Free", "BOGO", "Walmart", "Whole Foods").
- **Quick Free:** One-click button to immediately filter for all "Free" offers (excluding BOGO/Earn).
- **Saved Presets:** Save your favorite tag combinations (e.g., "Keto Snacks", "Pet Food") for quick access.
- **Search:** Real-time search bar to find specific tags within the filter menu.

### 🤖 Automation
- **Auto Claim First:** Automatically clicks the first available offer in your filtered list, checks the opt-in box, scrapes data, and submits the claim.
- **Batch Claiming (∞):** loops through **all** currently filtered offers and claims them one by one automatically.

### 📍 Location Intelligence
- **Robust Scraping:** Automatically detects "Eligible Locations" on the offer detail page.
- **Full Address Capture:** Scrapes not just the store name, but the specific street address (e.g., `Target (123 Main St)`).
- **File Download:** Automatically downloads a `.txt` log file for every claimed offer containing the Brand, Offer Details, Date, and a list of all eligible locations.

### 📜 History & Management
- **Local History Log:** Keeps a persistent table of every offer you have claimed.
- **Wide Table View:** A full-width modal allows you to view Date, Brand, Product, Offer, and the full list of eligible locations/addresses.
- **CSV Export:** Export your entire claim history to a CSV file for spreadsheet analysis.

## 🛠️ Installation

1.  **Install a UserScript Manager:**
    * [Tampermonkey](https://www.tampermonkey.net/) (Chrome, Edge, Safari, Firefox)
    * [Violentmonkey](https://violentmonkey.github.io/)
2.  **Create a New Script:**
    * Click the extension icon -> "Create a new script..."
3.  **Paste Code:**
    * Delete any default code in the editor.
    * Paste the `aisle-offer-filter.js` code into the editor.
4.  **Save:** Press `Ctrl+S` or `Cmd+S`.

## 📖 Usage

### Filtering Offers
1.  Navigate to `https://discover.gotoaisle.com/offers`.
2.  Click the blue **Filter Tags** button in the bottom right.
3.  Select the tags you want to see (or click **⚡ Quick Free**).
4.  Click **Set** to apply the filter.

### Claiming Offers
* **Single Claim:** Click the green **🤖 Auto Claim First** button. The script will open the first offer, scrape the data, download a log, claim it, and return to the list.
* **Batch Claim:** Filter your list first! Then click the purple **∞ Auto Claim All Filtered** button. The script will process every visible card sequentially.

### Viewing History
1.  Click the **📜 Claimed Offers** button.
2.  A wide table will appear showing your history.
3.  Hover over the **Locations** column to read long address lists.
4.  Click **Export CSV** to save your data.

## ⚙️ Technical Details

* **Location Storage:** History is stored in your browser's `localStorage` under the key `aisle_claim_history_log`. Clearing your browser cache/data will wipe this history.
* **Location Parsing:** The script uses a "Text Anchor" strategy to find the "Eligible Locations" header and traverses the DOM to find the horizontal scroll container, ensuring accuracy even if Aisle changes their CSS class names.

## ⚠️ Disclaimer

This script is for educational and personal productivity purposes only. Use `Batch Claim` mode responsibly. The author is not affiliated with Aisle.
