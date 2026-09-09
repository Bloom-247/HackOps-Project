import { useMemo, useState } from "react";
import { Link, useParams } from "react-router";
import { ArrowLeft, MessageSquare, Send, CalendarRange, FileCheck, Shield, AlertTriangle, Clock3, CheckCircle2, ScanLine, Building2, Landmark, ExternalLink, Award, RotateCcw, CloudCheck, LockKeyhole } from "lucide-react";
import { analyzeBorrower, getBorrowerById, formatINR, type Borrower } from "@/lib/trustLend";
import { useMarketLive } from "@/lib/marketLive";
import { MarketNewsFeed, MarketPulseStrip } from "@/components/MarketPulse";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TrustNetworkGraph } from "@/components/TrustGraph";
import { DynamicTrustHero, DynamicTrustStrip } from "@/components/DynamicTrustPanel";
import { getDynamicDelta, addTrustEvent, clearTrustEvents, deltaForKind } from "@/lib/dynamicTrust";
import { useAuth } from "@/hooks/use-auth";
import { useQuery, useMutation, useConvexAuth } from "convex/react";
import { api } from "@/convex/_generated/api";

function adaptBorrowerDoc(doc: Record<string, unknown>): Borrower {
  const { _id, _creationTime, ownerId, ...rest } = doc as Record<string, unknown> & { _id: unknown; ownerId: unknown };
  return rest as unknown as Borrower;
}

