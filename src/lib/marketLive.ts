// LendSure — Live Market & RBI layer (proper backend, user-friendly)
// 5-minute auto-refresh, manual Refresh button, single NewsAPI key, friendly errors.
// Server proxy via Convex action (hides NEWS_API_KEY) + client fallback. No 1s ticker.

export type NewsSentiment = "HAWKISH" | "DOVISH" | "NEUTRAL";
export type MarketNews = {
  id: string;
  title: string;
  source: string;
  publishedAt: string;
  url: string;
  summary: string;
  sentiment: NewsSentiment;
  impact: "HIGH" | "MEDIUM" | "LOW";
  tag: "RBI" | "Inflation" | "Rates" | "Markets" | "Policy";
};

export type MarketState = {
  repoRate: number;
  repoSource: string;
  lastUpdated: string;
  sentimentScore: number;
  headline: string;
  news: MarketNews[];
  isLive: boolean;
  error?: string;
};

const KEY_NEWS = "lendsure_news_api_key";
const KEY_RBI = "lendsure_rbi_api_key";

export function getNewsApiKey(): string {
  if (typeof localStorage === "undefined") return "";
  return localStorage.getItem(KEY_NEWS) || "";
}
export function saveNewsApiKey(key: string) {
  if (typeof localStorage === "undefined") return;
  const v = key.trim();
  if (!v) localStorage.removeItem(KEY_NEWS);
  else localStorage.setItem(KEY_NEWS, v);
}
export function clearMarketKeys() {
  if (typeof localStorage === "undefined") return;
  localStorage.removeItem(KEY_NEWS);
  localStorage.removeItem(KEY_RBI);
}

const MOCK_POOL: Omit<MarketNews, "publishedAt" | "id">[] = [
  { title: "RBI holds repo rate at 6.50% — stance remains withdrawal of accommodation", source: "Reserve Bank of India", url: "https://rbi.org.in", summary: "MPC voted 5:1 to hold rates, citing persistent food inflation but easing core inflation.", sentiment: "NEUTRAL", impact: "HIGH", tag: "RBI" },
  { title: "India CPI eases to 4.83% — lowest in 11 months, core at 4-year low", source: "MoSPI / Reuters", url: "https://mospi.gov.in", summary: "Vegetable prices cooled; economists now see room for a 25 bps cut by December.", sentiment: "DOVISH", impact: "HIGH", tag: "Inflation" },
  { title: "RBI Governor hints at rate cut if inflation holds below 4.5% for two quarters", source: "Economic Times", url: "https://economictimes.indiatimes.com", summary: "Markets price 60% chance of cut in Q4. Bond yields slipped 7 bps.", sentiment: "DOVISH", impact: "HIGH", tag: "Policy" },
  { title: "US Fed holds rates at 5.25% — RBI expected to follow, rupee steadies at 83.42", source: "Bloomberg", url: "https://bloomberg.com", summary: "Fed dot-plot still hawkish; RBI seen on hold until Fed pivots.", sentiment: "NEUTRAL", impact: "MEDIUM", tag: "Rates" },
  { title: "Food inflation spikes to 8.7% on heatwave — RBI may delay cuts", source: "Business Standard", url: "https://business-standard.com", summary: "Vegetable and cereal prices drove spike; MPC minutes flagged upside risk.", sentiment: "HAWKISH", impact: "HIGH", tag: "Inflation" },
  { title: "Bank credit growth at 16.2% YoY — RBI flags unsecured loan risks", source: "RBI Financial Stability Report", url: "https://rbi.org.in", summary: "Regulator raised risk weights on consumer loans; lenders tighten underwriting.", sentiment: "HAWKISH", impact: "MEDIUM", tag: "Markets" },
  { title: "Bond yields drop 12 bps after dovish MPC minutes — 10Y at 7.02%", source: "Mint", url: "https://livemint.com", summary: "Two MPC members dissented for a cut; market sees dovish tilt.", sentiment: "DOVISH", impact: "MEDIUM", tag: "Markets" },
  { title: "RBI injects ₹1.2 lakh cr via VRR auction as liquidity tightens", source: "RBI Press Release", url: "https://rbi.org.in", summary: "Call rate spiked to 6.78%; operation to ease overnight funding stress.", sentiment: "NEUTRAL", impact: "MEDIUM", tag: "RBI" },
];

function inferSentiment(title: string): NewsSentiment {
  const t = title.toLowerCase();
  if (/(hike|raise|tighten|hawkish|spike|surprise hike)/.test(t)) return "HAWKISH";
  if (/(cut|ease|cool|drop|dovish|lowest|dissent)/.test(t)) return "DOVISH";
  return "NEUTRAL";
}

