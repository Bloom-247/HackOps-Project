// LendSure — Dynamic Trust Ledger
// Trust properly improves when a borrower repays on time. Persists in localStorage, emits events for live UI.
// No new dataset — just overlays the trained model’s base trust with earned deltas.

import { useEffect, useState, useCallback } from "react";

export type TrustKind = "APPROVED" | "REPAID_ON_TIME" | "REPAID_LATE" | "DEFAULTED" | "MANUAL_BOOST";

export type TrustEvent = {
  id: string;
  borrowerId: string;
  at: string; // ISO
  kind: TrustKind;
  delta: number;
  scoreBefore: number;
  scoreAfter: number;
  note: string;
};

const KEY = "lendsure_trust_ledger_v1";
const EVT_NAME = "lendsure-trust-updated";

function isBrowser() { return typeof window !== "undefined" && typeof localStorage !== "undefined"; }

function hashString(s: string) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }

// in-memory fallback so bun tests and SSR still show deltas within the same process
let memAll: TrustEvent[] | null = null;

function loadAll(): TrustEvent[] {
  if (isBrowser()) {
    try { const raw = localStorage.getItem(KEY); if (!raw) return memAll ? [...memAll] : []; const a = JSON.parse(raw); return Array.isArray(a) ? a as TrustEvent[] : (memAll ? [...memAll] : []); } catch { return memAll ? [...memAll] : []; }
  }
  return memAll ? [...memAll] : [];
}
function saveAll(list: TrustEvent[]) {
  memAll = [...list.slice(-800)];
  if (!isBrowser()) return;
  try { localStorage.setItem(KEY, JSON.stringify(memAll)); } catch {}
  try { window.dispatchEvent(new CustomEvent(EVT_NAME, { detail: memAll })); } catch {}
}

export function getTrustEvents(borrowerId: string): TrustEvent[] {
  return loadAll().filter(e => e.borrowerId === borrowerId).sort((a,b)=> new Date(a.at).getTime() - new Date(b.at).getTime());
}
export function getAllTrustEvents(): TrustEvent[] { return loadAll(); }

export function getDynamicDelta(borrowerId: string): number {
  return getTrustEvents(borrowerId).reduce((s,e)=> s + e.delta, 0);
}
export function getEffectiveTrust(borrowerId: string, baseScore: number): number {
  const d = getDynamicDelta(borrowerId);
  return Math.max(0, Math.min(100, Math.round(baseScore + d)));
}

// kinds and deltas — professional, conservative, cumulative
export function deltaForKind(kind: TrustKind, base: number): number {
  switch (kind) {
    case "REPAID_ON_TIME": return base >= 82 ? 3 : base >= 68 ? 5 : base >= 48 ? 7 : 9; // lower trust gets larger lift
    case "REPAID_LATE": return -6;
    case "DEFAULTED": return -18;
    case "APPROVED": return 1;
    case "MANUAL_BOOST": return 4;
    default: return 0;
  }
}

export function addTrustEvent(borrowerId: string, kind: TrustKind, baseScore: number, note?: string): TrustEvent {
  const before = getEffectiveTrust(borrowerId, baseScore);
  // deterministic jitter tiny — hash ensures same borrower not identical delta across browsers? Keep simple.
  const rawDelta = deltaForKind(kind, before);
  const after = Math.max(0, Math.min(100, before + rawDelta));
  const actualDelta = after - before;
  const ev: TrustEvent = {
    id: `${Date.now()}-${hashString(borrowerId + kind + String(Date.now()))}`,
    borrowerId,
    at: new Date().toISOString(),
    kind,
    delta: actualDelta,
    scoreBefore: before,
    scoreAfter: after,
    note: note || (kind === "REPAID_ON_TIME" ? "Loan repaid on schedule — trust lifted" : kind === "REPAID_LATE" ? "Repaid late — trust dipped" : kind === "DEFAULTED" ? "Default — sharp drop" : kind === "APPROVED" ? "New approval recorded" : "Manual adjustment"),
  };
  const all = loadAll();
  all.push(ev);
  saveAll(all);
  return ev;
}

export function clearTrustEvents(borrowerId?: string) {
  if (!borrowerId) {
    memAll = [];
    if (isBrowser()) { try { localStorage.removeItem(KEY); } catch {} try { window.dispatchEvent(new CustomEvent(EVT_NAME)); } catch {} }
    return;
  }
  const kept = loadAll().filter(e => e.borrowerId !== borrowerId);
  saveAll(kept);
}

