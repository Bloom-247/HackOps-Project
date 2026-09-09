import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Landmark, TrendingUp, TrendingDown, Minus, Newspaper, RefreshCw, ExternalLink, Clock3, ShieldCheck, Sparkles } from "lucide-react";
import { useMarketLive, getNewsApiKey } from "@/lib/marketLive";

function timeAgo(iso: string) {
  const d = Date.now() - new Date(iso).getTime();
  const s = Math.floor(d / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

function sentimentTone(s: number) {
  if (s < -0.18) return { label: "Hawkish", cls: "bg-red-500 text-white border-red-500", Icon: TrendingUp };
  if (s > 0.18) return { label: "Dovish", cls: "bg-emerald-500 text-white border-emerald-500", Icon: TrendingDown };
  return { label: "Balanced", cls: "bg-white text-foreground border", Icon: Minus };
}

export function MarketPulseStrip() {
  const m = useMarketLive();
  const delta = m.repoRate - 6.5 - m.sentimentScore * 0.55;
  return (
    <div className="w-full border-y bg-foreground text-white">
      <div className="mx-auto max-w-[1280px] flex items-center gap-3 px-5 sm:px-6 h-9">
        <span className={`hidden sm:inline-flex items-center gap-1.5 mono text-xs font-black px-2.5 py-1 rounded-full border ${m.isLive ? "bg-emerald-500 text-white border-emerald-500" : "bg-white/10 border-white/20 text-white"}`}>
          <span className={`w-2 h-2 rounded-full ${m.isLive ? "bg-white animate-pulse" : "bg-amber-300"}`} /> {m.isLive ? "LIVE" : "DEMO FEED"}
        </span>
        <span className="mono text-xs font-bold tracking-wide truncate">RBI {m.repoRate.toFixed(2)}% • {m.headline}</span>
        <span className="hidden md:inline mono text-xs text-white/50">• Auto-refresh every 5 min</span>
        <span className="ml-auto hidden sm:inline-flex mono text-xs font-black bg-white/10 border border-white/15 px-2.5 py-1 rounded-full">
          {delta > 0.02 ? "+" : ""}{delta.toFixed(2)}% model shift
        </span>
      </div>
    </div>
  );
}

export function MarketNewsFeed({ compact = false }: { compact?: boolean }) {
  const m = useMarketLive();
  const [draftKey, setDraftKey] = useState(() => getNewsApiKey());
  const [msg, setMsg] = useState<string | null>(null);
  const tone = sentimentTone(m.sentimentScore);
  const delta = (m.repoRate - 6.5 - m.sentimentScore * 0.55).toFixed(2);
  const mult = (1 + m.sentimentScore * 0.034).toFixed(3);

  const handleConnect = async () => {
    const k = draftKey.trim();
    if (!k) {
      setMsg("Paste your NewsAPI key first — get a free one at newsapi.org.");
      return;
    }
    const next = await m.connectKey(k);
    if (next.isLive) setMsg("✓ Connected — now showing live headlines. They’ll refresh every 5 min.");
    else setMsg(next.error || "Couldn’t verify that key — check it and try again. Demo feed is still showing.");
    setTimeout(() => setMsg(null), 5000);
  };

  const handleRefresh = async () => {
    await m.refresh();
    setMsg(m.isLive ? "Refreshed — live headlines updated." : m.error ? m.error : "Refreshed demo feed.");
    setTimeout(() => setMsg(null), 3500);
  };

  const handleUseDemo = () => {
    m.saveKey("");
    setDraftKey("");
    m.refresh();
    setMsg("Switched to demo feed — clean sample data, no key needed.");
    setTimeout(() => setMsg(null), 3000);
  };

  return (
    <div className="premium-card overflow-hidden">
      <div className="bg-white border-b p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="mono text-xs font-black tracking-[0.12em] text-primary flex items-center gap-2"><Newspaper className="w-4 h-4" /> FINANCE & RBI — LIVE FEED</p>
            <h3 className="mt-2 text-[22px] font-black leading-none tracking-tight" style={{ fontFamily: "Fraunces, serif" }}>Markets that nudge your decisions</h3>
            <p className="mono text-xs font-bold text-muted-foreground mt-1.5 flex flex-wrap items-center gap-1.5">
              <Clock3 className="w-3.5 h-3.5" /> Updated {timeAgo(m.lastUpdated)} • Auto-refresh every <b className="text-foreground">5 min</b> • <span className={m.isLive ? "text-emerald-600" : ""}>{m.isLive ? "● Live headlines" : "○ Demo headlines (no key needed)"}</span>
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <span className={`mono text-xs font-black px-3 py-1.5 rounded-full border inline-flex items-center gap-1.5 ${tone.cls}`}><tone.Icon className="w-3.5 h-3.5" /> {tone.label}</span>
            <button
              onClick={handleRefresh}
              disabled={m.isRefreshing}
              className="h-9 px-4 rounded-full bg-foreground text-white mono text-xs font-black inline-flex items-center gap-1.5 hover:bg-foreground/90 disabled:opacity-60"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${m.isRefreshing ? "animate-spin" : ""}`} /> {m.isRefreshing ? "Refreshing…" : "Refresh news"}
            </button>
          </div>
        </div>

        <div className="mt-4 grid sm:grid-cols-3 gap-3">
          <div className="rounded-2xl border bg-muted/20 p-4 flex items-center gap-3">
            <span className="w-10 h-10 rounded-2xl bg-foreground text-white flex items-center justify-center shrink-0"><Landmark className="w-5 h-5" /></span>
            <div><p className="mono text-xs font-black text-muted-foreground">RBI REPO</p><p className="text-[20px] font-black leading-none mt-0.5">{m.repoRate.toFixed(2)}%</p><p className="mono text-xs font-bold text-muted-foreground">{m.repoSource}</p></div>
          </div>
          <div className="rounded-2xl border bg-white p-4">
            <p className="mono text-xs font-black">HOW IT MOVES YOUR MODEL</p>
            <p className="text-sm font-black mt-1">{delta}% on rate • ×{mult} on amount</p>
            <p className="mono text-xs font-bold text-muted-foreground mt-1">Applied to every recommendation — gentle, never overrides verification</p>
          </div>
          <div className="rounded-2xl border bg-white p-4">
            <p className="mono text-xs font-black flex items-center gap-1.5"><Clock3 className="w-3.5 h-3.5" /> LAST UPDATE</p>
            <p className="text-sm font-black mt-1">{new Date(m.lastUpdated).toLocaleTimeString()} • {timeAgo(m.lastUpdated)}</p>
            <p className="mono text-xs font-bold text-muted-foreground">{m.news.length} stories • {m.headline}</p>
          </div>
        </div>

        {m.error && (
          <div className="mt-4 rounded-2xl border bg-amber-50 border-amber-200 px-4 py-3 mono text-xs font-bold leading-5 text-amber-900 flex gap-2">
            <span className="shrink-0 mt-0.5">⚠</span><span>{m.error}</span>
          </div>
        )}
        {msg && (
          <div className="mt-3 rounded-2xl border bg-foreground text-white px-4 py-2.5 mono text-xs font-bold">{msg}</div>
        )}
      </div>

      <div className="p-4 sm:p-5 grid sm:grid-cols-2 gap-3 bg-muted/20">
        {m.news.slice(0, compact ? 4 : 6).map((n) => (
          <a
            key={n.id}
            href={n.url}
            target="_blank"
            rel="noreferrer"
            className="group rounded-2xl border bg-white p-4 hover:border-primary/15 hover:shadow-sm transition text-left"
          >
            <div className="flex items-center justify-between gap-2">
              <span className={`mono text-[11px] font-black px-2 py-1 rounded-full border ${n.tag === "RBI" ? "bg-foreground text-white border-foreground" : "bg-muted/40"}`}>{n.tag}</span>
              <span className={`mono text-[11px] font-black px-2 py-1 rounded-full border ${n.sentiment === "HAWKISH" ? "bg-red-50 border-red-200 text-red-700" : n.sentiment === "DOVISH" ? "bg-emerald-50 border-emerald-200 text-emerald-700" : "bg-white"}`}>{n.sentiment}</span>
            </div>
            <p className="mt-3 font-black text-[15px] leading-5 group-hover:text-primary line-clamp-2">{n.title}</p>
            <p className="mt-1.5 text-[13px] font-medium leading-5 text-muted-foreground line-clamp-2">{n.summary}</p>
            <p className="mt-3 mono text-xs font-bold text-muted-foreground flex items-center gap-1.5">{n.source} • {timeAgo(n.publishedAt)} <ExternalLink className="w-3 h-3" /></p>
          </a>
        ))}
      </div>

      {/* Single clean API key row — paste once, live immediately */}
      <div className="border-t bg-white p-4 sm:p-5 flex flex-col lg:flex-row gap-3 items-stretch lg:items-end">
        <label className="flex-1 min-w-0 mono text-xs font-black">
          <span className="flex items-center gap-1.5"><ShieldCheck className="w-3.5 h-3.5 text-primary" /> Live NewsAPI key <span className="font-bold text-muted-foreground">(optional — demo works fine without it)</span></span>
          <span className="flex gap-2 mt-1.5">
            <input
              value={draftKey}
              onChange={(e) => setDraftKey(e.target.value)}
              placeholder="Paste NewsAPI key from newsapi.org — leave empty for demo"
              className="flex-1 min-w-0 h-11 bg-white border rounded-full px-4 text-sm font-bold placeholder:text-muted-foreground/50"
            />
            <button onClick={handleConnect} disabled={m.isRefreshing} className="shrink-0 h-11 px-5 rounded-full bg-foreground text-white font-black text-sm hover:bg-foreground/90 disabled:opacity-60 inline-flex items-center gap-1.5">
              <Sparkles className="w-4 h-4" /> {m.isLive ? "Update key" : "Go live"}
            </button>
          </span>
          <span className="mono text-xs font-bold text-muted-foreground mt-1 block">Free at <a href="https://newsapi.org" target="_blank" rel="noreferrer" className="underline font-black text-foreground">newsapi.org</a> • Stored only in your browser • Refresh every 5 min, or tap Refresh news anytime</span>
        </label>
        <button onClick={handleUseDemo} className="h-11 px-5 rounded-full border bg-white font-bold text-sm shrink-0 hover:bg-muted">Use demo feed</button>
      </div>
    </div>
  );
}
