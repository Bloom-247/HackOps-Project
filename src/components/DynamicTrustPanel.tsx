import { useMemo, useCallback } from "react";
import { TrendingUp, TrendingDown, Minus, Zap, Award, History, RotateCcw, Sparkles, ArrowUpRight, Clock3 } from "lucide-react";
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, DotProps } from "recharts";
import { useQuery, useMutation, useConvexAuth } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useDynamicTrust, getTrustEvents, addTrustEvent, clearTrustEvents, deltaForKind } from "@/lib/dynamicTrust";
import type { Borrower } from "@/lib/trustLend";

function Tone({ momentum }: { momentum: "RISING" | "STABLE" | "FALLING" }) {
  if (momentum === "RISING") return <span className="inline-flex items-center gap-1 mono text-xs font-black bg-emerald-500 text-white px-2.5 py-1 rounded-full"><TrendingUp className="w-3.5 h-3.5" /> Rising</span>;
  if (momentum === "FALLING") return <span className="inline-flex items-center gap-1 mono text-xs font-black bg-red-500 text-white px-2.5 py-1 rounded-full"><TrendingDown className="w-3.5 h-3.5" /> Falling</span>;
  return <span className="inline-flex items-center gap-1 mono text-xs font-black bg-amber-400 border border-amber-400 px-2.5 py-1 rounded-full"><Minus className="w-3.5 h-3.5" /> Stable</span>;
}