// trajectory for chart — 7 monthly points ending at effective score
export type TrustPoint = { label: string; month: string; score: number; base: number; isEvent?: boolean; delta?: number };
export function getTrustTrajectory(borrowerId: string, baseScore: number, opts?: { months?: number }): TrustPoint[] {
  const months = opts?.months ?? 7;
  const events = getTrustEvents(borrowerId);
  const effective = getEffectiveTrust(borrowerId, baseScore);
  const now = new Date();
  // build monthly labels M6..now
  const labels: string[] = [];
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setMonth(now.getMonth() - i);
    labels.push(d.toLocaleString("en-IN", { month: "short" }));
  }
  // synthetic baseline: trust was building slowly toward baseScore, with small variance
  const h = hashString(borrowerId);
  const variance = ((h % 7) - 3); // -3..+3
  const startBase = Math.max(14, Math.min(92, baseScore - 10 + variance));
  // distribute events cumulatively — most recent month gets total delta, earlier months get partial
  // simple: first 6 months drift from startBase to baseScore linearly, last month is effective
  const pts: TrustPoint[] = [];
  for (let i = 0; i < months; i++) {
    const t = months > 1 ? i / (months - 1) : 1;
    // linear interpolation startBase -> baseScore for i < months-1, last point is effective
    const interpolated = i === months - 1 ? effective : Math.round(startBase + (baseScore - startBase) * t + Math.sin((h + i) * 0.9) * 1.1);
    pts.push({
      label: labels[i],
      month: labels[i],
      score: Math.max(0, Math.min(100, interpolated)),
      base: Math.max(0, Math.min(100, Math.round(startBase + (baseScore - startBase) * t))),
    });
  }
  // annotate last point if delta exists
  if (events.length && pts.length) {
    const last = pts[pts.length - 1];
    const totalDelta = effective - baseScore;
    if (totalDelta !== 0) {
      last.isEvent = true;
      last.delta = totalDelta;
    }
  }
  return pts;
}

export function getTrustHealth(borrowerId: string, baseScore: number) {
  const eff = getEffectiveTrust(borrowerId, baseScore);
  const delta = eff - baseScore;
  const events = getTrustEvents(borrowerId);
  const onTime = events.filter(e => e.kind === "REPAID_ON_TIME").length;
  const late = events.filter(e => e.kind === "REPAID_LATE").length;
  const defaults = events.filter(e => e.kind === "DEFAULTED").length;
  let momentum: "RISING" | "STABLE" | "FALLING" = "STABLE";
  if (delta >= 4) momentum = "RISING";
  else if (delta <= -4) momentum = "FALLING";
  // streak
  const streak = (() => {
    let s = 0;
    for (let i = events.length - 1; i >= 0; i--) {
      if (events[i].kind === "REPAID_ON_TIME") s++;
      else break;
    }
    return s;
  })();
  return { effective: eff, delta, eventsCount: events.length, onTime, late, defaults, momentum, streak };
}

// React hook — live re-renders when ledger changes
export function useDynamicTrust(borrowerId: string, baseScore: number) {
  const [delta, setDelta] = useState(() => getDynamicDelta(borrowerId));
  const [tick, setTick] = useState(0);

  const refresh = useCallback(() => {
    setDelta(getDynamicDelta(borrowerId));
    setTick(v => v + 1);
  }, [borrowerId]);

  useEffect(() => {
    refresh();
    const h = () => refresh();
    window.addEventListener(EVT_NAME, h as EventListener);
    window.addEventListener("storage", h);
    return () => {
      window.removeEventListener(EVT_NAME, h as EventListener);
      window.removeEventListener("storage", h);
    };
  }, [refresh]);

  const effective = Math.max(0, Math.min(100, Math.round(baseScore + delta)));
  const trajectory = getTrustTrajectory(borrowerId, baseScore);
  const health = getTrustHealth(borrowerId, baseScore);
  return { delta, effective, trajectory, health, tick, refresh };
}

export function useTrustLeaders(borrowers: { borrower_id: string; baseTrust: number }[], limit = 5) {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const h = () => setTick(v => v + 1);
    if (isBrowser()) {
      window.addEventListener(EVT_NAME, h as EventListener);
      return () => window.removeEventListener(EVT_NAME, h as EventListener);
    }
  }, []);
  const leaders = borrowers
    .map(b => ({ id: b.borrower_id, base: b.baseTrust, effective: getEffectiveTrust(b.borrower_id, b.baseTrust), delta: getDynamicDelta(b.borrower_id) }))
    .sort((a, b) => b.effective - a.effective || b.delta - a.delta)
    .slice(0, limit);
  return { leaders, tick };
}
