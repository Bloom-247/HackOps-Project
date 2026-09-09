import { useMemo, useState } from "react";
import { Link } from "react-router";
import { ArrowLeft, Search, Trash2, Shield, Settings2, Users, FileCheck, Edit3, CheckCircle2, Sparkles, CloudCheck, LockKeyhole, CalendarRange, History, Database, Loader2 } from "lucide-react";
import { getBorrowers, analyzeBorrower, formatINR, type Borrower } from "@/lib/trustLend";
import { useAuth } from "@/hooks/use-auth";
import { useQuery, useMutation, useConvexAuth } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

function adaptBorrowerDoc(doc: Record<string, unknown>): Borrower {
  const { _id, _creationTime, ownerId, ...rest } = doc as Record<string, unknown> & { _id: unknown; ownerId: unknown };
  return rest as unknown as Borrower;
}

export default function Admin() {
  const { user } = useAuth();
  const { isAuthenticated } = useConvexAuth();
  const syntheticAll = useMemo(() => getBorrowers().slice(0, 80), []);
  const [hiddenSynthetic, setHiddenSynthetic] = useState<Set<string>>(() => new Set());
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState<string | null>(null);

  const serverBorrowersRaw = useQuery(api.lendsure.listBorrowers) as unknown as Record<string, unknown>[] | undefined;
  const serverBorrowers = useMemo(() => (serverBorrowersRaw ?? []).map(adaptBorrowerDoc), [serverBorrowersRaw]);
  const bookings = useQuery(api.lendsure.listBookings) as unknown as { _id: string; borrowerId: string; kind: string; status: string; amount?: number; createdAt: number; scheduledAt?: number }[] | undefined;
  const trustEvents = useQuery(api.lendsure.listAllTrustEvents) as unknown as { borrowerId: string; kind: string; delta: number; at: number }[] | undefined;

  const deleteBorrower = useMutation(api.lendsure.deleteBorrower);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const serverIds = useMemo(() => new Set(serverBorrowers.map((b) => b.borrower_id)), [serverBorrowers]);

  const visibleSynthetic = useMemo(() => syntheticAll.filter((b) => !hiddenSynthetic.has(b.borrower_id)), [syntheticAll, hiddenSynthetic]);
  const combined = useMemo(() => [...serverBorrowers, ...visibleSynthetic], [serverBorrowers, visibleSynthetic]);

  const filtered = useMemo(() => {
    if (!q.trim()) return combined;
    const needle = q.toLowerCase();
    return combined.filter((c) => c.borrower_id.toLowerCase().includes(needle) || c.city.toLowerCase().includes(needle));
  }, [combined, q]);

  const handleRemove = async (id: string) => {
    if (serverIds.has(id)) {
      setDeletingId(id);
      try {
        await deleteBorrower({ borrowerId: id });
      } catch (e) {
        alert(e instanceof Error ? e.message : String(e));
      } finally {
        setDeletingId(null);
      }
    } else {
      setHiddenSynthetic((prev) => new Set(prev).add(id));
    }
  };

  const isLoading = serverBorrowersRaw === undefined;

  return (
    <div className="min-h-screen bg-[#FCFCF9] text-foreground">
      <header className="sticky top-0 z-40 glass-header">
        <div className="mx-auto max-w-[1280px] px-5 h-[64px] flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="w-9 h-9 rounded-xl bg-foreground text-background flex items-center justify-center font-black text-sm">LS</span>
            <span className="font-bold tracking-tight text-[15px]">LendSure</span>
            <span className="hidden sm:inline-flex mono text-[11px] font-semibold tracking-widest bg-foreground text-background px-2.5 py-1 rounded-full">ADMIN CONSOLE</span>
            {isAuthenticated ? <span className="hidden sm:inline-flex mono text-[11px] font-black bg-emerald-500 text-white px-2.5 py-1 rounded-full items-center gap-1"><CloudCheck className="w-3 h-3" /> Server • persisted</span> : <span className="hidden sm:inline-flex mono text-[11px] font-black bg-amber-400 px-2.5 py-1 rounded-full items-center gap-1"><LockKeyhole className="w-3 h-3" /> Local demo</span>}
          </div>
          <div className="flex items-center gap-2">
            <span className="hidden md:inline text-sm bg-white border px-3 py-1.5 rounded-full flex items-center gap-1.5">{isAuthenticated ? <><CloudCheck className="w-4 h-4 text-emerald-600" /> {user?.email ?? "Team member"}</> : "Guest"}</span>
            <Link to="/dashboard" className="h-9 px-4 rounded-full border bg-white font-medium text-sm inline-flex items-center gap-1.5 hover:bg-muted"><ArrowLeft className="w-4 h-4" /> Workspace</Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1280px] px-5 py-6 sm:py-8 space-y-6">
        <section className="premium-card p-6 sm:p-7">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="text-[28px] leading-none flex items-center gap-2.5"><Settings2 className="w-6 h-6 text-primary" /> Admin console</h1>
              <p className="text-[15px] leading-6 text-muted-foreground mt-2 max-w-[640px]">
                Proper backend — borrowers, notes, bookings and trust ledger are <b className="text-foreground">persisted per team on Convex</b>. {isAuthenticated ? "Everything you do here is saved for your whole team." : "Sign in to persist — right now changes stay in this browser only."}
              </p>
            </div>
            <span className="mono text-xs font-bold bg-foreground text-background px-3 py-1.5 rounded-full flex items-center gap-1.5"><Database className="w-3.5 h-3.5" /> Proper backend</span>
          </div>

          <div className="mt-6 grid sm:grid-cols-4 gap-3">
            <div className="rounded-2xl border bg-amber-50 p-4 flex items-center gap-3">
              <span className="w-10 h-10 rounded-2xl bg-white border flex items-center justify-center shrink-0"><FileCheck className="w-4 h-4" /></span>
              <div><p className="mono text-xs font-black">{isLoading ? "…" : serverBorrowers.length} TEAM CASES</p><p className="text-xs text-muted-foreground">{isAuthenticated ? "Persisted on server" : "Sign in to persist"}</p></div>
            </div>
            <div className="rounded-2xl border bg-white p-4 flex items-center gap-3">
              <span className="w-10 h-10 rounded-2xl bg-muted border flex items-center justify-center shrink-0"><Users className="w-4 h-4" /></span>
              <div><p className="mono text-xs font-black">80 SYNTHETIC</p><p className="text-xs text-muted-foreground">Seed dataset (local)</p></div>
            </div>
            <div className="rounded-2xl border bg-white p-4 flex items-center gap-3">
              <span className="w-10 h-10 rounded-2xl bg-muted border flex items-center justify-center shrink-0"><CalendarRange className="w-4 h-4" /></span>
              <div><p className="mono text-xs font-black">{bookings?.length ?? 0} BOOKINGS</p><p className="text-xs text-muted-foreground">{isAuthenticated ? "Per team, persisted" : "Local demo"}</p></div>
            </div>
            <div className="rounded-2xl bg-foreground text-white p-4 flex items-center gap-3">
              <span className="w-10 h-10 rounded-2xl bg-white/10 border border-white/10 flex items-center justify-center shrink-0"><Shield className="w-4 h-4 text-primary" /></span>
              <div><p className="mono text-xs font-black">{trustEvents?.length ?? 0} TRUST EVENTS</p><p className="text-xs text-white/60">Evidence-first • ledger</p></div>
            </div>
          </div>

          <div className="mt-6 flex flex-col sm:flex-row gap-3">
            <div className="flex-1 relative">
              <Search className="absolute left-3.5 top-[13px] w-4 h-4 text-muted-foreground" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by case ID or city — e.g. TL-0042, Mumbai, or your USER-… IDs…" className="w-full h-11 pl-10 pr-4 bg-white border rounded-full text-[15px] font-medium placeholder:text-muted-foreground/60" />
            </div>
            <Link to="/dashboard" className="h-11 px-6 rounded-full bg-foreground text-background font-semibold text-sm inline-flex items-center justify-center">Browse catalog</Link>
          </div>
          {!isAuthenticated && <p className="mt-3 mono text-xs font-bold bg-amber-50 border border-amber-200 text-amber-900 px-3 py-2 rounded-2xl">Guest mode — your team cases and bookings will be saved locally and won’t be visible to teammates until you sign in.</p>}
        </section>

        <Tabs defaultValue="cases" className="w-full">
          <TabsList className="h-11 bg-white border p-1 rounded-full w-fit">
            <TabsTrigger value="cases" className="rounded-full px-5 data-[state=active]:bg-foreground data-[state=active]:text-white font-black text-sm">Cases</TabsTrigger>
            <TabsTrigger value="bookings" className="rounded-full px-5 data-[state=active]:bg-foreground data-[state=active]:text-white font-black text-sm">Bookings {bookings?.length ? `• ${bookings.length}` : ""}</TabsTrigger>
            <TabsTrigger value="ledger" className="rounded-full px-5 data-[state=active]:bg-foreground data-[state=active]:text-white font-black text-sm">Trust ledger {trustEvents?.length ? `• ${trustEvents.length}` : ""}</TabsTrigger>
          </TabsList>

          <TabsContent value="cases" className="mt-4">
            <section className="premium-card p-2">
              <div className="flex items-center justify-between px-4 py-3">
                <p className="mono text-xs font-black">{filtered.length} cases • <span className="text-muted-foreground">{serverBorrowers.length} on server • {visibleSynthetic.length} synthetic</span></p>
                {isLoading && <span className="mono text-xs font-bold flex items-center gap-1.5"><Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading team…</span>}
              </div>
              <div className="hidden lg:grid grid-cols-[120px_1fr_120px_140px_110px_190px] gap-2 mono text-xs font-bold text-muted-foreground px-4 py-2"><span>CASE</span><span>DETAIL</span><span>AMOUNT</span><span>VERIFICATION</span><span>RISK</span><span>ACTIONS</span></div>
              <div className="grid gap-2 max-h-[520px] overflow-auto p-2 pt-0">
                {filtered.map((b) => {
                  const a = analyzeBorrower(b);
                  const isEditing = editing === b.borrower_id;
                  const isServer = serverIds.has(b.borrower_id);
                  const isDeleting = deletingId === b.borrower_id;
                  return (
                    <div key={b.borrower_id} className={`grid lg:grid-cols-[120px_1fr_120px_140px_110px_190px] gap-3 items-center border px-4 py-3 rounded-2xl hover:shadow-sm transition-shadow ${isServer ? "bg-emerald-50/40 border-emerald-100" : "bg-white"}`}>
                      <span className="font-bold text-sm flex items-center gap-1.5 flex-wrap">{b.borrower_id} <span className={`mono text-[10px] font-black px-1.5 py-0.5 rounded-full ${isServer ? "bg-emerald-500 text-white" : "bg-muted border"}`}>{isServer ? "TEAM" : "SYNTH"}</span></span>
                      <span className="text-sm leading-5 min-w-0">
                        <span className="font-semibold">{b.city} • {b.employment_type}</span> <span className="text-muted-foreground">• {b.loan_purpose}</span>
                        {isEditing && <span className="ml-2 mono text-[11px] font-bold bg-amber-400 px-2 py-0.5 rounded-full">EDITING (DEMO)</span>}
                      </span>
                      <span className="text-sm font-semibold">{formatINR(b.requested_amount_inr)}</span>
                      <span className={`w-fit mono text-xs font-bold px-2.5 py-1 rounded-full border ${a.documentStatus === "VERIFIED" ? "bg-emerald-500 text-white border-emerald-500" : a.documentStatus === "SUSPICIOUS" ? "bg-red-500 text-white border-red-500" : "bg-amber-400 border-amber-400"}`}>{a.documentStatus}</span>
                      <span className={`w-fit mono text-xs font-bold px-2.5 py-1 rounded-full border ${a.repaymentRisk === "LOW" ? "bg-emerald-500 text-white border-emerald-500" : a.repaymentRisk === "MEDIUM" ? "bg-amber-400 border-amber-400" : "bg-red-500 text-white border-red-500"}`}>{a.repaymentRisk}</span>
                      <span className="flex gap-1.5 flex-wrap">
                        <Link to={`/borrower/${b.borrower_id}`} className="h-8 px-3 rounded-full border bg-white font-semibold text-xs inline-flex items-center gap-1 hover:bg-muted">View</Link>
                        <button onClick={() => setEditing(isEditing ? null : b.borrower_id)} className="h-8 px-3 rounded-full bg-foreground text-background font-semibold text-xs inline-flex items-center gap-1"><Edit3 className="w-3 h-3" /> {isEditing ? "Done" : "Edit"}</button>
                        <button onClick={() => handleRemove(b.borrower_id)} disabled={isDeleting} className="h-8 px-3 rounded-full border bg-white font-semibold text-xs inline-flex items-center gap-1 hover:bg-red-50 disabled:opacity-60">
                          {isDeleting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />} {isServer ? "Delete" : "Hide"}
                        </button>
                      </span>
                    </div>
                  );
                })}
              </div>
              {filtered.length === 0 && <p className="mono text-sm text-muted-foreground p-6 text-center">No cases match that search. Try a different ID or city — your team IDs start with USER- or LS-.</p>}
              <p className="mono text-xs text-muted-foreground px-4 py-3 border-t mt-2">TEAM = persisted on Convex per team (visible to everyone on your team). SYNTH = synthetic seed data. Delete removes a TEAM case permanently for your team.</p>
            </section>
          </TabsContent>

          <TabsContent value="bookings" className="mt-4">
            <section className="premium-card p-5 sm:p-6">
              <h3 className="mono text-xs font-black flex items-center gap-2"><CalendarRange className="w-4 h-4 text-primary" /> TEAM BOOKINGS — PERSISTED</h3>
              {!bookings?.length ? (
                <div className="mt-4 rounded-2xl border bg-muted/20 p-6 text-center">
                  <p className="font-black">No bookings yet</p>
                  <p className="mono text-sm text-muted-foreground mt-1">Book from the detail page or the Book & pay route — they’ll appear here for your whole team.</p>
                  <Link to="/booking" className="mt-4 inline-flex h-11 px-6 rounded-full bg-foreground text-white font-black text-sm items-center gap-2">Book a review</Link>
                </div>
              ) : (
                <div className="mt-4 grid gap-2 max-h-[420px] overflow-auto pr-1">
                  {bookings.map((b) => (
                    <div key={b._id} className="rounded-2xl border bg-white p-4 flex flex-wrap items-center gap-3">
                      <span className="mono text-xs font-black bg-foreground text-white px-2.5 py-1 rounded-full">{b.borrowerId}</span>
                      <span className="text-sm font-bold">{b.kind}</span>
                      <span className="mono text-xs font-black bg-emerald-500 text-white px-2.5 py-1 rounded-full">{b.status}</span>
                      <span className="text-sm font-bold ml-auto">{b.amount ? formatINR(b.amount) : "—"}</span>
                      <span className="mono text-xs text-muted-foreground">{new Date(b.createdAt).toLocaleString()} {b.scheduledAt ? `• scheduled ${new Date(b.scheduledAt).toLocaleDateString()}` : ""}</span>
                    </div>
                  ))}
                </div>
              )}
              <p className="mono text-xs font-bold text-muted-foreground mt-3">{isAuthenticated ? "Persisted per team on Convex — evidence-linked, audit-ready." : "Sign in to persist bookings per team."}</p>
            </section>
          </TabsContent>

          <TabsContent value="ledger" className="mt-4">
            <section className="premium-card p-5 sm:p-6">
              <h3 className="mono text-xs font-black flex items-center gap-2"><History className="w-4 h-4 text-primary" /> TRUST LEDGER — PER TEAM</h3>
              {!trustEvents?.length ? (
                <div className="mt-4 rounded-2xl border bg-muted/20 p-6 text-center">
                  <p className="font-black">No trust events yet</p>
                  <p className="mono text-sm text-muted-foreground mt-1">Mark a loan as repaid on time from the detail page — trust lifts and is recorded here for your team.</p>
                </div>
              ) : (
                <div className="mt-4 grid gap-2 max-h-[420px] overflow-auto pr-1">
                  {(trustEvents as typeof trustEvents & { scoreBefore: number; scoreAfter: number; note: string }[]).slice().sort((a, b) => b.at - a.at).slice(0, 30).map((e, i) => (
                    <div key={i} className={`rounded-2xl border p-4 flex flex-wrap items-center gap-2 ${e.delta > 0 ? "bg-emerald-50/50 border-emerald-100" : e.delta < 0 ? "bg-red-50/50 border-red-100" : "bg-white"}`}>
                      <span className="mono text-xs font-black bg-foreground text-white px-2.5 py-1 rounded-full">{e.borrowerId}</span>
                      <span className="mono text-xs font-black">{e.kind.replace(/_/g, " ")}</span>
                      <span className={`mono text-xs font-black px-2.5 py-1 rounded-full border ${e.delta > 0 ? "bg-emerald-500 text-white border-emerald-500" : e.delta < 0 ? "bg-red-500 text-white border-red-500" : "bg-white"}`}>{e.delta > 0 ? `+${e.delta}` : e.delta}</span>
                      <span className="mono text-xs text-muted-foreground ml-auto">{new Date(e.at).toLocaleString()}</span>
                      {(e as unknown as { note: string }).note && <span className="w-full text-sm font-medium leading-5 mt-1">{(e as unknown as { note: string }).note}</span>}
                    </div>
                  ))}
                </div>
              )}
            </section>
          </TabsContent>
        </Tabs>

        <div className="rounded-2xl border bg-white px-4 py-3 flex gap-3 items-center">
          <span className="w-8 h-8 rounded-full bg-emerald-50 border border-emerald-100 flex items-center justify-center shrink-0"><CheckCircle2 className="w-4 h-4 text-emerald-600" /></span>
          <p className="text-sm leading-6">Proper backend via Convex — team-scoped tables <span className="mono font-bold">borrowers • trustEvents • teamNotes • bookings</span>. Synthetic data stays local; your TEAM data is persisted and shared.</p>
        </div>

        <div className="flex flex-wrap gap-3">
          <Link to="/dashboard" className="h-11 px-6 rounded-full bg-foreground text-background font-semibold text-sm inline-flex items-center gap-2"><ArrowLeft className="w-4 h-4" /> Back to workspace</Link>
          <Link to="/booking" className="h-11 px-6 rounded-full border bg-white font-semibold text-sm inline-flex items-center gap-2"><CalendarRange className="w-4 h-4" /> Book a review</Link>
        </div>

        <p className="mono text-xs text-muted-foreground flex items-center gap-2"><Sparkles className="w-3 h-3 text-primary" /> Proper server integration — no more localStorage-only. API: <span className="font-black text-foreground">POST /api/analyze</span> • <span className="font-black text-foreground">GET /api/market</span> • Convex actions for NewsAPI (key stays on server).</p>
      </main>
    </div>
  );
}
