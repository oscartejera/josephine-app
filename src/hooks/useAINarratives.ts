import { useState, useCallback, useRef } from 'react';

const NARRATIVES_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/dashboard_narratives`;
const CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes

interface CacheEntry {
  narrative: string;
  timestamp: number;
  key: string;
}

let narrativeCache: CacheEntry | null = null;

export interface DashboardMetricsForAI {
  sales: number;
  salesDelta: number;
  covers: number;
  coversDelta: number;
  avgTicket: number;
  avgTicketDelta: number;
  laborCost: number;
  laborDelta: number;
  colPercent: number;
  colDelta: number;
  cogsPercent: number;
  cogsDelta: number;
  gpPercent: number;
  gpDelta: number;
  locationName: string;
  periodLabel: string;
  topProducts: { name: string; sales: number; margin: number }[];
}

export function useAINarratives() {
  const [narrative, setNarrative] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const generate = useCallback(async (metrics: DashboardMetricsForAI, forceRefresh = false) => {
    // Cache key based on metrics signature
    const cacheKey = `${metrics.locationName}-${metrics.sales}-${metrics.laborCost}`;

    // Check cache
    if (!forceRefresh && narrativeCache && narrativeCache.key === cacheKey) {
      if (Date.now() - narrativeCache.timestamp < CACHE_TTL_MS) {
        setNarrative(narrativeCache.narrative);
        return;
      }
    }

    // Abort previous request
    if (abortRef.current) abortRef.current.abort();
    abortRef.current = new AbortController();

    setIsLoading(true);
    setError(null);
    setNarrative('');

    try {
      const resp = await fetch(NARRATIVES_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ metrics }),
        signal: abortRef.current.signal,
      });

      if (!resp.ok) {
        const errorData = await resp.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || `Error ${resp.status}`);
      }

      if (!resp.body) throw new Error('No response body');

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let fullText = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        let newlineIndex: number;
        while ((newlineIndex = buffer.indexOf('\n')) !== -1) {
          let line = buffer.slice(0, newlineIndex);
          buffer = buffer.slice(newlineIndex + 1);

          if (line.endsWith('\r')) line = line.slice(0, -1);
          if (line.startsWith(':') || line.trim() === '') continue;
          if (!line.startsWith('data: ')) continue;

          const jsonStr = line.slice(6).trim();
          if (jsonStr === '[DONE]') break;

          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) {
              fullText += content;
              setNarrative(fullText);
            }
          } catch {
            buffer = line + '\n' + buffer;
            break;
          }
        }
      }

      // Final flush
      if (buffer.trim()) {
        for (let raw of buffer.split('\n')) {
          if (!raw) continue;
          if (raw.endsWith('\r')) raw = raw.slice(0, -1);
          if (!raw.startsWith('data: ')) continue;
          const jsonStr = raw.slice(6).trim();
          if (jsonStr === '[DONE]') continue;
          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) {
              fullText += content;
              setNarrative(fullText);
            }
          } catch { /* ignore */ }
        }
      }

      // Cache result
      narrativeCache = { narrative: fullText, timestamp: Date.now(), key: cacheKey };
      setIsLoading(false);
    } catch (e) {
      if ((e as Error).name === 'AbortError') return;
      setError(e instanceof Error ? e.message : 'Connection failed');
      setIsLoading(false);
    }
  }, []);

  return { narrative, isLoading, error, generate };
}