export function DynamicTrustHero({ borrower, baseTrust }: { borrower: Borrower; baseTrust: number }) {
  const { isAuthenticated } = useConvexAuth();
  const local = useDynamicTrust(borrower.borrower_id, baseTrust);
  const serverEvents = useQuery(api.lendsure.listTrustEvents, { borrowerId: borrower.borrower_id }) as unknown as { _id: string; borrowerId: string; kind: string; delta: number; scoreBefore: number; scoreAfter: number; note: string; at: number }[] | undefined;
  const addServerTrust = useMutation(api.lendsure.addTrustEvent);
  const clearServerTrust = useMutation(api.lendsure.clearTrustEvents);

  const serverDelta = useMemo(() => (serverEvents ?? []).reduce((s, e) => s + e.delta, 0), [serverEvents]);
  const serverCount = serverEvents?.length ?? 0;
  // When signed in, server is source of truth; otherwise use local. Merge display so nothing is lost during migration.
  const mergedDelta = isAuthenticated ? serverDelta + (serverCount === 0 ? local.delta : 0) : local.delta;
  const effective = Math.max(0, Math.min(100, baseTrust + mergedDelta));
  // merge ledger for display: server events (with timestamp) + local events
  const localEvents = useMemo(() => getTrustEvents(borrower.borrower_id), [borrower.borrower_id, local.health.eventsCount, local.tick]);
  const mergedLedger = useMemo(() => {
    const s = (serverEvents ?? []).map((e) => ({
      id: String(e._id),
      borrowerId: e.borrowerId,
      kind: e.kind as never,
      delta: e.delta,
      scoreBefore: e.scoreBefore,
      scoreAfter: e.scoreAfter,
      note: e.note,
      at: new Date(e.at).toISOString(),
      source: "server" as const,
    }));
    const l = localEvents.map((e) => ({ ...e, source: "local" as const }));
    // if server has data, prefer server; otherwise show local; if both, show server + local (server first)
    const combined = [...s, ...l].sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());
    // dedupe if serverCount >0, hide local to avoid double-count confusion
    if (isAuthenticated && s.length) return s.slice().reverse();
    return combined.slice().reverse();
  }, [serverEvents, localEvents, isAuthenticated]);

  const momentum: "RISING" | "STABLE" | "FALLING" = mergedDelta >= 4 ? "RISING" : mergedDelta <= -4 ? "FALLING" : "STABLE";
  const streak = useMemo(() => {
    const arr = (serverEvents ?? []).length ? (serverEvents ?? []) : (localEvents as unknown as { kind: string }[]);
    let s = 0;
    for (let i = arr.length - 1; i >= 0; i--) {
      if ((arr[i] as { kind: string }).kind === "REPAID_ON_TIME") s++;
      else break;
    }
    return s;
  }, [serverEvents, localEvents]);

  // trajectory should end at merged effective
  const trajectory = useMemo(() => {
    const pts = local.trajectory.map((p, i, arr) => (i === arr.length - 1 ? { ...p, score: effective, delta: mergedDelta } : p));
    return pts;
  }, [local.trajectory, effective, mergedDelta]);

  const handleRepaid = useCallback(async () => {
    const before = effective;
    const d = deltaForKind("REPAID_ON_TIME", before);
    const after = Math.max(0, Math.min(100, before + d));
    if (isAuthenticated) {
      try {
        await addServerTrust({ borrowerId: borrower.borrower_id, kind: "REPAID_ON_TIME", delta: after - before, scoreBefore: before, scoreAfter: after, note: "Loan repaid on schedule — trust lifted" });
        return;
      } catch {
        // fallback to local
      }
    }
    addTrustEvent(borrower.borrower_id, "REPAID_ON_TIME", baseTrust);
    local.refresh();
  }, [borrower.borrower_id, baseTrust, effective, isAuthenticated, addServerTrust, local]);

  const handleLate = useCallback(async () => {
    const before = effective;
    const d = deltaForKind("REPAID_LATE", before);
    const after = Math.max(0, Math.min(100, before + d));
    if (isAuthenticated) {
      try {
        await addServerTrust({ borrowerId: borrower.borrower_id, kind: "REPAID_LATE", delta: after - before, scoreBefore: before, scoreAfter: after, note: "Repaid late — trust dipped" });
        return;
      } catch {}
    }
    addTrustEvent(borrower.borrower_id, "REPAID_LATE", baseTrust);
    local.refresh();
  }, [borrower.borrower_id, baseTrust, effective, isAuthenticated, addServerTrust, local]);

  const handleClear = useCallback(async () => {
    if (isAuthenticated) {
      try {
        await clearServerTrust({ borrowerId: borrower.borrower_id });
      } catch {}
    }
    clearTrustEvents(borrower.borrower_id);
    local.refresh();
  }, [borrower.borrower_id, isAuthenticated, clearServerTrust, local]);

  const onTime = (serverEvents ?? []).length ? (serverEvents ?? []).filter((e) => e.kind === "REPAID_ON_TIME").length : local.health.onTime;

  return (
    <div className="premium-card overflow-hidden">
      <div className="px-5 sm:px-6 py-4 flex flex-wrap items-start justify-between gap-3 bg-gradient-to-br from-white via-white to-primary/5 border-b">
        <div>
          <p className="mono text-xs font-black tracking-[0.14em] text-primary flex items-center gap-2"><Sparkles className="w-4 h-4" /> DYNAMIC TRUST — GROWS WITH REPAYMENT</p>
          <h3 className="mt-1 text-[20px] font-black leading-none tracking-tight">Every on-time repayment lifts the score. Properly.</h3>
          <p className="mono text-xs font-bold text-muted-foreground mt-1.5">
            Base {baseTrust} {mergedDelta !== 0 && (mergedDelta > 0 ? `+ ${mergedDelta}` : `• ${mergedDelta}`)} = <b className="text-foreground">{effective}/100</b> • {onTime} on-time • streak {streak} {isAuthenticated ? "• persisted" : "• local"}
          </p>
        </div>
        <Tone momentum={momentum} />
      </div>

      <div className="grid lg:grid-cols-[1.35fr_0.95fr] gap-0">
        <div className="p-5 sm:p-6 border-b lg:border-b-0 lg:border-r">
          <div className="flex items-center justify-between">
            <p className="mono text-xs font-black">TRAJECTORY • 7 MONTHS</p>
            <span className="mono text-xs font-bold text-muted-foreground flex items-center gap-1"><Clock3 className="w-3 h-3" /> ends at {effective}</span>
          </div>
          <div className="mt-4 h-[184px] rounded-2xl border bg-white p-2">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trajectory} margin={{ left: 6, right: 10, top: 8, bottom: 0 }}>
                <defs>
                  <linearGradient id={`trustFill-${borrower.borrower_id}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#0f172a" stopOpacity={0.22} />
                    <stop offset="100%" stopColor="#0f172a" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="label" tick={{ fontSize: 11, fontWeight: 800, fill: "#64748b" }} axisLine={false} tickLine={false} interval={0} />
                <YAxis domain={[0, 100]} hide />
                <Tooltip contentStyle={{ borderRadius: 16, border: "1px solid #e2e8f0", fontWeight: 800, fontSize: 12 }} formatter={(v: number) => [`${v}/100`, "Trust"]} />
                <Area type="monotone" dataKey="score" stroke="#0f172a" strokeWidth={2.6} fill={`url(#trustFill-${borrower.borrower_id})`} dot={({ cx, cy, payload }: DotProps & { payload?: { isEvent?: boolean } }) => (payload?.isEvent ? <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r={5} fill="#10b981" stroke="white" strokeWidth={2} /> : <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r={2.7} fill="#0f172a" opacity={0.9} />)} activeDot={{ r: 5 }} />
                <Area type="monotone" dataKey="base" stroke="#94a3b8" strokeWidth={1.15} strokeDasharray="4 4" dot={false} fill="none" opacity={0.7} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2 mono text-xs font-black text-center">
            <span className="rounded-2xl border bg-white py-2.5"><span className="text-muted-foreground">Base (model)</span><br /><span className="text-[18px]">{baseTrust}</span></span>
            <span className={`rounded-2xl border py-2.5 ${mergedDelta > 0 ? "bg-emerald-50 border-emerald-200" : mergedDelta < 0 ? "bg-red-50 border-red-200" : "bg-white"}`}>
              <span className={mergedDelta > 0 ? "text-emerald-700" : mergedDelta < 0 ? "text-red-600" : "text-muted-foreground"}>Live delta</span><br />
              <span className="text-[18px]">{mergedDelta > 0 ? `+${mergedDelta}` : mergedDelta}</span>
            </span>
            <span className="rounded-2xl border bg-foreground text-white py-2.5"><span className="text-white/60">Effective</span><br /><span className="text-[18px]">{effective}</span></span>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <button onClick={handleRepaid} className="flex-1 min-w-[140px] h-11 rounded-full bg-emerald-500 text-white font-black text-sm inline-flex items-center justify-center gap-2 hover:bg-emerald-600">
              <Award className="w-4 h-4" /> Simulate: repaid on time (+{baseTrust >= 82 ? 3 : baseTrust >= 68 ? 5 : 7}→)
            </button>
            <button onClick={handleLate} className="h-11 px-5 rounded-full border bg-white font-black text-sm inline-flex items-center gap-1.5 hover:bg-muted"><TrendingDown className="w-4 h-4" /> Repaid late</button>
          </div>
          {streak >= 2 && (
            <p className="mt-3 mono text-xs font-black bg-emerald-50 border border-emerald-200 text-emerald-800 px-3 py-2 rounded-full inline-flex gap-2 items-center"><Zap className="w-3.5 h-3.5" /> {streak}-loan on-time streak — loyalty compounds trust</p>
          )}
        </div>

        <div className="p-5 sm:p-6 space-y-4">
          <div className="rounded-2xl border bg-muted/20 p-4">
            <p className="mono text-xs font-black flex items-center gap-2"><History className="w-4 h-4 text-primary" /> HEALTH & MOMENTUM</p>
            <div className="mt-3 grid grid-cols-3 gap-2 mono text-xs font-black text-center">
              <span className="rounded-2xl border bg-white p-3"><span className="text-[18px]">{onTime}</span><br />On-time</span>
              <span className="rounded-2xl border bg-white p-3"><span className="text-[18px]">{local.health.late}</span><br />Late</span>
              <span className={`rounded-2xl border p-3 ${local.health.defaults ? "bg-red-500 text-white border-red-500" : "bg-white"}`}><span className="text-[18px]">{local.health.defaults}</span><br />Defaults</span>
            </div>
            <div className="mt-3 h-2 bg-white border rounded-full overflow-hidden"><div className="h-full bg-foreground rounded-full transition-all" style={{ width: `${effective}%` }} /></div>
            <p className="mono text-xs font-bold text-muted-foreground mt-2">Persisted to your team — survives refresh, shared with teammates. Lower base gets a bigger lift next time.</p>
          </div>

          <div className="rounded-2xl border bg-white p-4">
            <div className="flex items-center justify-between">
              <p className="mono text-xs font-black">LEDGER — {mergedLedger.length ? `${mergedLedger.length} events` : "No repayments yet"}</p>
              {mergedLedger.length > 0 && (
                <button onClick={handleClear} className="mono text-xs font-black border px-2.5 py-1 rounded-full hover:bg-muted inline-flex gap-1 items-center"><RotateCcw className="w-3 h-3" /> Reset</button>
              )}
            </div>
            {mergedLedger.length === 0 ? (
              <div className="mt-3 rounded-2xl border bg-muted/30 p-4 mono text-xs font-bold text-muted-foreground">
                No history yet for {borrower.borrower_id}. Tap <b className="text-foreground">repaid on time</b> — it is saved to the server and appears everywhere.
              </div>
            ) : (
              <div className="mt-3 max-h-[168px] overflow-auto pr-1 space-y-2">
                {mergedLedger.slice(0, 6).map((ev) => (
                  <div key={ev.id} className={`rounded-2xl border p-3 flex items-start justify-between gap-3 ${ev.delta > 0 ? "bg-emerald-50/60 border-emerald-100" : ev.delta < 0 ? "bg-red-50/60 border-red-100" : "bg-muted/20"}`}>
                    <div className="min-w-0">
                      <p className="mono text-xs font-black flex items-center gap-1.5">
                        {ev.kind === "REPAID_ON_TIME" ? <Award className="w-3.5 h-3.5 text-emerald-600" /> : ev.kind === "REPAID_LATE" ? <TrendingDown className="w-3.5 h-3.5 text-amber-600" /> : <span className="w-2 h-2 rounded-full bg-foreground" />}
                        {String(ev.kind).replace(/_/g, " ")}
                        <span className={`px-1.5 py-0.5 rounded-full border text-[10px] ${ev.delta > 0 ? "bg-emerald-500 text-white border-emerald-500" : ev.delta < 0 ? "bg-red-500 text-white border-red-500" : "bg-white"}`}>{ev.delta > 0 ? `+${ev.delta}` : ev.delta}</span>
                      </p>
                      <p className="text-xs font-bold leading-5 mt-1 line-clamp-2">{ev.note}</p>
                      <p className="mono text-[11px] font-bold text-muted-foreground mt-1">{new Date(ev.at).toLocaleString()} • {ev.scoreBefore} → {ev.scoreAfter} {(ev as { source?: string }).source === "server" ? "• server" : "• local"}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <p className="mono text-xs font-bold text-muted-foreground flex gap-2"><ArrowUpRight className="w-3.5 h-3.5 shrink-0 text-primary" /> Catalog badges and leaders update live from the same server ledger.</p>
        </div>
      </div>
    </div>
  );
}

export function DynamicTrustStrip({ borrower, baseTrust }: { borrower: Borrower; baseTrust: number }) {
  const { isAuthenticated } = useConvexAuth();
  const local = useDynamicTrust(borrower.borrower_id, baseTrust);
  const serverEvents = useQuery(api.lendsure.listTrustEvents, { borrowerId: borrower.borrower_id }) as unknown as { delta: number }[] | undefined;
  const serverDelta = (serverEvents ?? []).reduce((s, e) => s + e.delta, 0);
  const delta = isAuthenticated && (serverEvents?.length ?? 0) > 0 ? serverDelta : local.delta;
  const eventsCount = isAuthenticated && (serverEvents?.length ?? 0) > 0 ? serverEvents!.length : local.health.eventsCount;
  if (delta === 0 && eventsCount === 0) return null;
  return (
    <div className={`rounded-2xl border px-3.5 py-2.5 flex flex-wrap items-center gap-2 mono text-xs font-black ${delta > 0 ? "bg-emerald-50 border-emerald-200 text-emerald-800" : delta < 0 ? "bg-red-50 border-red-200 text-red-700" : "bg-white"}`}>
      <span className={`w-2 h-2 rounded-full ${delta > 0 ? "bg-emerald-500 animate-pulse" : delta < 0 ? "bg-red-500" : "bg-amber-400"}`} />
      Dynamic: {baseTrust} → {Math.max(0, Math.min(100, baseTrust + delta))} {delta > 0 ? `(+${delta} • persisted)` : delta < 0 ? `(${delta})` : ""} {eventsCount ? `• ${eventsCount} event${eventsCount > 1 ? "s" : ""}` : ""}
    </div>
  );
}

export function TrustLeadersCard({ borrowers }: { borrowers: { borrower_id: string; city: string; baseTrust: number }[] }) {
  const trustAll = useQuery(api.lendsure.listAllTrustEvents) as unknown as { borrowerId: string; delta: number }[] | undefined;
  const enriched = useMemo(() => {
    const map = new Map<string, number>();
    for (const e of trustAll ?? []) map.set(e.borrowerId, (map.get(e.borrowerId) ?? 0) + e.delta);
    const withEff = borrowers
      .map((b) => {
        const serverDelta = map.get(b.borrower_id) ?? 0;
        let localDelta = 0;
        try {
          const raw = localStorage.getItem("lendsure_trust_ledger_v1");
          if (raw) {
            const arr = JSON.parse(raw) as { borrowerId: string; delta: number }[];
            localDelta = arr.filter((x) => x.borrowerId === b.borrower_id).reduce((s, x) => s + x.delta, 0);
          }
        } catch {}
        const delta = (trustAll?.length ? serverDelta : 0) + (!trustAll?.length ? localDelta : serverDelta ? 0 : localDelta);
        const eff = Math.max(0, Math.min(100, Math.round(b.baseTrust + delta)));
        return { id: b.borrower_id, city: b.city, base: b.baseTrust, delta, eff };
      })
      .sort((a, b) => b.eff - a.eff)
      .slice(0, 5);
    return withEff;
  }, [borrowers, trustAll]);

  return (
    <div className="premium-card p-5">
      <p className="mono text-xs font-black flex items-center gap-2"><Award className="w-4 h-4 text-primary" /> TRUST LEADERS — LIVE</p>
      <p className="mono text-xs font-bold text-muted-foreground mt-1">Ranked by effective trust (base + earned • server)</p>
      <div className="mt-3 space-y-2">
        {enriched.map((r, i) => (
          <div key={r.id} className={`rounded-2xl border px-3 py-2.5 flex items-center gap-3 ${i === 0 ? "bg-foreground text-white border-foreground" : "bg-white"}`}>
            <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-black shrink-0 ${i === 0 ? "bg-white text-foreground" : i === 1 ? "bg-amber-400" : i === 2 ? "bg-zinc-300" : "bg-muted"}`}>{i + 1}</span>
            <div className="min-w-0">
              <p className="mono text-xs font-black leading-none">{r.id}</p>
              <p className={`text-xs font-bold ${i === 0 ? "text-white/70" : "text-muted-foreground"}`}>{r.city} • base {r.base} {r.delta ? `→ ${r.eff}` : ""}</p>
            </div>
            <span className={`ml-auto mono text-xs font-black px-2.5 py-1 rounded-full border ${i === 0 ? "bg-white text-foreground border-white" : r.delta > 0 ? "bg-emerald-50 border-emerald-200 text-emerald-800" : "bg-white"}`}>{r.eff}</span>
          </div>
        ))}
      </div>
      <p className="mono text-xs font-bold text-muted-foreground mt-3 flex gap-2"><Sparkles className="w-3 h-3 text-primary shrink-0" /> Repay on time pushes a borrower up this board instantly — saved to your team.</p>
    </div>
  );
}
