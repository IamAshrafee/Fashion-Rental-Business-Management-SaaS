# Security: File Upload Security

## Threat Model

| Threat | Risk | Mitigation |
|---|---|---|
| Malicious file upload | Server compromise | File type validation, magic byte check |
| Oversized files | Disk exhaustion | Size limits |
| XSS via SVG/HTML | Script execution | Only allow raster images; sanitize SVG for logo |
| Path traversal | File system access | UUID rename, no user-controlled paths |
| Denial of service | Resource exhaustion | Rate limiting, concurrent upload limits |

---

## Validation Pipeline

```
[File Upload Received]
       │
       ├── 1. Check file size (reject if over limit)
       ├── 2. Check MIME type from header
       ├── 3. Check file extension
       ├── 4. Read magic bytes (first 8 bytes) to verify actual file type
       ├── 5. Process image (Sharp):
       │      ├── Strip EXIF metadata (privacy)
       │      ├── Convert to WebP
       │      ├── Resize to max dimensions
       │      └── Generate thumbnail
       ├── 6. Rename to UUID (no original filename)
       ├── 7. Upload to MinIO in tenant-scoped path
       └── 8. Store metadata in DB
```

---

## File Limits

| Upload Type | Max Size | Allowed Types | Max Dimensions |
|---|---|---|---|
| Product image | 10 MB | JPEG, PNG, WebP | 4000×4000 |
| Logo | 5 MB | JPEG, PNG, WebP, SVG | 1000×1000 |
| Banner | 10 MB | JPEG, PNG, WebP | 4000×2000 |
| Favicon | 1 MB | PNG, ICO | 512×512 |
| Damage photo | 10 MB | JPEG, PNG, WebP | 4000×4000 |
| Size chart | 5 MB | JPEG, PNG, WebP | 3000×3000 |

---

## Magic Byte Verification

```typescript
const MAGIC_BYTES = {
  'image/jpeg': [0xFF, 0xD8, 0xFF],
  'image/png': [0x89, 0x50, 0x4E, 0x47],
  'image/webp': [0x52, 0x49, 0x46, 0x46], // RIFF
};

function verifyMagicBytes(buffer: Buffer, expectedType: string): boolean {
  const expected = MAGIC_BYTES[expectedType];
  return expected.every((byte, i) => buffer[i] === byte);
}
```

---

## MinIO Storage Structure

```
closetrent-bucket/
├── tenant-{uuid}/
│   ├── products/
│   │   └── {productId}/
│   │       └── {variantId}/
│   │           ├── {uuid}.webp         (full-size)
│   │           └── {uuid}_thumb.webp   (thumbnail)
│   ├── branding/
│   │   ├── logo.webp
│   │   ├── favicon.png
│   │   └── banners/
│   │       ├── {uuid}.webp
│   │       └── ...
│   └── damage/
│       └── {bookingItemId}/
│           ├── {uuid}.webp
│           └── ...
```

---

## Access Control

| Rule | Detail |
|---|---|
| Public read | Product images, logos, banners are publicly readable via CDN |
| Tenant-scoped write | Only authenticated users of that tenant can upload |
| No direct MinIO access | All access through API; MinIO not exposed publicly |
| Signed URLs | For private files (damage photos): time-limited signed URLs |

---

## Image Processing (Sharp)

```typescript
import sharp from 'sharp';

async function processProductImage(buffer: Buffer) {
  const fullSize = await sharp(buffer)
    .rotate()           // Auto-rotate based on EXIF
    .resize(1200, 1200, { fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 85 })
    .toBuffer();

  const thumbnail = await sharp(buffer)
    .rotate()
    .resize(400, 400, { fit: 'cover' })
    .webp({ quality: 80 })
    .toBuffer();

  return { fullSize, thumbnail };
}
```