export default function BorrowerDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const { isAuthenticated } = useConvexAuth();
  const market = useMarketLive();
  const marketCtx = useMemo(() => ({ repoRate: market.repoRate, sentimentScore: market.sentimentScore, headline: market.headline }), [market.repoRate, market.sentimentScore, market.headline]);

  // Server borrower (persisted per team) + synthetic fallback
  const serverDoc = useQuery(api.lendsure.getBorrower, id ? { borrowerId: id } : ("skip" as never)) as unknown as Record<string, unknown> | null | undefined;
  const synthetic = id ? getBorrowerById(id) : undefined;
  const borrower: Borrower | undefined = useMemo(() => {
    if (serverDoc && (serverDoc as Record<string, unknown>).borrower_id) return adaptBorrowerDoc(serverDoc as Record<string, unknown>);
    return synthetic;
  }, [serverDoc, synthetic]);

  const baseAnalysis = useMemo(() => (borrower ? analyzeBorrower(borrower, undefined, marketCtx) : null), [borrower, marketCtx]);

  // Trust ledger — server is source of truth when signed in
  const serverTrustEvents = useQuery(api.lendsure.listTrustEvents, borrower ? { borrowerId: borrower.borrower_id } : ("skip" as never)) as unknown as { borrowerId: string; kind: string; delta: number; scoreBefore: number; scoreAfter: number; note: string; at: number }[] | undefined;
  const addServerTrust = useMutation(api.lendsure.addTrustEvent);
  const clearServerTrust = useMutation(api.lendsure.clearTrustEvents);
  const trustDeltaServer = useMemo(() => (serverTrustEvents ?? []).reduce((s, e) => s + e.delta, 0), [serverTrustEvents]);
  const localDelta = borrower ? getDynamicDelta(borrower.borrower_id) : 0;
  const mergedDelta = isAuthenticated ? (serverTrustEvents?.length ? trustDeltaServer : trustDeltaServer + localDelta) : localDelta;
  const effectiveTrust = baseAnalysis ? Math.max(0, Math.min(100, baseAnalysis.trustScore + mergedDelta)) : 0;

  // Team notes — server persisted
  const serverNotes = useQuery(api.lendsure.listNotes, borrower ? { borrowerId: borrower.borrower_id } : ("skip" as never)) as unknown as { borrowerId: string; author: string; text: string; createdAt: number }[] | undefined;
  const addServerNote = useMutation(api.lendsure.addNote);
  const [localComments, setLocalComments] = useState<{ id: string; author: string; text: string; time: string }[]>(() => {
    if (!id) return [];
    const h = id.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
    if (h % 3 === 0) return [{ id: "1", author: "Aarav — Risk", text: "Keep duration short — bounced last month.", time: "2h ago" }, { id: "2", author: "Meera — Ops", text: "Bank verified. Income scan clean.", time: "45m ago" }];
    if (h % 3 === 1) return [{ id: "1", author: "Team", text: "Strong history. Approve with 30-day check-in.", time: "Yesterday" }];
    return [];
  });
  const [draft, setDraft] = useState("");
  const [showPay, setShowPay] = useState(false);
  const [just, setJust] = useState("");
  const [busy, setBusy] = useState(false);

  const displayNotes = useMemo(() => {
    if (isAuthenticated && serverNotes?.length) return serverNotes.map((n) => ({ id: String(n.createdAt) + n.author, author: n.author, text: n.text, time: new Date(n.createdAt).toLocaleString() }));
    return localComments;
  }, [isAuthenticated, serverNotes, localComments]);

  if (!borrower || !baseAnalysis) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="premium-card p-8 max-w-md w-full text-center">
          <p className="font-bold text-lg">Case not found</p>
          <p className="text-sm text-muted-foreground mt-1">Check the ID and try again. Custom IDs are visible only to your team when signed in.</p>
          <Link to="/dashboard" className="mt-6 inline-flex h-11 px-6 rounded-full bg-foreground text-white font-black text-sm items-center gap-2"><ArrowLeft className="w-4 h-4" /> Back to workspace</Link>
        </div>
      </div>
    );
  }

  const analysis = baseAnalysis;
  const riskTone = (r: string) => (r === "LOW" ? "bg-emerald-500 text-white border-emerald-500" : r === "MEDIUM" ? "bg-amber-400 border-amber-400" : "bg-red-500 text-white border-red-500");
  const ratio = Math.round((analysis.recommendedAmount / Math.max(1, borrower.requested_amount_inr)) * 100);

  const handleRepay = async () => {
    if (!borrower) return;
    setBusy(true);
    const before = effectiveTrust;
    const d = deltaForKind("REPAID_ON_TIME", before);
    const after = Math.max(0, Math.min(100, before + d));
    if (isAuthenticated) {
      try {
        await addServerTrust({ borrowerId: borrower.borrower_id, kind: "REPAID_ON_TIME", delta: after - before, scoreBefore: before, scoreAfter: after, note: "Loan repaid on schedule — trust lifted" });
        setJust(`Repaid on time — trust ${before} → ${after} (+${after - before}) • persisted to your team.`);
        setShowPay(false);
        setTimeout(() => setJust(""), 4500);
        setBusy(false);
        return;
      } catch {
        // fallback to local
      }
    }
    const ev = addTrustEvent(borrower.borrower_id, "REPAID_ON_TIME", analysis.trustScore);
    // force re-render via micro tick — hero will also pick up event
    window.dispatchEvent(new CustomEvent("lendsure-trust-updated"));
    setJust(`Repaid on time — trust ${ev.scoreBefore} → ${ev.scoreAfter} (+${ev.delta}) • saved locally. Sign in to share with team.`);
    setShowPay(false);
    setTimeout(() => setJust(""), 4500);
    setBusy(false);
  };

  const handleResetTrust = async () => {
    if (!borrower) return;
    if (isAuthenticated) {
      try { await clearServerTrust({ borrowerId: borrower.borrower_id }); } catch {}
    }
    clearTrustEvents(borrower.borrower_id);
    window.dispatchEvent(new CustomEvent("lendsure-trust-updated"));
    setJust("Trust reset to base.");
    setTimeout(() => setJust(""), 3000);
  };

  const handlePost = async () => {
    if (!draft.trim() || !borrower) return;
    const text = draft.trim();
    if (isAuthenticated) {
      try {
        await addServerNote({ borrowerId: borrower.borrower_id, text });
        setDraft("");
        return;
      } catch {}
    }
    setLocalComments((c) => [{ id: String(Date.now()), author: user?.email ?? "You", text, time: "now" }, ...c]);
    setDraft("");
  };

  return (
    <div className="min-h-screen bg-[#FCFCF9] text-foreground">
      <header className="sticky top-0 z-40 glass-header">
        <div className="mx-auto max-w-[1080px] px-5 h-[64px] flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link to="/" className="w-9 h-9 rounded-xl bg-foreground text-white flex items-center justify-center font-black text-sm">LS</Link>
            <span className="font-black text-[15px]">LendSure</span>
            <span className="hidden sm:inline mono text-[11px] font-black bg-foreground text-white px-2.5 py-1 rounded-full">DETAIL</span>
            {isAuthenticated ? <span className="hidden sm:inline-flex mono text-[11px] font-black bg-emerald-500 text-white px-2.5 py-1 rounded-full items-center gap-1"><CloudCheck className="w-3 h-3" /> Persisted</span> : <span className="hidden sm:inline-flex mono text-[11px] font-black bg-amber-400 px-2.5 py-1 rounded-full items-center gap-1"><LockKeyhole className="w-3 h-3" /> Local</span>}
          </div>
          <div className="flex items-center gap-2">
            <Link to="/dashboard" className="hidden sm:inline-flex h-9 px-4 rounded-full border bg-white font-bold text-sm items-center gap-1.5"><ArrowLeft className="w-4 h-4" /> Workspace</Link>
            <Link to="/booking" className="h-9 px-4 rounded-full bg-foreground text-white font-black text-sm inline-flex items-center gap-1.5"><CalendarRange className="w-4 h-4" /> Book & pay</Link>
          </div>
        </div>
      </header>
      <MarketPulseStrip />
      <main className="mx-auto max-w-[1080px] px-5 py-6 sm:py-8 space-y-6">
        <div className="premium-card p-5 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="text-[26px] font-black leading-none tracking-tight">{borrower.borrower_id}</h1>
              <p className="text-sm text-muted-foreground mt-1">{borrower.city} • {borrower.loan_purpose} • {borrower.employment_type} • {borrower.age}y • {isAuthenticated ? "Team-persisted" : "Synthetic + local"}</p>
              <p className="mono text-xs font-bold mt-2 inline-flex items-center gap-1.5 bg-foreground text-white px-2.5 py-1 rounded-full"><Landmark className="w-3.5 h-3.5" /> RBI {market.repoRate.toFixed(2)}% • {market.headline}</p>
            </div>
            <span className="mono text-xs font-bold bg-white border px-3 py-1.5 rounded-full flex items-center gap-1.5">
              Trust {analysis.trustScore} → {effectiveTrust}{mergedDelta ? ` • ${mergedDelta > 0 ? `+${mergedDelta}` : mergedDelta}` : ""} {isAuthenticated ? <CloudCheck className="w-3.5 h-3.5 text-emerald-600" /> : null}
            </span>
          </div>
          <DynamicTrustStrip borrower={borrower} baseTrust={analysis.trustScore} />
          <div className="mt-5 grid lg:grid-cols-[1.2fr_0.8fr] gap-6">
            <div className="rounded-2xl bg-foreground text-white p-5">
              <p className="mono text-xs font-bold tracking-wide text-white/60">ASKED → RECOMMENDED • {ratio}%</p>
              <p className="text-[20px] font-black leading-none mt-1.5" style={{ fontFamily: "Fraunces, serif" }}>{formatINR(borrower.requested_amount_inr)} → {formatINR(analysis.recommendedAmount)}</p>
              <p className="mono text-sm font-bold text-white/80 mt-2">{analysis.interestRate}% • {analysis.durationMonths} mo • {formatINR(analysis.monthlyPayment)}/mo</p>
              <div className="mt-3 h-1.5 bg-white/15 rounded-full overflow-hidden"><div className="h-full bg-white rounded-full" style={{ width: `${ratio}%` }} /></div>
              <p className="mt-3 mono text-xs font-black bg-white text-foreground inline-flex px-3 py-1 rounded-full">{analysis.decision.replace(/_/g, " ")}</p>
              <p className="mono text-xs font-bold text-white/50 mt-2">Confidence {analysis.confidence}% • Trust {effectiveTrust} • {borrower.city}</p>
            </div>
            <div className="space-y-2">
              <div className={`rounded-2xl border p-4 text-center ${analysis.repaymentRisk === "LOW" ? "bg-emerald-50" : analysis.repaymentRisk === "MEDIUM" ? "bg-amber-50" : "bg-red-50"}`}>
                <p className="mono text-xs font-black">REPAY</p><p className={`mt-1 inline-flex px-4 py-1 rounded-full text-sm font-black border ${riskTone(analysis.repaymentRisk)}`}>{analysis.repaymentRisk} {analysis.repaymentScore}</p>
              </div>
              <div className={`rounded-2xl border p-4 text-center ${analysis.fraudRisk === "LOW" ? "bg-emerald-50" : analysis.fraudRisk === "MEDIUM" ? "bg-amber-50" : "bg-red-50"}`}>
                <p className="mono text-xs font-black">FRAUD</p><p className={`mt-1 inline-flex px-4 py-1 rounded-full text-sm font-black border ${riskTone(analysis.fraudRisk)}`}>{analysis.fraudRisk} {analysis.fraudScore}</p>
              </div>
              <div className={`rounded-2xl border p-3 text-center mono text-xs font-black ${analysis.documentStatus === "VERIFIED" ? "bg-emerald-500 text-white border-emerald-500" : analysis.documentStatus === "SUSPICIOUS" ? "bg-red-500 text-white border-red-500" : "bg-amber-400 border-amber-400"}`}>{analysis.documentStatus}</div>
            </div>
          </div>
          <div className="mt-4 rounded-2xl border bg-white p-4 flex flex-wrap items-center gap-3">
            <span className="w-9 h-9 rounded-2xl bg-foreground text-white flex items-center justify-center"><Building2 className="w-5 h-5" /></span>
            <div><p className="font-bold text-[14px] leading-none">{analysis.bank.bankName} — {analysis.bank.branch}</p><p className="mono text-xs text-muted-foreground mt-1">A/c {analysis.bank.accountLabel} • IFSC {analysis.bank.ifscHint}</p></div>
            <span className={`ml-auto mono text-xs font-black px-3 py-1.5 rounded-full border ${analysis.bank.verified ? "bg-emerald-500 text-white border-emerald-500" : "bg-amber-400 border-amber-400"}`}>{analysis.bank.verified ? "Verified" : "Review needed"}</span>
            <a href="https://rbi.org.in" target="_blank" rel="noreferrer" className="mono text-xs font-bold inline-flex items-center gap-1 border bg-muted/20 px-3 py-1.5 rounded-full">RBI <ExternalLink className="w-3 h-3" /></a>
          </div>
          <div className="mt-4 flex flex-wrap gap-3">
            <button onClick={() => setShowPay((v) => !v)} className="h-10 px-5 rounded-full bg-foreground text-white font-black text-sm inline-flex items-center gap-2"><FileCheck className="w-4 h-4" /> Check out — {formatINR(analysis.recommendedAmount)}</button>
            <button onClick={handleRepay} disabled={busy} className="h-10 px-5 rounded-full bg-emerald-500 text-white font-black text-sm inline-flex items-center gap-2 disabled:opacity-60"><Award className="w-4 h-4" /> {busy ? "Saving…" : "Mark repaid"}</button>
            {mergedDelta !== 0 && <button onClick={handleResetTrust} className="h-10 px-4 rounded-full border bg-white font-bold text-sm inline-flex items-center gap-1.5"><RotateCcw className="w-4 h-4" /> Reset</button>}
            <Link to="/booking" className="h-10 px-4 rounded-full border bg-white font-bold text-sm inline-flex items-center gap-2"><Clock3 className="w-4 h-4" /> Schedule review</Link>
          </div>
          {just && <p className="mt-3 mono text-xs font-black bg-emerald-50 border border-emerald-200 text-emerald-800 px-3 py-2 rounded-full flex gap-2"><CheckCircle2 className="w-4 h-4 shrink-0" />{just}</p>}
          {showPay && (
            <div className="mt-4 rounded-2xl bg-foreground text-white p-4 flex flex-wrap items-center justify-between gap-3">
              <span className="mono text-sm font-bold">Mock checkout — {analysis.bank.bankName}</span>
              <span className="mono text-sm bg-white/10 border border-white/15 px-3 py-1 rounded-full">{formatINR(analysis.recommendedAmount)} • {formatINR(analysis.monthlyPayment)} EMI</span>
              <span className="flex gap-2"><button onClick={handleRepay} disabled={busy} className="h-9 px-4 rounded-full bg-emerald-500 text-white font-black text-sm disabled:opacity-60">{busy ? "Saving…" : "Mark repaid"}</button><button onClick={() => setShowPay(false)} className="h-9 px-4 rounded-full bg-white text-foreground font-black text-sm">Close</button></span>
            </div>
          )}
        </div>

        <Tabs defaultValue="trust" className="w-full">
          <div className="overflow-x-auto -mx-5 px-5 sm:mx-0 sm:px-0">
            <TabsList className="h-11 bg-white border p-1 rounded-full w-fit">
              <TabsTrigger value="trust" className="rounded-full px-5 data-[state=active]:bg-foreground data-[state=active]:text-white font-black text-sm">Trust & Network</TabsTrigger>
              <TabsTrigger value="evidence" className="rounded-full px-5 data-[state=active]:bg-foreground data-[state=active]:text-white font-black text-sm">Evidence & Audit</TabsTrigger>
              <TabsTrigger value="discuss" className="rounded-full px-5 data-[state=active]:bg-foreground data-[state=active]:text-white font-black text-sm">Discuss {isAuthenticated ? "• server" : "• local"}</TabsTrigger>
              <TabsTrigger value="market" className="rounded-full px-5 data-[state=active]:bg-foreground data-[state=active]:text-white font-black text-sm">Live News</TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="trust" className="mt-4 space-y-6">
            <DynamicTrustHero borrower={borrower} baseTrust={analysis.trustScore} />
            <TrustNetworkGraph borrower={borrower} effectiveTrust={effectiveTrust} baseTrust={analysis.trustScore} />
            <div className="grid md:grid-cols-2 gap-6">
              <div className="premium-card p-5">
                <h3 className="mono text-xs font-black">WHY — FROM MODEL</h3>
                <div className="mt-3 space-y-3">
                  <div className="rounded-2xl border bg-emerald-50/50 p-4"><p className="mono text-xs font-black flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-600" /> Strengths</p>{analysis.positiveFactors.map((f) => <div key={f.id} className="mt-3 bg-white border rounded-2xl p-3"><p className="font-bold text-sm">{f.label}</p><p className="mono text-xs text-muted-foreground">{f.value}</p></div>)}</div>
                  <div className="rounded-2xl border bg-amber-50/50 p-4"><p className="mono text-xs font-black flex items-center gap-2"><AlertTriangle className="w-4 h-4 text-amber-600" /> Risks</p>{analysis.riskFactors.map((f) => <div key={f.id} className="mt-3 bg-white border rounded-2xl p-3"><p className="font-bold text-sm">{f.label}</p><p className="mono text-xs text-muted-foreground">{f.value}</p></div>)}</div>
                </div>
              </div>
              <div className="premium-card p-5">
                <h3 className="mono text-xs font-black flex items-center gap-2"><Shield className="w-4 h-4 text-primary" /> KEY SIGNALS</h3>
                <div className="mt-4 h-2 bg-muted rounded-full overflow-hidden flex"><div className="h-full bg-muted-foreground/30" style={{ width: `${analysis.trustScore}%` }} /><div className={`h-full ${mergedDelta >= 0 ? "bg-emerald-500" : "bg-red-500"}`} style={{ width: `${Math.abs(effectiveTrust - analysis.trustScore)}%` }} /></div>
                <p className="mono text-xs text-muted-foreground mt-2">Trust {analysis.trustScore} → {effectiveTrust} • Bounced {analysis.financial.totalBounced} • Debt {Math.round(analysis.financial.debtBurden * 100)}% • {isAuthenticated ? "ledger on server" : "ledger local"}</p>
                <div className="mt-4 flex flex-wrap gap-2 mono text-xs font-black"><span className={`border px-3 py-1.5 rounded-full ${borrower.identity_verified ? "bg-emerald-500 text-white border-emerald-500" : "bg-red-500 text-white border-red-500"}`}>ID {borrower.identity_verified ? "Verified" : "Missing"}</span><span className={`border px-3 py-1.5 rounded-full ${borrower.bank_statement_verified ? "bg-emerald-500 text-white border-emerald-500" : "bg-amber-400 border-amber-400"}`}>Bank {borrower.bank_statement_verified ? "Verified" : "Review"}</span><span className="border bg-white px-3 py-1.5 rounded-full">Docs {Math.round(borrower.document_quality_score * 100)}%</span></div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="evidence" className="mt-4">
            <div className="premium-card p-5">
              <h3 className="mono text-xs font-black flex items-center gap-2"><ScanLine className="w-4 h-4 text-primary" /> EVIDENCE & AUDIT</h3>
              <div className="mt-4 grid sm:grid-cols-2 lg:grid-cols-3 gap-3">{analysis.evidence.map((e) => <div key={e.id} className="rounded-2xl border bg-muted/20 p-4"><p className="mono text-xs font-black">{e.type}</p><p className="font-bold text-sm mt-1">{e.value}</p><p className="mono text-xs text-muted-foreground">{e.status} • {e.impact}</p></div>)}</div>
              <div className="mt-4 space-y-2">{analysis.audit.map((a, i) => <div key={i} className="rounded-2xl border bg-muted/30 px-3 py-2.5 flex justify-between gap-3"><span className="text-sm font-bold">{a.label}</span><span className={`mono text-xs font-black px-2 py-0.5 rounded-full border ${a.status === "FLAG" ? "bg-red-500 text-white border-red-500" : "bg-emerald-500 text-white border-emerald-500"}`}>{a.status}</span></div>)}</div>
              <p className="mono text-xs text-muted-foreground mt-3">Market: RBI {analysis.market ? `${analysis.market.repoRate.toFixed(2)}% • ${analysis.market.headline}` : `${market.repoRate.toFixed(2)}% • ${market.headline}`} • Ledger: {analysis.trustScore} {mergedDelta ? ` ${mergedDelta > 0 ? `+${mergedDelta}` : mergedDelta} = ${effectiveTrust}` : ""} {isAuthenticated ? "• server" : "• local"}</p>
            </div>
          </TabsContent>

          <TabsContent value="discuss" className="mt-4">
            <div className="premium-card p-5">
              <h3 className="mono text-xs font-black flex items-center gap-2"><MessageSquare className="w-4 h-4 text-primary" /> TEAM DISCUSSION {isAuthenticated ? <span className="mono text-[10px] font-black bg-emerald-500 text-white px-2 py-0.5 rounded-full">Server — visible to your team</span> : <span className="mono text-[10px] font-black bg-amber-400 px-2 py-0.5 rounded-full">Local — sign in to share</span>}</h3>
              <div className="mt-4 flex gap-2">
                <input value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handlePost()} placeholder={isAuthenticated ? "Add a comment — saved to team…" : "Add a note — sign in to persist…"} className="flex-1 h-11 px-4 border rounded-full text-sm font-medium" />
                <button onClick={handlePost} className="h-11 px-5 rounded-full bg-foreground text-white font-black text-sm inline-flex items-center gap-2"><Send className="w-4 h-4" /> Post</button>
              </div>
              <div className="mt-4 space-y-3">
                {displayNotes.length === 0 && <p className="border rounded-2xl bg-muted/30 p-4 mono text-xs font-bold">No comments yet. {isAuthenticated ? "Start the discussion." : "Sign in so your whole team can see notes."}</p>}
                {displayNotes.map((c) => <div key={c.id} className="border rounded-2xl p-4 bg-white"><div className="flex justify-between gap-3"><span className="font-bold text-sm">{c.author}</span><span className="mono text-xs text-muted-foreground">{c.time}</span></div><p className="text-sm leading-7 mt-2">{c.text}</p></div>)}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="market" className="mt-4">
            <MarketNewsFeed compact />
          </TabsContent>
        </Tabs>

        <div className="flex items-center justify-between">
          <Link to="/dashboard" className="mono text-sm font-bold hover:underline">← Back to workspace</Link>
          <span className="mono text-xs font-bold border px-3 py-1.5 rounded-full bg-white flex items-center gap-1.5"><Clock3 className="w-3.5 h-3.5" /> Updated {new Date(market.lastUpdated).toLocaleTimeString()} • 5 min</span>
        </div>
      </main>
    </div>
  );
}
