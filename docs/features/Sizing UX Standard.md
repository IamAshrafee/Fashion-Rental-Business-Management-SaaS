## Sizing UX Standard v1.0 (Proven, Low-Confusion, Owner-Defined)

This section defines the **single best, most common, least confusing** sizing approach for fashion e-commerce: **one clear “Size” selector + a “Size Guide” link next to it**, using consistent UI patterns and predictable behavior. Baymard’s large-scale ecommerce UX testing repeatedly finds that size selection is often overlooked when implemented as dropdowns and that a nearby size guide with complete sizing info reduces confusion. ([Baymard Institute][1])

---

# 1) Non-Negotiable UX Principles

### P1 — Make size selection “impossible to miss”

* **Default control = visible size buttons (chips/grid)**, not a dropdown, whenever the list is reasonably scannable. Users are prone to overlook dropdown size selectors during testing. ([Baymard Institute][1])

### P2 — Put “Size Guide” beside the size control (always)

* Link must be **adjacent** to the size selector (same visual cluster). ([Baymard Institute][2])

### P3 — Size Guide must be complete, not decorative

Minimum contents (only show relevant sections to the product type):

* **Conventional sizes** (S/M/L etc.) and/or **numeric sizes** when applicable ([Baymard Institute][2])
* **Measurements in both inches and centimeters** ([Baymard Institute][2])
* **International conversions** where relevant (US/EU/UK, etc.) ([Baymard Institute][2])
* **Measuring instructions** (“how to measure”) ([Baymard Institute][2])

### P4 — Never make options “come and go” unpredictably

Avoid “interacting menus” where selecting one thing changes another menu’s options in a way that feels like options appear/disappear (high confusion). ([Nielsen Norman Group][3])

### P5 — If something is unavailable, show it clearly (don’t create mystery)

You *can* disable out-of-stock/invalid options, but you must:

* label why it’s unavailable (e.g., “Out of stock”)
* keep it accessible (proper aria/tooltip)
  NN/g cautions that disabled controls can confuse if there’s no explanation—so always pair “disabled” with clear feedback. ([Nielsen Norman Group][4])

---

# 2) Decision Tree: Buttons vs Dropdown vs Composite

Use this exact decision tree in your PDP component:

### Step A — Count options the user must scan

1. **If ≤ ~12 size options** → use **Size Buttons (grid/chips)**
2. **If 13–30** → use **Scrollable list / listbox style** (still exposed options; not hidden dropdown)
3. **If > 30** → use **Dropdown with search** or **grouped list** (rare for sizing; typically only for long numeric lists)

Reason: exposed options reduce missed selection vs hidden dropdown interactions. ([Baymard Institute][1])

### Step B — Do we need multi-dimension selection?

* If size is naturally **one token** (S, M, L / 34C / US 9W / 32W-34L) → keep **one Size selector** (recommended).
* If the product requires **two independent decisions** that users already expect (e.g., two-piece set Top + Bottom) → use **two labeled selectors** (Top Size, Bottom Size).
* If you must support “system” (US/EU/UK) → use a **system toggle** + one size selector.

Avoid cascading dropdowns that mutate each other. ([Nielsen Norman Group][3])

---

# 3) Standard Components (Exact UI Contract)

## 3.1 The “Buy Box” sizing block (PDP)

Required layout:

1. **Label:** “Size”
2. **Selector:** buttons/list/dropdown based on decision tree
3. **Size Guide link:** “Size guide” (adjacent) ([Baymard Institute][2])
4. **State messages:**

   * “Select a size” (default)
   * “Out of stock” (disabled sizes)
   * “Only X left” (optional inventory cue)

## 3.2 Size Guide modal/drawer

Structure (show only sections relevant to schema):

* Tabs or sections:

  * **Size chart**
  * **How to measure**
  * **International conversion** (when applicable)
* Unit toggle inside guide: **cm / inches** ([Baymard Institute][2])

---

# 4) Schema → UI Mapping (Your “Most Used” Standard Library)

This mapping is what makes your UX consistent **even as products become unlimited**.

### 4.1 APPAREL_ALPHA (XS–XXL)

* UI: **Buttons grid**
* Size label: `S`, `M`, `L`
* Disabled state: show size but disabled with “Out of stock”

