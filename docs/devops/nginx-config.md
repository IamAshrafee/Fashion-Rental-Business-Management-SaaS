# DevOps: Nginx Configuration

## Overview

Nginx serves as the reverse proxy, handling SSL termination, subdomain routing, and static file serving.

---

## Main Config

```nginx
# /etc/nginx/nginx.conf
worker_processes auto;

events {
    worker_connections 1024;
}

http {
    include mime.types;
    default_type application/octet-stream;

    # Gzip
    gzip on;
    gzip_types text/plain text/css application/json application/javascript;
    gzip_min_length 256;

    # Security
    server_tokens off;
    add_header X-Content-Type-Options nosniff;
    add_header X-Frame-Options DENY;
    add_header X-XSS-Protection "1; mode=block";

    # Rate limiting zones
    limit_req_zone $binary_remote_addr zone=api:10m rate=30r/s;
    limit_req_zone $binary_remote_addr zone=auth:10m rate=5r/m;

    include /etc/nginx/conf.d/*.conf;
}
```

---

## Subdomain Routing (Wildcard)

```nginx
# /etc/nginx/conf.d/storefront.conf
server {
    listen 443 ssl;
    server_name *.closetrent.com;

    ssl_certificate /etc/letsencrypt/live/closetrent.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/closetrent.com/privkey.pem;

    # Frontend (Next.js)
    location / {
        proxy_pass http://frontend:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # API
    location /api/ {
        limit_req zone=api burst=50 nodelay;
        proxy_pass http://backend:4000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }

    # Static assets (MinIO)
    location /storage/ {
        proxy_pass http://minio:9000/;
        proxy_set_header Host $host;
        expires 30d;
        add_header Cache-Control "public, immutable";
    }
}
```

---

## Custom Domain Routing

```nginx
# /etc/nginx/conf.d/custom-domains.conf
# Auto-generated per custom domain

server {
    listen 443 ssl;
    server_name rentbyhana.com;

    ssl_certificate /etc/letsencrypt/live/rentbyhana.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/rentbyhana.com/privkey.pem;

    # Same proxy config as subdomain
    location / {
        proxy_pass http://frontend:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    location /api/ {
        proxy_pass http://backend:4000;
        proxy_set_header Host $host;
    }
}
```

---

## Platform Admin

```nginx
# /etc/nginx/conf.d/admin.conf
server {
    listen 443 ssl;
    server_name admin.closetrent.com;

    ssl_certificate /etc/letsencrypt/live/closetrent.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/closetrent.com/privkey.pem;

    location / {
        proxy_pass http://frontend:3000;
        proxy_set_header Host $host;
    }
}
```

---

## HTTP → HTTPS Redirect

```nginx
server {
    listen 80;
    server_name *.closetrent.com closetrent.com;

    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    location / {
        return 301 https://$host$request_uri;
    }
}
```

---

## SSL (Let's Encrypt)

```bash
# Wildcard certificate via Cloudflare DNS
certbot certonly --dns-cloudflare \
  --dns-cloudflare-credentials /etc/cloudflare/credentials.ini \
  -d closetrent.com \
  -d *.closetrent.com

# Auto-renewal cron
0 0 */60 * * certbot renew --quiet && nginx -s reload
```
