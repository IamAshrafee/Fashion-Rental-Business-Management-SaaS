# Feature Spec: Search System

## Overview

Search lets guests find products by typing queries. It must be fast, forgiving (handle typos and partial matches), and support searching across multiple product attributes simultaneously.

---

## Searchable Fields

| Field | Weight | Example Query Match |
|---|---|---|
| Product Name | Highest | "Royal Banarasi" → finds "Royal Banarasi Wedding Saree" |
| Category Name | High | "saree" → finds all sarees |
| Subcategory Name | High | "jamdani" → finds Jamdani sarees |
| Event Names | Medium | "wedding" → finds products tagged with Wedding event |
| Color Names | Medium | "red" → finds products with red in main or identical colors |
| Description | Low | "silk embroidery" → matches description text |

---

## Search Behavior

### Input
- Single text input in the sticky header
- Search triggers on:
  - Enter key press
  - Search icon click
  - Auto-suggest after 3+ characters (debounced 300ms)

### Matching Rules
1. **Case-insensitive**: "SAREE" matches "saree"
2. **Partial match**: "banaras" matches "Banarasi"
3. **Multi-word**: "red wedding saree" searches for products matching any combination of these terms
4. **Trim whitespace**: Extra spaces ignored

### Result Ordering
1. Exact name match first
2. Name contains query
3. Category/subcategory match
4. Event match
5. Color match
6. Description match

Within each group, sort by: most popular (booking count) → newest

---

## Search Results Display

Results use the same product card grid as the shopping page.

### Header
```
Search results for "red wedding saree" (12 results)
```

### Smart Thumbnail
When search matches a specific color → product cards show the matching variant's featured image (same logic as color filter — see [color-variant-system.md](./color-variant-system.md)).

### No Results
```
No products found for "xyz"

Suggestions:
• Check your spelling
• Try broader terms
• Browse categories below

[Saree] [Lehenga] [Sherwani] [Gown] ...
```

---

## Search Implementation (v1)

### Approach: PostgreSQL Full-Text Search

For v1, use PostgreSQL's built-in full-text search capabilities:

- Create a `tsvector` column on products combining: name, category, subcategory, events, colors, description
- Use `ts_query` for search matching
- Index with GIN index for performance

This avoids needing Elasticsearch or external search services in v1.

### Future: Elasticsearch/MeiliSearch

If search volume or complexity grows, migrate to a dedicated search engine. The API contract stays the same — only the backend implementation changes.

---

## Search API

```
GET /api/products/search?q=red+wedding+saree&page=1&limit=20

Response:
{
  "results": [...products],
  "total": 12,
  "page": 1,
  "pages": 1,
  "query": "red wedding saree"
}
```

---

## Business Rules Summary

1. Search is tenant-scoped (only searches within one store)
2. Only published and available products appear in results
3. Search across name, category, event, color, description
4. Smart thumbnails show matching color variant when color is searched
5. PostgreSQL full-text search for v1
6. Results paginated (default 20 per page)