Backed by Baymard’s recommendation to use buttons for size selection. ([Baymard Institute][1])

### 4.2 APPAREL_NUMERIC (0–16 / 28–40)

* UI: **Buttons** if short list; otherwise **scrollable exposed list**
* Ordering: ascending
* Size guide: always include measurements + conversion if international ([Baymard Institute][2])

### 4.3 PANTS_WAIST_INSEAM (W/L)

**Most proven low-confusion pattern:** keep **one selector** with combined display:

* `32 / 34`, `34 / 34`, etc.
  This avoids “interacting menus” (waist dropdown changing inseam dropdown). ([Nielsen Norman Group][3])

### 4.4 SHOE_SYSTEM_SIZE_WIDTH

* UI:

  * **System toggle**: US | EU | UK
  * **Size buttons**: 7, 7.5, 8…
  * Width: either embedded in label (`US 9 / W`) or a second selector *only if unavoidable*
* Size guide: show conversions + measurement tips ([Baymard Institute][2])

### 4.5 BRA_BAND_CUP

Two acceptable standards (pick one and stay consistent site-wide):

* **Preferred for simplicity:** one selector with combined values: `32B, 32C, 34B…`
* Alternative: Band selector + Cup selector **only if** you keep options stable and avoid “come and go” behavior (disable invalid combos with explanation). ([Nielsen Norman Group][3])

### 4.6 JEWELRY_DIAMETER_MM (ring/bangle)

* UI: one selector (buttons or dropdown depending on count)
* Display: `Inner diameter: 66 mm`
* Size guide: measuring instructions + cm/in conversion ([Baymard Institute][2])

### 4.7 ONE_SIZE_DIMENSIONED (hair clip, scarf, etc.)

* UI: auto-select “One size”
* PDP shows key dimensions as text (not as a size selector)
* Size guide optional (only if dimensions matter)

### 4.8 BUNDLE_COMPONENT_SIZING (two-piece sets)

* UI: two selectors, clearly labeled:

  * “Top size”
  * “Bottom size”
* Avoid turning this into a single massive combined list unless there are very few combinations.

---

# 5) Do / Don’t Rules (Implementation-Level)

### Do

* Use **buttons** for size selection whenever feasible. ([Baymard Institute][1])
* Put **Size guide** link next to the selector. ([Baymard Institute][2])
* Include **cm + inches + conversions + measuring guide** in Size Guide where relevant. ([Baymard Institute][2])
* Keep unavailable options visible but clearly explained (e.g., disabled + “Out of stock”). ([Nielsen Norman Group][4])

### Don’t

* Don’t rely on dropdowns for common apparel sizing when buttons are possible (users may overlook dropdown size selectors). ([Baymard Institute][1])
* Don’t build cascading/interacting menus where size options appear/disappear based on another selection. ([Nielsen Norman Group][3])
* Don’t disable options without explaining why. ([Nielsen Norman Group][4])

---

# 6) Acceptance Criteria (QA Checklist)

A PDP passes sizing UX QA only if all are true:

## A) Visibility & selection

* [ ] Size selector is visible above the fold (desktop & mobile)
* [ ] If sizes ≤ ~12, sizes render as buttons (not dropdown) ([Baymard Institute][1])
* [ ] “Add to cart” is blocked until a size is selected (clear error message shown)

## B) Size Guide

* [ ] “Size guide” link is next to size selector ([Baymard Institute][2])
* [ ] Size guide includes (as relevant): size chart + measuring guide + international conversion ([Baymard Institute][5])
* [ ] Measurements support **cm and inches** ([Baymard Institute][2])

## C) Availability behavior

* [ ] Out-of-stock sizes are clearly indicated (disabled or labeled)
* [ ] Disabled options provide an explanation (“Out of stock”, “Unavailable”) ([Nielsen Norman Group][4])
* [ ] Options do not “come and go” in a confusing way when selecting other attributes ([Nielsen Norman Group][3])

## D) Schema compliance (admin correctness)

* [ ] Every variant has exactly one SizeInstance
* [ ] SizeInstance matches the product’s active SizeSchema
* [ ] Display labels are consistent and human-readable (no raw JSON, no confusing codes)
