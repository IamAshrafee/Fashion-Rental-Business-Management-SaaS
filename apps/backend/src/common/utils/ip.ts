import { Request } from 'express';

/**
 * Extract the real client IP address from the request.
 * Checks headers set by reverse proxies (Cloudflare, Nginx) first.
 */
export function extractIpAddress(req: Request): string {
  // Cloudflare
  const cfIp = req.headers['cf-connecting-ip'];
  if (cfIp) return Array.isArray(cfIp) ? cfIp[0] : cfIp;

  // Nginx / standard proxy
  const realIp = req.headers['x-real-ip'];
  if (realIp) return Array.isArray(realIp) ? realIp[0] : realIp;

  // X-Forwarded-For (can contain multiple IPs — first is the client)
  const forwardedFor = req.headers['x-forwarded-for'];
  if (forwardedFor) {
    const first = (Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor).split(',')[0];
    return first.trim();
  }

  // Fallback to socket address
  return req.socket?.remoteAddress || req.ip || '0.0.0.0';
}

/**
 * Partially mask an IP address for display.
 * IPv4: 103.xx.xx.42 → shows first and last octet
 * IPv6: abbreviated
 */
export function maskIpAddress(ip: string): string {
  if (!ip) return 'Unknown';

  // IPv4
  const parts = ip.split('.');
  if (parts.length === 4) {
    return `${parts[0]}.xx.xx.${parts[3]}`;
  }

  // IPv6 — truncate
  if (ip.includes(':')) {
    const segments = ip.split(':');
    if (segments.length > 2) {
      return `${segments[0]}:${segments[1]}:...:${segments[segments.length - 1]}`;
    }
  }

  return ip;
}