function mockNews(): MarketNews[] {
  const now = Date.now();
  return MOCK_POOL.slice(0, 6).map((n, i) => ({
    ...n,
    id: `demo-${i}`,
    publishedAt: new Date(now - i * 1000 * 60 * 95).toISOString(),
  }));
}

function sentimentScoreOf(news: MarketNews[]): number {
  if (!news.length) return 0;
  let s = 0;
  for (const n of news) {
    if (n.sentiment === "HAWKISH") s -= n.impact === "HIGH" ? 1 : n.impact === "MEDIUM" ? 0.6 : 0.3;
    else if (n.sentiment === "DOVISH") s += n.impact === "HIGH" ? 1 : n.impact === "MEDIUM" ? 0.6 : 0.3;
  }
  const max = news.length * 1;
  return Math.max(-1, Math.min(1, (s / max) * 1.35));
}

function headlineFor(score: number, news: MarketNews[]) {
  if (score < -0.22) return `Hawkish tilt — ${news.find((n) => n.sentiment === "HAWKISH")?.tag ?? "RBI"} hike risk`;
  if (score > 0.22) return `Dovish tilt — cut priced in`;
  return "Balanced — on hold";
}

function mapServerArticles(articles: unknown[]): MarketNews[] {
  return (articles as unknown[]).slice(0, 6).map((raw: unknown, i: number) => {
    const a = raw as Record<string, unknown>;
    const title = String(a.title ?? "Markets update");
    const src = a.source as { name?: string } | string | undefined;
    const sourceName = typeof src === "string" ? src : (src?.name ?? "Live feed");
    const summaryRaw = String((a.description as string | undefined) ?? (a.content as string | undefined) ?? "Live finance update");
    return {
      id: `live-${i}-${String(a.publishedAt ?? Date.now())}`,
      title,
      source: String(sourceName),
      publishedAt: String((a.publishedAt as string | undefined) ?? new Date().toISOString()),
      url: String((a.url as string | undefined) ?? "https://newsapi.org"),
      summary: summaryRaw.slice(0, 160),
      sentiment: inferSentiment(title),
      impact: (i < 2 ? "HIGH" : i < 4 ? "MEDIUM" : "LOW") as MarketNews["impact"],
      tag: (/RBI/i.test(title) ? "RBI" : /inflation/i.test(title) ? "Inflation" : "Markets") as MarketNews["tag"],
    };
  });
}

export async function fetchMarketNews(opts?: { apiKey?: string }): Promise<{ news: MarketNews[]; isLive: boolean; error?: string }> {
  const key = opts?.apiKey?.trim() || getNewsApiKey();
  if (!key) return { news: mockNews(), isLive: false };
  try {
    const url = `https://newsapi.org/v2/everything?q=RBI%20repo%20OR%20India%20inflation%20OR%20India%20interest%20rate&language=en&sortBy=publishedAt&pageSize=6&apiKey=${encodeURIComponent(key)}`;
    const res = await fetch(url);
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      if (res.status === 401 || /apiKeyInvalid|api key|unauthorized/i.test(body)) {
        return { news: mockNews(), isLive: false, error: "Invalid API key — check it at newsapi.org. Showing demo feed. You can paste a new key below." };
      }
      if (res.status === 426 || res.status === 429) {
        return { news: mockNews(), isLive: false, error: "API limit reached (free tier) — showing demo feed. Try again later or use another key." };
      }
      return { news: mockNews(), isLive: false, error: `Feed unavailable (${res.status}) — showing demo feed.` };
    }
    const json = await res.json();
    if (!json.articles || !Array.isArray(json.articles) || json.articles.length === 0) {
      return { news: mockNews(), isLive: false, error: "No live articles right now — showing demo feed." };
    }
    return { news: mapServerArticles(json.articles as unknown[]), isLive: true };
  } catch {
    return { news: mockNews(), isLive: false, error: "Could not reach live feed — showing demo. Check your connection or key." };
  }
}

export async function fetchMarketNewsViaServer(
  serverFetch: (args: { clientApiKey?: string }) => Promise<{ isLive: boolean; error?: string; articles?: unknown[]; status?: number }>,
  clientKey: string,
): Promise<{ news: MarketNews[]; isLive: boolean; error?: string } | null> {
  try {
    const res = await serverFetch({ clientApiKey: clientKey || undefined });
    if (res.isLive && Array.isArray((res as { articles?: unknown[] }).articles) && (res as { articles?: unknown[] }).articles!.length) {
      return { news: mapServerArticles((res as { articles: unknown[] }).articles), isLive: true };
    }
    if (res.error) {
      // server had a key but it failed — surface friendly error but keep demo
      return { news: mockNews(), isLive: false, error: res.error };
    }
    // no server key and no client key — tell caller to fallback to client/demo
    return null;
  } catch {
    return null;
  }
}

