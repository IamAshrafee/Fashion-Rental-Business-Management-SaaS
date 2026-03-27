import { DeviceType } from '@closetrent/types';

/**
 * Parsed user agent information for session tracking.
 */
export interface ParsedUserAgent {
  browser: string;
  os: string;
  deviceType: DeviceType;
  deviceName: string;
}

/**
 * Parse a User-Agent string into structured device info.
 * Uses regex-based parsing instead of ua-parser-js to avoid an extra dependency.
 */
export function parseUserAgent(ua: string | undefined): ParsedUserAgent {
  if (!ua) {
    return {
      browser: 'Unknown',
      os: 'Unknown',
      deviceType: 'desktop',
      deviceName: 'Unknown Device',
    };
  }

  const browser = detectBrowser(ua);
  const os = detectOS(ua);
  const deviceType = detectDeviceType(ua);
  const deviceName = `${browser} on ${os}`;

  return { browser, os, deviceType, deviceName };
}

function detectBrowser(ua: string): string {
  // Order matters — check more specific patterns first
  if (/Edg\//i.test(ua)) return 'Edge';
  if (/OPR\//i.test(ua) || /Opera/i.test(ua)) return 'Opera';
  if (/SamsungBrowser/i.test(ua)) return 'Samsung Internet';
  if (/UCBrowser/i.test(ua)) return 'UC Browser';
  if (/Firefox\//i.test(ua)) return 'Firefox';
  if (/Chrome\//i.test(ua) && !/Chromium/i.test(ua)) return 'Chrome';
  if (/Safari\//i.test(ua) && !/Chrome/i.test(ua)) return 'Safari';
  if (/MSIE|Trident/i.test(ua)) return 'Internet Explorer';
  return 'Unknown';
}

function detectOS(ua: string): string {
  if (/Windows NT 10/i.test(ua)) return 'Windows';
  if (/Windows NT/i.test(ua)) return 'Windows';
  if (/Macintosh|Mac OS X/i.test(ua)) return 'macOS';
  if (/iPhone/i.test(ua)) return 'iOS';
  if (/iPad/i.test(ua)) return 'iPadOS';
  if (/Android/i.test(ua)) return 'Android';
  if (/Linux/i.test(ua)) return 'Linux';
  if (/CrOS/i.test(ua)) return 'Chrome OS';
  return 'Unknown';
}

function detectDeviceType(ua: string): DeviceType {
  if (/iPad|tablet/i.test(ua) && !/mobile/i.test(ua)) return 'tablet';
  if (/iPhone|Android.*Mobile|Mobile.*Android|webOS|BlackBerry|Opera Mini|IEMobile/i.test(ua)) return 'mobile';
  return 'desktop';
}
