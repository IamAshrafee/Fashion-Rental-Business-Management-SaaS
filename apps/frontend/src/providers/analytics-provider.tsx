'use client';

import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { analyticsApi } from '@/lib/api/analytics';
import type { StorefrontEventType } from '@closetrent/types';

// Robust UUID v4 generator safe for HTTP/HTTPS without crashing
function generateUUID() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    try {
      return crypto.randomUUID();
    } catch (e) {
      // Fallback
    }
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0,
          v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

interface AnalyticsContextType {
  sessionId: string | null;
  trackEvent: (
    eventType: StorefrontEventType,
    options?: { productId?: string; variantId?: string; metadata?: Record<string, any>; useBeacon?: boolean }
  ) => void;
}

const AnalyticsContext = createContext<AnalyticsContextType>({
  sessionId: null,
  trackEvent: () => {},
});

export function AnalyticsProvider({ children }: { children: React.ReactNode }) {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const utmCache = useRef<Record<string, string>>({});
  const isInitialized = useRef<boolean>(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // 1. UTM Capture / Attribution Engine
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const sources = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'];
      let foundUtms = false;

      sources.forEach((key) => {
        const val = urlParams.get(key);
        if (val) {
          utmCache.current[key] = val;
          foundUtms = true;
        }
      });

      // If we found fresh UTMs, cache them in sessionStorage for the duration of this tab
      if (foundUtms) {
        sessionStorage.setItem('closetrent_utms', JSON.stringify(utmCache.current));
      } else {
        const cached = sessionStorage.getItem('closetrent_utms');
        if (cached) utmCache.current = JSON.parse(cached);
      }
    } catch {
      // Silent catch for Private Mode restrictions on sessionStorage
    }

    // 2. Session ID Management with Private Mode Resilience
    let currentSessionId = '';
    const STORAGE_KEY = 'cr_analytics_session';

    try {
      currentSessionId = localStorage.getItem(STORAGE_KEY) || '';
      if (!currentSessionId) {
        currentSessionId = generateUUID();
        localStorage.setItem(STORAGE_KEY, currentSessionId);
      }
    } catch (error) {
      // User is likely in Safari Private Mode or blocks localStorage
      // Fallback to memory-only session array - guarantees NO CRASH
      console.warn('[Analytics] Running in memory-only mode due to storage restrictions.');
      currentSessionId = generateUUID();
    }

    setSessionId(currentSessionId);
    isInitialized.current = true;
  }, []);

  const trackEvent = (
    eventType: StorefrontEventType,
    options?: { productId?: string; variantId?: string; metadata?: Record<string, any>; useBeacon?: boolean }
  ) => {
    // Drop execution immediately if it's a known bot/crawler
    if (typeof navigator !== 'undefined') {
      const ua = navigator.userAgent.toLowerCase();
      // Extensive bot filter shield
      if (/(bot|crawler|spider|crawling|headless|slurp|lighthouse|chrome-lighthouse|screaming|gtmetrix)/i.test(ua)) {
        return;
      }
    }

    if (!isInitialized.current || !sessionId) return;
    
    analyticsApi.trackStorefrontEvent(
      {
        sessionId,
        eventType,
        productId: options?.productId,
        variantId: options?.variantId,
        metadata: {
          ...options?.metadata,
          ...utmCache.current, // Attach Ad Attribution universally!
          // We can also attach the current pathname to every event
          path: typeof window !== 'undefined' ? window.location.pathname : '',
        },
      },
      options?.useBeacon || false
    );
  };

  return (
    <AnalyticsContext.Provider value={{ sessionId, trackEvent }}>
      {children}
    </AnalyticsContext.Provider>
  );
}

export const useAnalytics = () => useContext(AnalyticsContext);