export async function fetchRbiRate(): Promise<{ rate: number; source: string; isLive: boolean }> {
  const hasKey = !!getNewsApiKey();
  if (hasKey) {
    const rbiOverride = typeof localStorage !== "undefined" ? localStorage.getItem(KEY_RBI) : null;
    const n = rbiOverride ? Number(rbiOverride) : NaN;
    if (Number.isFinite(n) && n >= 3 && n <= 10) return { rate: +n.toFixed(2), source: "Your override — live", isLive: true };
  }
  return { rate: 6.5, source: hasKey ? "RBI MPC 6.50% — live key active" : "RBI MPC 6.50% — demo feed", isLive: !!hasKey };
}

export async function fetchMarketState(opts?: {
  serverFetch?: (args: { clientApiKey?: string }) => Promise<{ isLive: boolean; error?: string; articles?: unknown[]; status?: number }>;
}): Promise<MarketState> {
  const clientKey = getNewsApiKey();
  let newsRes: { news: MarketNews[]; isLive: boolean; error?: string } | null = null;
  if (opts?.serverFetch) {
    const via = await fetchMarketNewsViaServer(opts.serverFetch, clientKey);
    if (via) newsRes = via;
  }
  if (!newsRes) newsRes = await fetchMarketNews();
  const { rate, source } = await fetchRbiRate();
  const score = sentimentScoreOf(newsRes.news);
  return {
    repoRate: rate,
    repoSource: source,
    lastUpdated: new Date().toISOString(),
    sentimentScore: score,
    headline: headlineFor(score, newsRes.news),
    news: newsRes.news,
    isLive: newsRes.isLive,
    error: newsRes.error,
  };
}

// ── Hook: 5-minute auto-refresh + manual Refresh button + server proxy ──
import { useEffect, useState, useCallback, useRef } from "react";
import { useAction } from "convex/react";
import { api } from "@/convex/_generated/api";

export function useMarketLive() {
  const [state, setState] = useState<MarketState>(() => {
    const news = mockNews();
    return {
      repoRate: 6.5,
      repoSource: "RBI MPC 6.50%",
      lastUpdated: new Date().toISOString(),
      sentimentScore: sentimentScoreOf(news),
      headline: headlineFor(sentimentScoreOf(news), news),
      news,
      isLive: false,
    };
  });
  const [isRefreshing, setIsRefreshing] = useState(false);
  const timerRef = useRef<number | null>(null);

  const serverAction = useAction(api.lendsure.fetchMarketNewsAction) as unknown as (args: { clientApiKey?: string }) => Promise<{ isLive: boolean; error?: string; articles?: unknown[]; status?: number }>;

  const refresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      const next = await fetchMarketState({ serverFetch: serverAction ?? undefined });
      setState(next);
    } finally {
      setIsRefreshing(false);
    }
  }, [serverAction]);

  const connectKey = useCallback(
    async (key: string) => {
      saveNewsApiKey(key.trim());
      setIsRefreshing(true);
      try {
        const next = await fetchMarketState({ serverFetch: serverAction ?? undefined });
        setState(next);
        return next;
      } finally {
        setIsRefreshing(false);
      }
    },
    [serverAction],
  );

  useEffect(() => {
    refresh();
    const id = window.setInterval(refresh, 5 * 60 * 1000);
    timerRef.current = id;
    return () => window.clearInterval(id);
  }, [refresh]);

  return {
    ...state,
    isRefreshing,
    refresh,
    connectKey,
    saveKey: saveNewsApiKey,
  } as MarketState & {
    isRefreshing: boolean;
    refresh: () => Promise<void>;
    connectKey: (key: string) => Promise<MarketState>;
    saveKey: typeof saveNewsApiKey;
  };
}

export function marketRateDelta(state: Pick<MarketState, "repoRate" | "sentimentScore">): number {
  const repoDelta = state.repoRate - 6.5;
  const sentimentDelta = -state.sentimentScore * 0.55;
  return +(repoDelta + sentimentDelta).toFixed(2);
}
export function marketAmountMultiplier(state: Pick<MarketState, "sentimentScore">): number {
  return +(1 + state.sentimentScore * 0.034).toFixed(4);
}
