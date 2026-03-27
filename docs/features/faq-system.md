# Feature Spec: FAQ System

## Overview

Per-product FAQ entries that answer common customer questions. Reduce customer confusion, build trust, and decrease support inquiries. Each product can have its own FAQ section.

---

## Configuration (Owner)

Owner can add multiple FAQ entries per product.

Each entry:

| Field | Type | Required | Max Length |
|---|---|---|---|
| Question | Text | Yes | 300 characters |
| Answer | Text | Yes | 1000 characters |

### Management Actions
- **Add**: Owner types question and answer, clicks add
- **Edit**: Modify existing question or answer
- **Delete**: Remove a FAQ entry
- **Reorder**: Drag-and-drop to change display order

---

## Display Rules (Guest Side)

### Product Detail Page

FAQ section appears below the product description and details sections.

**Layout**: Accordion style — questions visible, answers expand on tap.

```
❓ Frequently Asked Questions

▸ What if the dress does not fit?
  You can exchange for a different size within 24 hours of receiving. 
  Return shipping is on you.

▸ What if I return late?
  Late returns are charged ৳1,000 per day. See our late return policy.

▸ Is the deposit refundable?
  Yes, the full deposit is refunded within 3-5 business days after 
  we receive and inspect the returned item.

▸ Is home delivery available?
  Yes, we deliver across Dhaka. Outside Dhaka, courier charges apply.

▸ What if the dress gets damaged?
  Minor wear is expected. Significant damage will be assessed, and 
  repair costs may be deducted from your deposit.
```

### Behavior
- By default, all answers are collapsed (only questions visible)
- Tap on question → answer expands/collapses (toggle)
- Only one can be open at a time (optional — could also allow multiple open)
- Smooth expand/collapse animation

---

## Product Without FAQs

If no FAQ entries exist, the FAQ section is simply not shown on the product detail page. No placeholder, no "No FAQs" message.

---

## Future Enhancements

- **Tenant-wide default FAQs**: Owner sets FAQs that appear on ALL products (e.g., general return policy). Product-specific FAQs appear in addition to these.
- **FAQ templates**: Pre-built FAQ sets for common product types (wedding saree, sherwani, accessories)

---

## Business Rules Summary

1. FAQs are optional per product
2. No limit on number of FAQ entries (practically 3-10 is typical)
3. Order of FAQs is determined by the owner via drag-and-drop
4. FAQ section not shown if no entries exist
5. Questions and answers are plain text (no rich text / HTML)
6. FAQs are public — visible to all guests viewing the product
