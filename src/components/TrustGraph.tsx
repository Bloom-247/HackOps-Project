import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Users, Shield, Link2, Star, AlertTriangle, CheckCircle2, TrendingUp, Sparkles, Info } from "lucide-react";
import type { Borrower } from "@/lib/trustLend";

type GraphNode = { id: string; label: string; kind: "center" | "trusted" | "neutral" | "flagged"; x: number; y: number; strength?: number };
type GraphEdge = { from: string; to: string; weight: number; dashed?: boolean };

function hashStr(s: string) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
function seededR(seed: number) { let t = seed >>> 0; return () => { t = (t + 0x6d2b79f5) | 0; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

function buildGraph(borrower: Borrower): { nodes: GraphNode[]; edges: GraphEdge[]; metrics: { trustRatio: number; density: number; flaggedShare: number; avgStrength: number } } {
  const h = hashStr(borrower.borrower_id);
  const rnd = seededR(h);
  const n = borrower.trust_network_size;
  const trusted = borrower.trusted_references;
  // we visualize up to 10 outer nodes for clarity, but count reflects real n
  const outerCount = Math.min(10, Math.max(4, n));
  // layout on a circle with slight radial jitter
  const cx = 50, cy = 50, r = 37;
  const nodes: GraphNode[] = [{ id: borrower.borrower_id, label: borrower.borrower_id, kind: "center", x: cx, y: cy }];
  const edges: GraphEdge[] = [];
  let flagged = 0;
  for (let i = 0; i < outerCount; i++) {
    const ang = (i / outerCount) * Math.PI * 2 - Math.PI / 2;
    const jitter = (rnd() - 0.5) * 6;
    const rr = r + jitter;
    const x = cx + Math.cos(ang) * rr;
    const y = cy + Math.sin(ang) * rr;
    // assign kinds round-robin by trusted count, with disputed adding a flagged node
    const isTrusted = i < trusted && i < outerCount;
    const makeFlagged = i === outerCount - 1 && borrower.disputed_transactions > 0 && !isTrusted;
    if (makeFlagged) flagged++;
    const kind: GraphNode["kind"] = makeFlagged ? "flagged" : isTrusted ? "trusted" : "neutral";
    const id = `${borrower.borrower_id}-N${i + 1}`;
    const strength = kind === "trusted" ? 0.78 + rnd() * 0.22 : kind === "flagged" ? 0.18 + rnd() * 0.18 : 0.45 + rnd() * 0.3;
    nodes.push({ id, label: kind === "flagged" ? "Flagged ref" : `Ref ${i + 1}`, kind, x, y, strength });
    edges.push({ from: borrower.borrower_id, to: id, weight: strength, dashed: kind === "flagged" });
    // add 1-2 secondary edges among outer nodes for realism
    if (i > 0 && rnd() < 0.42) {
      const j = Math.floor(rnd() * i);
      const other = nodes[j + 1]?.id;
      if (other) edges.push({ from: id, to: other, weight: 0.28 + rnd() * 0.35, dashed: rnd() < 0.18 });
    }
  }
  // if real n > outerCount, note hidden refs
  const trustRatio = n ? trusted / n : 0;
  const density = Math.min(1, edges.length / Math.max(1, outerCount * 1.1));
  const flaggedShare = n ? flagged / Math.max(1, n) : 0;
  const outer = nodes.slice(1);
  const avgStrength = outer.length ? outer.reduce((s, nd) => s + (nd.strength ?? 0.5), 0) / outer.length : 0.5;
  return { nodes, edges, metrics: { trustRatio, density, flaggedShare, avgStrength } };
}

function NodePill({ k }: { k: GraphNode["kind"] }) {
  if (k === "trusted") return <span className="inline-flex mono text-[10px] font-black bg-emerald-500 text-white px-1.5 py-0.5 rounded-full">Trusted</span>;
  if (k === "flagged") return <span className="inline-flex mono text-[10px] font-black bg-red-500 text-white px-1.5 py-0.5 rounded-full">Flagged</span>;
  if (k === "center") return <span className="inline-flex mono text-[10px] font-black bg-foreground text-white px-1.5 py-0.5 rounded-full">You</span>;
  return <span className="inline-flex mono text-[10px] font-black bg-white border px-1.5 py-0.5 rounded-full">Neutral</span>;
}

export function TrustNetworkGraph({ borrower, effectiveTrust, baseTrust }: { borrower: Borrower; effectiveTrust: number; baseTrust: number }) {
  const { nodes, edges, metrics } = useMemo(() => buildGraph(borrower), [borrower]);
  const delta = effectiveTrust - baseTrust;
  const [hover, setHover] = useState<string | null>(null);
  const hovered = hover ? nodes.find(n => n.id === hover) : null;

  const analysisTone =
    metrics.trustRatio >= 0.62 ? "Strong" :
    metrics.trustRatio >= 0.38 ? "Mixed" : "Weak";
  const densityTone = metrics.density >= 0.72 ? "Dense" : metrics.density >= 0.42 ? "Moderate" : "Sparse";

  return (
    <div className="premium-card overflow-hidden">
      <div className="px-5 sm:px-6 py-4 flex flex-wrap items-start justify-between gap-3 border-b bg-gradient-to-br from-white to-muted/20">
        <div>
          <p className="mono text-xs font-black tracking-[0.14em] text-primary flex items-center gap-2"><Users className="w-4 h-4" /> TRUST NETWORK — GRAPHICAL ANALYSIS</p>
          <h3 className="mt-1 text-[18px] font-black leading-none">Who vouches — and how strongly</h3>
          <p className="mono text-xs font-bold text-muted-foreground mt-1">{borrower.trusted_references} trusted of {borrower.trust_network_size} refs • {borrower.disputed_transactions} disputed • {borrower.city}</p>
        </div>
        <div className="flex flex-wrap gap-1.5 items-center">
          <span className="mono text-xs font-black bg-foreground text-white px-3 py-1.5 rounded-full">{effectiveTrust}<span className="opacity-60">/100</span> Trust</span>
          {delta !== 0 && <span className={`mono text-xs font-black px-2.5 py-1.5 rounded-full border ${delta > 0 ? "bg-emerald-50 border-emerald-200 text-emerald-800" : "bg-red-50 border-red-200 text-red-700"}`}>{delta > 0 ? "+" : ""}{delta} live</span>}
        </div>
      </div>

      <div className="grid lg:grid-cols-[1.15fr_0.85fr] gap-0">
        {/* Graph */}
        <div className="p-4 sm:p-5 bg-[#FCFCF9] border-b lg:border-b-0 lg:border-r">
          <div className="relative aspect-[1.35] sm:aspect-[1.45] w-full rounded-2xl border bg-white overflow-hidden">
            <svg viewBox="0 0 100 100" className="absolute inset-0 w-full h-full">
              <defs>
                <radialGradient id={`g-${borrower.borrower_id}`} cx="50%" cy="50%"><stop offset="0%" stopColor="#0f172a" stopOpacity={0.06} /><stop offset="100%" stopColor="#0f172a" stopOpacity={0} /></radialGradient>
              </defs>
              <circle cx="50" cy="50" r="44" fill={`url(#g-${borrower.borrower_id})`} />
              <circle cx="50" cy="50" r="39" fill="none" stroke="#e2e8f0" strokeWidth={0.6} strokeDasharray="1.2 2" opacity={0.9} />
              <circle cx="50" cy="50" r="25" fill="none" stroke="#e2e8f0" strokeWidth={0.4} strokeDasharray="1 2" opacity={0.7} />
              {edges.map((e, i) => {
                const a = nodes.find(x => x.id === e.from)!;
                const b = nodes.find(x => x.id === e.to)!;
                const isCenter = e.from === borrower.borrower_id || e.to === borrower.borrower_id;
                const op = isCenter ? 0.55 + e.weight * 0.45 : 0.18 + e.weight * 0.28;
                return (
                  <line
                    key={`${e.from}-${e.to}-${i}`}
                    x1={a.x} y1={a.y} x2={b.x} y2={b.y}
                    stroke={isCenter ? (e.dashed ? "#ef4444" : "#0f172a") : "#94a3b8"}
                    strokeWidth={isCenter ? 0.95 + e.weight * 0.9 : 0.55}
                    strokeDasharray={e.dashed ? "1.6 1.4" : undefined}
                    opacity={op}
                    strokeLinecap="round"
                  />
                );
              })}
              {nodes.map(n => {
                const isH = hover === n.id;
                const isCenter = n.kind === "center";
                const fill = n.kind === "trusted" ? "#10b981" : n.kind === "flagged" ? "#ef4444" : n.kind === "center" ? "#0f172a" : "#ffffff";
                const stroke = n.kind === "neutral" ? "#cbd5e1" : n.kind === "center" ? "#0f172a" : fill;
                const rNode = isCenter ? 6.2 : 4.2;
                return (
                  <g
                    key={n.id}
                    onMouseEnter={() => setHover(n.id)}
                    onMouseLeave={() => setHover(null)}
                    onFocus={() => setHover(n.id)}
                    tabIndex={0}
                    style={{ cursor: "pointer" }}
                  >
                    {isCenter && <circle cx={n.x} cy={n.y} r={10.5} fill="#0f172a" opacity={0.06} />}
                    <circle
                      cx={n.x} cy={n.y} r={rNode + (isH ? 1.1 : 0)}
                      fill={fill}
                      stroke={stroke}
                      strokeWidth={isCenter ? 1.2 : 0.9}
                      opacity={isH ? 1 : n.kind === "trusted" ? 0.98 : 1}
                    />
                    {/* inner dot for neutral to hint border */}
                    {n.kind === "neutral" && <circle cx={n.x} cy={n.y} r={1.15} fill="#94a3b8" />}
                    {isCenter && <text x={n.x} y={n.y + 0.65} textAnchor="middle" fontSize={3.2} fontWeight={900} fill="white">●</text>}
                  </g>
                );
              })}
            </svg>
            {/* floating tooltip */}
            {hovered && (
              <div className="absolute left-3 right-3 bottom-3 rounded-2xl border bg-foreground text-white px-3.5 py-2.5 flex items-center justify-between gap-3 shadow-lg">
                <div className="min-w-0">
                  <p className="mono text-xs font-black flex items-center gap-2">{hovered.label} <NodePill k={hovered.kind} /></p>
                  <p className="text-xs font-bold text-white/70 mt-0.5 truncate">{hovered.kind === "center" ? `${borrower.city} • ${borrower.employment_type}` : hovered.kind === "trusted" ? `Backer strength ${Math.round((hovered.strength ?? 0) * 100)}% • reliable` : hovered.kind === "flagged" ? "Disputed — verify manually" : "Neutral — no signal"}</p>
                </div>
                <span className="mono text-xs font-black bg-white/10 border border-white/15 px-2.5 py-1 rounded-full shrink-0">{hovered.kind === "center" ? `${effectiveTrust}` : hovered.strength ? `${Math.round((hovered.strength) * 100)}%` : "—"}</span>
              </div>
            )}
            {!hovered && borrower.trust_network_size > 10 && (
              <div className="absolute left-3 bottom-3 mono text-xs font-bold bg-white/90 backdrop-blur border px-2.5 py-1.5 rounded-full">+{borrower.trust_network_size - Math.min(10, borrower.trust_network_size)} more refs not plotted</div>
            )}
          </div>
          <div className="mt-3 flex flex-wrap gap-1.5 mono text-xs font-black">
            <span className="inline-flex items-center gap-1.5 border bg-white px-2.5 py-1 rounded-full"><span className="w-2.5 h-2.5 rounded-full bg-foreground" /> Center</span>
            <span className="inline-flex items-center gap-1.5 border bg-emerald-50 border-emerald-200 px-2.5 py-1 rounded-full"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> Trusted ({borrower.trusted_references})</span>
            <span className="inline-flex items-center gap-1.5 border bg-white px-2.5 py-1 rounded-full"><span className="w-2.5 h-2.5 rounded-full bg-white border" /> Neutral</span>
            {borrower.disputed_transactions > 0 && <span className="inline-flex items-center gap-1.5 border bg-red-50 border-red-200 px-2.5 py-1 rounded-full"><span className="w-2.5 h-2.5 rounded-full bg-red-500" /> Flagged</span>}
          </div>
        </div>

        {/* Analysis */}
        <div className="p-5 sm:p-6 space-y-4">
          <div className="rounded-2xl border bg-muted/20 p-4">
            <p className="mono text-xs font-black flex items-center gap-1.5"><Shield className="w-3.5 h-3.5 text-primary" /> GRAPH ANALYSIS — PER USER</p>
            <div className="mt-3 grid grid-cols-3 gap-2 mono text-xs font-black text-center">
              <span className="rounded-2xl border bg-white p-3">
                <span className={`inline-flex px-2 py-1 rounded-full border text-[11px] ${metrics.trustRatio >= 0.62 ? "bg-emerald-500 text-white border-emerald-500" : metrics.trustRatio >= 0.38 ? "bg-amber-400 border-amber-400" : "bg-red-500 text-white border-red-500"}`}>{analysisTone}</span>
                <span className="block mt-1.5 text-[11px]">Trust ratio</span>
                <span className="block text-sm font-black">{Math.round(metrics.trustRatio * 100)}%</span>
              </span>
              <span className="rounded-2xl border bg-white p-3">
                <span className="block text-[11px] text-muted-foreground">{densityTone}</span>
                <span className="block mt-1 text-sm font-black">{Math.round(metrics.density * 100)}%</span>
                <span className="block text-[11px]">Network density</span>
              </span>
              <span className="rounded-2xl border bg-white p-3">
                <span className="block text-[11px] text-muted-foreground">Avg strength</span>
                <span className="block mt-1 text-sm font-black">{Math.round(metrics.avgStrength * 100)}%</span>
                <span className={`inline-flex mt-1 px-2 py-0.5 rounded-full border text-[11px] ${borrower.disputed_transactions ? "bg-red-50 border-red-200 text-red-700" : "bg-emerald-50 border-emerald-200"}`}>{borrower.disputed_transactions ? `${borrower.disputed_transactions} disputed` : "No disputes"}</span>
              </span>
            </div>
            <div className="mt-3 rounded-2xl border bg-white p-3 mono text-xs font-bold leading-5">
              {metrics.trustRatio >= 0.62 ? (
                <span className="flex gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" /><span><b>{analysisTone} network:</b> {borrower.trusted_references} of {borrower.trust_network_size} vouch with high strength — add up to <b>+9 trust points</b> in the model.</span></span>
              ) : metrics.trustRatio >= 0.38 ? (
                <span className="flex gap-2"><Link2 className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" /><span><b>{analysisTone}:</b> only {borrower.trusted_references} trusted — mixed verification, check bank + docs before lending.</span></span>
              ) : (
                <span className="flex gap-2"><AlertTriangle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" /><span><b>{analysisTone}:</b> weak backing and {borrower.disputed_transactions} disputed — network alone would dock trust.</span></span>
              )}
            </div>
            {borrower.trust_network_size > Math.min(10, borrower.trust_network_size) && (
              <p className="mono text-xs font-bold text-muted-foreground mt-2">Showing {Math.min(10, borrower.trust_network_size)} of {borrower.trust_network_size} refs — model uses all {borrower.trust_network_size}.</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2 mono text-xs font-black">
            <span className="rounded-2xl border bg-white p-3 text-center"><span className="text-muted-foreground">Trusted</span><br /><span className="text-[18px] font-black">{borrower.trusted_references}</span><br />of {borrower.trust_network_size}</span>
            <span className="rounded-2xl border bg-white p-3 text-center"><span className="text-muted-foreground">Disputed</span><br /><span className={`text-[18px] font-black ${borrower.disputed_transactions ? "text-red-600" : "text-emerald-600"}`}>{borrower.disputed_transactions}</span><br />tx flagged</span>
          </div>

          <div className="rounded-2xl border bg-amber-50/50 p-3 flex gap-2.5 items-start">
            <Info className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
            <p className="mono text-xs font-bold leading-5"><b>How the model uses this:</b> trusted refs + density + disputed + verification together move Trust by up to ~9 points. Repayment still dominates — network alone never flips LOW → HIGH.</p>
          </div>

          <div className="flex gap-2">
            <span className="flex-1 h-9 rounded-full border bg-muted/20 mono text-xs font-black inline-flex items-center justify-center gap-1.5"><Star className="w-3.5 h-3.5 text-primary" /> {metrics.trustRatio >= 0.62 ? "Strong backers" : metrics.trustRatio >= 0.38 ? "Patchy backing" : "Weak backing"}</span>
            <span className="h-9 px-3 rounded-full bg-foreground text-white mono text-xs font-black inline-flex items-center gap-1.5"><TrendingUp className="w-3.5 h-3.5" /> {densityTone}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export function TrustNetworkMini({ borrower, effectiveTrust }: { borrower: Borrower; effectiveTrust: number }) {
  const { nodes, edges } = useMemo(() => buildGraph(borrower), [borrower]);
  return (
    <div className="rounded-2xl border bg-white overflow-hidden">
      <div className="px-4 py-2.5 flex items-center justify-between border-b bg-muted/20">
        <span className="mono text-xs font-black flex items-center gap-1.5"><Users className="w-3.5 h-3.5 text-primary" /> Network</span>
        <span className="mono text-xs font-black bg-foreground text-white px-2 py-1 rounded-full">{borrower.trusted_references}/{borrower.trust_network_size} • {effectiveTrust}</span>
      </div>
      <div className="relative aspect-[1.45] bg-[#FCFCF9]">
        <svg viewBox="0 0 100 100" className="absolute inset-0 w-full h-full">
          <circle cx="50" cy="50" r="38.5" fill="none" stroke="#e2e8f0" strokeWidth={0.7} strokeDasharray="1.2 2" />
          {edges.slice(0, 14).map((e, i) => {
            const a = nodes.find(x => x.id === e.from)!; const b = nodes.find(x => x.id === e.to)!;
            return <line key={i} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={e.dashed ? "#ef4444" : "#0f172a"} strokeWidth={0.7} opacity={0.45} strokeDasharray={e.dashed ? "1.2 1.2" : undefined} />;
          })}
          {nodes.map(n => (
            <circle key={n.id} cx={n.x} cy={n.y} r={n.kind === "center" ? 5.2 : 3.55} fill={n.kind === "trusted" ? "#10b981" : n.kind === "flagged" ? "#ef4444" : n.kind === "center" ? "#0f172a" : "#fff"} stroke={n.kind === "neutral" ? "#cbd5e1" : n.kind === "center" ? "#0f172a" : n.kind === "trusted" ? "#10b981" : "#ef4444"} strokeWidth={0.7} />
          ))}
        </svg>
      </div>
    </div>
  );
}
