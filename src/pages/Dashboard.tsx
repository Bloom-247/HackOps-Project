import { useEffect, useMemo, useState, useRef } from "react";
import { Link } from "react-router";
import {
  ArrowLeft,
  Search,
  AlertTriangle,
  CheckCircle2,
  TrendingUp,
  Eye,
  Calculator,
  LogOut,
  X,
  Activity,
  MessageSquare,
  Send,
  CalendarRange,
  LayoutDashboard,
  Settings2,
  Plus,
  Upload,
  FileSpreadsheet,
  Download,
  Building2,
  Landmark,
  Sparkles,
  CloudCheck,
  LockKeyhole,
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useQuery, useMutation, useConvexAuth } from "convex/react";
import { api } from "@/convex/_generated/api";
import {
  analyzeBorrower,
  getBorrowerById,
  getBorrowers,
  distributionStats,
  formatINR,
  type Borrower,
  parseBorrowersCSV,
  createBorrowerFromValues,
  downloadSampleCSV,
  CITIES,
  EMPLOYMENT_TYPES,
} from "@/lib/trustLend";
import { useMarketLive } from "@/lib/marketLive";
import { MarketNewsFeed, MarketPulseStrip } from "@/components/MarketPulse";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LineChart, Line, XAxis, Tooltip, ResponsiveContainer } from "recharts";
import { TrustNetworkGraph } from "@/components/TrustGraph";
import { DynamicTrustHero, DynamicTrustStrip } from "@/components/DynamicTrustPanel";
import { getEffectiveTrust, getDynamicDelta } from "@/lib/dynamicTrust";

type Comment = { id: string; author: string; text: string; time: string };

function riskTone(r: string) {
  if (r === "LOW") return "bg-emerald-500 text-white border-emerald-500";
  if (r === "MEDIUM") return "bg-amber-400 text-foreground border-amber-400";
  return "bg-red-500 text-white border-red-500";
}
function decisionTone(d: string) {
  if (d === "APPROVE") return "bg-emerald-500 text-white border-emerald-500";
  if (d === "REJECT" || d === "MANUAL_REVIEW") return "bg-red-500 text-white border-red-500";
  return "bg-amber-400 text-foreground border-amber-400";
}

function adaptBorrowerDoc(doc: Record<string, unknown>): Borrower {
  // strip _id/_creationTime/ownerId, keep 51 cols
  const { _id, _creationTime, ownerId, ...rest } = doc as Record<string, unknown> & { _id: unknown; ownerId: unknown };
  return rest as unknown as Borrower;
}

export default function Dashboard() {
  const { user, signOut } = useAuth();
  const { isAuthenticated } = useConvexAuth();
  const market = useMarketLive();
  const marketCtx = useMemo(() => ({ repoRate: market.repoRate, sentimentScore: market.sentimentScore, headline: market.headline }), [market.repoRate, market.sentimentScore, market.headline]);
  const all = useMemo(() => getBorrowers(), []);
  const stats = useMemo(() => distributionStats(), []);

  // server borrowers (persisted per team) + local fallback for guests
  const serverBorrowersRaw = useQuery(api.lendsure.listBorrowers) as unknown as Record<string, unknown>[] | undefined;
  const serverBorrowers = useMemo(() => (serverBorrowersRaw ?? []).map(adaptBorrowerDoc), [serverBorrowersRaw]);
  const [localCustomCases, setLocalCustomCases] = useState<Borrower[]>([]);
  const customCases = isAuthenticated ? serverBorrowers : localCustomCases;
  const combined = useMemo(() => [...customCases, ...all], [customCases, all]);

  const trustAll = useQuery(api.lendsure.listAllTrustEvents) as unknown as { borrowerId: string; delta: number }[] | undefined;
  const trustMap = useMemo(() => {
    const m = new Map<string, number>();
    for (const e of trustAll ?? []) m.set(e.borrowerId, (m.get(e.borrowerId) ?? 0) + e.delta);
    return m;
  }, [trustAll]);

  const bulkUpsert = useMutation(api.lendsure.bulkUpsertBorrowers);
  const upsertOne = useMutation(api.lendsure.upsertBorrower);

  const [, setTrustTick] = useState(0);
  useEffect(() => {
    const h = () => setTrustTick((v) => v + 1);
    window.addEventListener("lendsure-trust-updated", h as EventListener);
    return () => window.removeEventListener("lendsure-trust-updated", h as EventListener);
  }, []);

  const combinedStats = useMemo(() => {
    let low = stats.low, med = stats.med, high = stats.high;
    for (const b of customCases) {
      const r = analyzeBorrower(b, undefined, marketCtx).repaymentRisk;
      if (r === "LOW") low++;
      else if (r === "MEDIUM") med++;
      else high++;
    }
    return { low, med, high, total: combined.length };
  }, [customCases, stats, marketCtx, combined.length]);

  const [selectedId, setSelectedId] = useState("TL-0420");
  const [search, setSearch] = useState("");
  const [riskFilter, setRiskFilter] = useState<"All" | "LOW" | "MEDIUM" | "HIGH">("All");
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [quickCity, setQuickCity] = useState("Mumbai");
  const [quickAmount, setQuickAmount] = useState(40000);
  const [simAmount, setSimAmount] = useState<number | null>(null);
  const [simRate, setSimRate] = useState<number | null>(null);
  const [simMonths, setSimMonths] = useState<number | null>(null);
  const [commentsByBorrower, setCommentsByBorrower] = useState<Record<string, Comment[]>>({});
  const [draft, setDraft] = useState("");
  const [csvErrors, setCsvErrors] = useState<string[]>([]);
  const [csvSuccess, setCsvSuccess] = useState<string>("");
  const [csvLoading, setCsvLoading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [showRealForm, setShowRealForm] = useState(false);
  const [formError, setFormError] = useState("");
  const [formSaving, setFormSaving] = useState(false);
  const [formData, setFormData] = useState<Record<string, string>>({
    borrower_id: `USER-${String(Date.now()).slice(-4)}`,
    age: "32",
    city: "Mumbai",
    employment_type: "Salaried",
    employment_stability_months: "24",
    requested_amount_inr: "50000",
    loan_purpose: "Business Expansion",
    previous_loans: "2",
    loans_repaid: "2",
    late_payments: "0",
    average_delay_days: "0",
    income_m1_inr: "45000", income_m2_inr: "46000", income_m3_inr: "47000", income_m4_inr: "48000", income_m5_inr: "49000", income_m6_inr: "50000",
    expenses_m1_inr: "18000", expenses_m2_inr: "18500", expenses_m3_inr: "19000", expenses_m4_inr: "19500", expenses_m5_inr: "20000", expenses_m6_inr: "20500",
    debt_m1_inr: "5000", debt_m2_inr: "5000", debt_m3_inr: "4800", debt_m4_inr: "4500", debt_m5_inr: "4200", debt_m6_inr: "4000",
    transactions_m1: "18", transactions_m2: "19", transactions_m3: "20", transactions_m4: "20", transactions_m5: "21", transactions_m6: "22",
    bounced_payments_m1: "0", bounced_payments_m2: "0", bounced_payments_m3: "0", bounced_payments_m4: "0", bounced_payments_m5: "0", bounced_payments_m6: "0",
    identity_verified: "true", bank_statement_verified: "true", income_document_verified: "true",
    document_quality_score: "0.85", transaction_variance_score: "0.25", income_consistency_score: "0.88",
    trust_network_size: "8", trusted_references: "7", disputed_transactions: "0", account_age_months: "36",
  });

  const effective = useMemo(() => getBorrowerById(selectedId) ?? customCases.find((c) => c.borrower_id === selectedId) ?? combined[0], [selectedId, customCases, combined]);
  const base = useMemo(() => analyzeBorrower(effective, undefined, marketCtx), [effective, marketCtx]);
  const serverDeltaForSelected = trustMap.get(effective.borrower_id) ?? (isAuthenticated ? 0 : getDynamicDelta(effective.borrower_id));
  // when authenticated, trustMap is source of truth; otherwise local
  const localDelta = getDynamicDelta(effective.borrower_id);
  const displayDelta = isAuthenticated ? serverDeltaForSelected : localDelta;
  const effectiveForServer = base.trustScore + serverDeltaForSelected;
  const displayTrust = isAuthenticated ? Math.max(0, Math.min(100, effectiveForServer)) : getEffectiveTrust(effective.borrower_id, base.trustScore);
  const askedRatio = Math.round((base.recommendedAmount / Math.max(1, effective.requested_amount_inr)) * 100);
  const simResult = useMemo(() => {
    const o = { amount: simAmount ?? base.recommendedAmount, rate: simRate ?? base.interestRate, duration: simMonths ?? base.durationMonths };
    return analyzeBorrower(effective, o, marketCtx);
  }, [effective, base, simAmount, simRate, simMonths, marketCtx]);

  // server notes for selected (persisted) — fallback to local
  const serverNotes = useQuery(api.lendsure.listNotes, { borrowerId: effective.borrower_id }) as unknown as { borrowerId: string; author: string; text: string; createdAt: number }[] | undefined;
  const addServerNote = useMutation(api.lendsure.addNote);

  const filtered = useMemo(() => {
    let list = combined;
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((b) => b.borrower_id.toLowerCase().includes(q) || b.city.toLowerCase().includes(q) || b.loan_purpose.toLowerCase().includes(q));
    }
    if (riskFilter !== "All") list = list.filter((b) => analyzeBorrower(b, undefined, marketCtx).repaymentRisk === riskFilter);
    return list.slice(0, 40);
  }, [combined, search, riskFilter, marketCtx]);

  const trendData = [1, 2, 3, 4, 5, 6].map((_, i) => ({
    m: `M${i + 1}`,
    income: [effective.income_m1_inr, effective.income_m2_inr, effective.income_m3_inr, effective.income_m4_inr, effective.income_m5_inr, effective.income_m6_inr][i],
    expenses: [effective.expenses_m1_inr, effective.expenses_m2_inr, effective.expenses_m3_inr, effective.expenses_m4_inr, effective.expenses_m5_inr, effective.expenses_m6_inr][i],
  }));

  const handleQuickCreate = async () => {
    const tpl = getBorrowerById("TL-0001")!;
    const newId = `LS-${String(7000 + customCases.length + 1).padStart(4, "0")}`;
    const created: Borrower = { ...tpl, borrower_id: newId, city: quickCity, requested_amount_inr: quickAmount };
    if (isAuthenticated) {
      try {
        await upsertOne(created as unknown as never);
        setSelectedId(newId);
        setShowQuickAdd(false);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        setCsvErrors([msg]);
        setTimeout(() => setCsvErrors([]), 4000);
      }
    } else {
      setLocalCustomCases((p) => [created, ...p]);
      setSelectedId(newId);
      setShowQuickAdd(false);
    }
  };

  const handleCsvUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      const text = String(reader.result || "");
      const { borrowers, errors } = parseBorrowersCSV(text);
      setCsvErrors(errors.slice(0, 2));
      if (borrowers.length) {
        if (isAuthenticated) {
          setCsvLoading(true);
          try {
            const res = await bulkUpsert({ borrowers: borrowers as unknown as never[] });
            const inserted = (res as { inserted: string[] }).inserted?.length ?? borrowers.length;
            setSelectedId(borrowers[0].borrower_id);
            setCsvSuccess(`Saved ${inserted} to your team — persisted on the server.`);
            setTimeout(() => setCsvSuccess(""), 4000);
            if ((res as { errors: string[] }).errors?.length) setCsvErrors((res as { errors: string[] }).errors.slice(0, 2));
          } catch (err) {
            setCsvErrors([err instanceof Error ? err.message : String(err)]);
          } finally {
            setCsvLoading(false);
          }
        } else {
          setLocalCustomCases((p) => [...borrowers, ...p]);
          setSelectedId(borrowers[0].borrower_id);
          setCsvSuccess(`Added ${borrowers.length} locally — sign in to persist to your team.`);
          setTimeout(() => setCsvSuccess(""), 4000);
        }
      } else if (!errors.length) setCsvErrors(["No valid rows found."]);
    };
    reader.readAsText(file);
    if (fileRef.current) fileRef.current.value = "";
  };
  const handleSampleDownload = () => {
    const csv = downloadSampleCSV();
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "lendsure_sample_51cols.csv"; a.click();
    URL.revokeObjectURL(url);
  };
  const handleRealFormSubmit = async () => {
    setFormError("");
    const { borrower, error } = createBorrowerFromValues(formData);
    if (!borrower) { setFormError(error || "Check the highlighted field."); return; }
    if (customCases.some((c) => c.borrower_id === borrower.borrower_id) || getBorrowerById(borrower.borrower_id)) {
      setFormError("Borrower ID already exists — change it.");
      return;
    }
    if (isAuthenticated) {
      setFormSaving(true);
      try {
        await upsertOne(borrower as unknown as never);
        setSelectedId(borrower.borrower_id);
        setShowRealForm(false);
      } catch (err) {
        setFormError(err instanceof Error ? err.message : String(err));
      } finally {
        setFormSaving(false);
      }
    } else {
      setLocalCustomCases((p) => [borrower, ...p]);
      setSelectedId(borrower.borrower_id);
      setShowRealForm(false);
    }
  };
  const localComments = commentsByBorrower[effective.borrower_id] ?? [];
  const displayComments = isAuthenticated && serverNotes?.length ? serverNotes.map((n) => ({ id: String(n.createdAt) + n.author, author: n.author, text: n.text, time: new Date(n.createdAt).toLocaleString() })) : localComments;
  const post = async () => {
    if (!draft.trim()) return;
    const text = draft.trim();
    if (isAuthenticated) {
      try {
        await addServerNote({ borrowerId: effective.borrower_id, text });
        setDraft("");
        return;
      } catch {
        // fall through to local
      }
    }
    const next: Comment = { id: String(Date.now()), author: user?.email ?? "You", text, time: "now" };
    setCommentsByBorrower((prev) => ({ ...prev, [effective.borrower_id]: [next, ...(prev[effective.borrower_id] ?? [])] }));
    setDraft("");
  };

  return (
    <div className="min-h-screen bg-[#FCFCF9] text-foreground">
      <header className="sticky top-0 z-40 glass-header">
        <div className="mx-auto max-w-[1360px] px-5 h-[64px] flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link to="/" className="w-9 h-9 rounded-xl bg-foreground text-background flex items-center justify-center font-black text-sm">LS</Link>
            <span className="font-black hidden sm:inline text-[15px]">LendSure</span>
            <span className="hidden sm:inline-flex mono text-[11px] font-black bg-foreground text-background px-2.5 py-1 rounded-full">WORKSPACE</span>
            <Link to="/" className="hidden md:inline-flex h-8 px-3 rounded-full border bg-white text-sm font-bold items-center gap-1.5 ml-1"><ArrowLeft className="w-3.5 h-3.5" /> Home</Link>
          </div>
          <nav className="hidden lg:flex items-center gap-1.5">
            <span className="h-8 px-4 rounded-full bg-foreground text-background text-sm font-black flex items-center gap-1.5"><LayoutDashboard className="w-3.5 h-3.5" /> Workspace</span>
            <Link to={`/borrower/${effective.borrower_id}`} className="h-8 px-4 rounded-full border bg-white text-sm font-bold flex items-center gap-1.5 hover:bg-muted"><Eye className="w-3.5 h-3.5" /> Detail</Link>
            <Link to="/admin" className="h-8 px-4 rounded-full border bg-white text-sm font-bold flex items-center gap-1.5 hover:bg-muted"><Settings2 className="w-3.5 h-3.5" /> Admin</Link>
            <Link to="/booking" className="h-8 px-4 rounded-full bg-primary text-white text-sm font-black flex items-center gap-1.5"><CalendarRange className="w-3.5 h-3.5" /> Book</Link>
          </nav>
          <div className="flex items-center gap-2">
            <span className="hidden lg:inline text-sm bg-white border px-3 py-1.5 rounded-full font-bold flex items-center gap-1.5">{isAuthenticated ? <><CloudCheck className="w-4 h-4 text-emerald-600" /> {user?.email ?? "Team"}</> : <><LockKeyhole className="w-4 h-4 text-amber-600" /> Guest • local only</>}</span>
            <button onClick={() => signOut()} className="h-9 px-4 rounded-full bg-foreground text-background text-sm font-black flex items-center gap-1.5"><LogOut className="w-3.5 h-3.5" /> Sign out</button>
          </div>
        </div>
      </header>

      <MarketPulseStrip />

      <main className="mx-auto max-w-[1360px] px-5 py-6 sm:py-8 space-y-6">
        <div className="premium-card p-5 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="text-[24px] font-black leading-none tracking-tight">Workspace</h1>
              <p className="mt-1.5 text-[13px] font-medium text-muted-foreground">
                Repay <b className="text-foreground">{base.mlMeta.repaymentAccuracy}%</b> • Fraud <b className="text-foreground">{base.mlMeta.fraudAccuracy}%</b> • 51 columns • RBI {market.repoRate.toFixed(2)}% • {market.isLive ? <span className="text-emerald-600 font-black">● Live</span> : <span className="text-amber-600 font-bold">○ Demo feed</span>} • <span className={isAuthenticated ? "text-emerald-700 font-black" : "text-amber-700 font-bold"}>{isAuthenticated ? "Persisted to team" : "Local — sign in to persist"}</span>
              </p>
            </div>
            <span className="mono text-xs font-bold bg-muted/40 border px-3 py-1.5 rounded-full flex items-center gap-1.5"><CloudCheck className="w-3.5 h-3.5" /> Auto-refresh every 5 min • Tap Refresh news anytime</span>
          </div>
          <div className="mt-5 grid grid-cols-2 lg:grid-cols-5 gap-3">
            <div className="rounded-2xl border bg-white p-4 text-center">
              <p className="mono text-xs font-black text-muted-foreground">TOTAL</p>
              <p className="text-[26px] font-black leading-none mt-1" style={{ fontFamily: "Fraunces, serif" }}>{combinedStats.total.toLocaleString()}</p>
              <p className="mono text-xs font-bold text-muted-foreground">{customCases.length ? `+${customCases.length} yours • ${isAuthenticated ? "server" : "local"}` : "1,500 synthetic"}</p>
            </div>
            {[
              { label: "LOW", value: combinedStats.low, cls: "bg-emerald-500 text-white border-emerald-500" },
              { label: "MED", value: combinedStats.med, cls: "bg-amber-400 text-foreground border-amber-400" },
              { label: "HIGH", value: combinedStats.high, cls: "bg-red-500 text-white border-red-500" },
            ].map((s) => (
              <div key={s.label} className={`rounded-2xl border p-4 text-center ${s.cls}`}>
                <p className="mono text-xs font-black">{s.label}</p>
                <p className="text-[26px] font-black leading-none mt-1">{s.value}</p>
                <p className="mono text-xs font-bold opacity-80">{Math.round((s.value / combinedStats.total) * 100)}%</p>
              </div>
            ))}
            <div className="rounded-2xl border bg-white p-4 text-center">
              <p className="mono text-xs font-black text-muted-foreground">ASKED → GIVE</p>
              <p className="text-[15px] font-black leading-none mt-2">LOW 99% • MED ~82% • HIGH ~51%</p>
              <p className="mono text-xs font-bold text-muted-foreground mt-1.5 truncate">{base.market ? `${base.market.rateDelta > 0 ? "+" : ""}${base.market.rateDelta}% live` : "Matched"}</p>
            </div>
          </div>
        </div>

        <Tabs defaultValue="browse" className="w-full">
          <div className="overflow-x-auto -mx-5 px-5 sm:mx-0 sm:px-0">
            <TabsList className="h-11 bg-white border p-1 rounded-full w-fit">
              <TabsTrigger value="browse" className="rounded-full px-5 data-[state=active]:bg-foreground data-[state=active]:text-white font-black text-sm">Browse</TabsTrigger>
              <TabsTrigger value="analyze" className="rounded-full px-5 data-[state=active]:bg-foreground data-[state=active]:text-white font-black text-sm">Analyze</TabsTrigger>
              <TabsTrigger value="trust" className="rounded-full px-5 data-[state=active]:bg-foreground data-[state=active]:text-white font-black text-sm">Trust</TabsTrigger>
              <TabsTrigger value="market" className="rounded-full px-5 data-[state=active]:bg-foreground data-[state=active]:text-white font-black text-sm">Live News</TabsTrigger>
              <TabsTrigger value="data" className="rounded-full px-5 data-[state=active]:bg-foreground data-[state=active]:text-white font-black text-sm">Your Data</TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="browse" className="mt-4 space-y-4">
            <div className="premium-card p-5 sm:p-6">
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="flex-1 relative">
                  <Search className="absolute left-3.5 top-[13px] w-4 h-4 text-muted-foreground" />
                  <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search — ID, city or purpose…" className="w-full h-11 pl-10 pr-4 bg-white border rounded-full text-[15px] font-medium placeholder:text-muted-foreground/60" />
                </div>
                <select value={riskFilter} onChange={(e) => setRiskFilter(e.target.value as never)} className="h-11 border bg-white px-4 rounded-full text-sm font-bold min-w-[160px]">
                  <option value="All">All risk</option><option value="LOW">Low</option><option value="MEDIUM">Medium</option><option value="HIGH">High</option>
                </select>
                <button onClick={() => setShowQuickAdd((v) => !v)} className="h-11 px-5 rounded-full bg-foreground text-white font-black text-sm inline-flex items-center gap-2 shrink-0"><Plus className="w-4 h-4" /> Quick add</button>
              </div>
              {showQuickAdd && (
                <div className="mt-4 rounded-2xl border bg-muted/20 p-4 flex flex-wrap gap-3 items-end">
                  <label className="text-sm font-bold">City <select value={quickCity} onChange={(e) => setQuickCity(e.target.value)} className="ml-2 h-10 border bg-white px-3 rounded-full text-sm font-bold"><option>Mumbai</option><option>Delhi</option><option>Bengaluru</option><option>Chennai</option><option>Hyderabad</option><option>Pune</option></select></label>
                  <label className="text-sm font-bold">Amount <input type="number" value={quickAmount} onChange={(e) => setQuickAmount(Number(e.target.value))} className="ml-2 h-10 w-36 border bg-white px-3 rounded-full text-sm" /></label>
                  <button onClick={handleQuickCreate} className="h-10 px-6 rounded-full bg-foreground text-white font-black text-sm">Create {isAuthenticated ? "• server" : "• local"}</button>
                  <button onClick={() => setShowQuickAdd(false)} className="h-10 w-10 rounded-full border bg-white flex items-center justify-center"><X className="w-4 h-4" /></button>
                </div>
              )}
              {!isAuthenticated && customCases.length === 0 && (
                <p className="mt-3 mono text-xs font-bold bg-amber-50 border border-amber-200 text-amber-900 px-3 py-2 rounded-2xl">You are in guest mode — cases you add stay in this browser. Sign in to save them to your team so everyone sees them.</p>
              )}
              <div className="mt-5 rounded-2xl border bg-muted/20 p-2">
                <div className="hidden lg:grid grid-cols-[110px_120px_110px_110px_160px] gap-2 mono text-xs font-bold text-muted-foreground px-3 py-2"><span>ID</span><span>City</span><span>Asked</span><span>Trust</span><span>Action</span></div>
                <div className="grid gap-2 max-h-[380px] overflow-auto pr-1">
                  {filtered.map((b) => {
                    const a = analyzeBorrower(b, undefined, marketCtx);
                    const baseT = a.trustScore;
                    const d = isAuthenticated ? (trustMap.get(b.borrower_id) ?? 0) : getDynamicDelta(b.borrower_id);
                    const eff = Math.max(0, Math.min(100, baseT + d));
                    const sel = b.borrower_id === effective.borrower_id;
                    const isCustom = b.borrower_id.startsWith("USER-") || b.borrower_id.startsWith("LS-");
                    return (
                      <div key={b.borrower_id} className={`grid lg:grid-cols-[110px_120px_110px_110px_160px] gap-2 items-center border px-3 py-3 rounded-2xl ${sel ? "bg-foreground text-white border-foreground" : "bg-white hover:border-primary/15"}`}>
                        <span className="font-bold text-sm flex items-center gap-1.5 flex-wrap">{b.borrower_id} {isCustom && <span className={`mono text-[10px] font-black px-1.5 py-0.5 rounded-full ${isAuthenticated ? "bg-emerald-500 text-white" : "bg-amber-400"}`}>{isAuthenticated ? "TEAM" : "YOU"}</span>}{d !== 0 && <span className={`mono text-[10px] font-black px-1.5 py-0.5 rounded-full ${d > 0 ? "bg-emerald-500 text-white" : "bg-red-500 text-white"}`}>{d > 0 ? `+${d}` : d}</span>}</span>
                        <span className={`text-sm ${sel ? "text-white/70" : "text-muted-foreground"}`}>{b.city}</span>
                        <span className="text-sm font-bold">{formatINR(b.requested_amount_inr)}</span>
                        <span className={`w-fit mono text-xs font-black px-2.5 py-1 rounded-full border ${sel ? "bg-white text-foreground border-white" : eff >= 68 ? "bg-emerald-50 border-emerald-200" : eff >= 42 ? "bg-amber-50 border-amber-200" : "bg-red-50 border-red-200"}`}>{eff}<span className="opacity-60">/100</span></span>
                        <span className="flex gap-2">
                          <button onClick={() => setSelectedId(b.borrower_id)} className={`flex-1 h-9 rounded-full font-bold text-xs border ${sel ? "bg-white text-foreground" : "bg-muted hover:bg-foreground hover:text-white"}`}>{sel ? "Selected" : "Preview"}</button>
                          <Link to={`/borrower/${b.borrower_id}`} className={`h-9 px-3 rounded-full font-bold text-xs inline-flex items-center justify-center gap-1 border ${sel ? "bg-white/10 border-white/20 text-white" : "bg-white"}`}><Eye className="w-3.5 h-3.5" /> Detail</Link>
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
              <p className="mono text-xs font-bold text-muted-foreground mt-3 flex flex-wrap gap-2 items-center"><span>Selected: <b className="text-foreground">{effective.borrower_id}</b> • Asked {formatINR(effective.requested_amount_inr)} → Give {formatINR(base.recommendedAmount)} ({askedRatio}%) • Trust {base.trustScore} → {displayTrust}{displayDelta ? ` (+${displayDelta})` : ""}</span> {isAuthenticated && <span className="inline-flex items-center gap-1 bg-emerald-50 border border-emerald-200 text-emerald-800 px-2 py-1 rounded-full"><CloudCheck className="w-3 h-3" /> Persisted</span>}</p>
            </div>

            <div className="premium-card p-5 sm:p-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h3 className="text-[18px] font-black leading-none">{effective.borrower_id} — Preview</h3>
                  <p className="text-sm text-muted-foreground mt-1">{effective.city} • {effective.loan_purpose} • {effective.employment_type}</p>
                  <p className="mono text-xs font-bold mt-2 inline-flex items-center gap-1.5 bg-muted/30 border px-2.5 py-1 rounded-full"><Building2 className="w-3.5 h-3.5 text-primary" /> {base.bank.bankName} • {base.bank.branch}</p>
                </div>
                <div className="text-center border rounded-2xl bg-foreground text-white px-5 py-3 min-w-[110px]">
                  <p className="mono text-xs font-black flex items-center justify-center gap-1"><Sparkles className="w-3 h-3" /> TRUST</p>
                  <p className="text-[24px] font-black leading-none mt-1" style={{ fontFamily: "Fraunces, serif" }}>{displayTrust}</p>
                  <p className="mono text-xs opacity-60">base {base.trustScore}{displayDelta ? ` • +${displayDelta}` : ""} {isAuthenticated ? "• server" : "• local"}</p>
                </div>
              </div>
              <DynamicTrustStrip borrower={effective} baseTrust={base.trustScore} />
              <div className="mt-4 rounded-2xl border bg-muted/20 p-4">
                <p className="mono text-xs font-bold flex items-center gap-2"><Landmark className="w-3.5 h-3.5 text-primary" /> ASKED → RECOMMENDED</p>
                <p className="mt-2 text-[20px] font-black leading-none">{formatINR(effective.requested_amount_inr)} <span className="text-muted-foreground">→</span> {formatINR(base.recommendedAmount)}</p>
                <div className="mt-3 h-2 bg-white border rounded-full overflow-hidden"><div className="h-full bg-foreground rounded-full" style={{ width: `${askedRatio}%` }} /></div>
                <p className="mono text-xs font-bold mt-2">{askedRatio}% • {base.repaymentRisk} • {base.decision.replace(/_/g, " ")} • {base.interestRate}% • {base.durationMonths}mo</p>
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2 mono text-xs font-bold text-center">
                <span className={`rounded-2xl border p-3 ${riskTone(base.repaymentRisk)}`}>{base.repaymentRisk}</span>
                <span className={`rounded-2xl border p-3 ${riskTone(base.fraudRisk)}`}>{base.fraudRisk}</span>
                <span className={`rounded-2xl border p-3 ${base.documentStatus === "VERIFIED" ? "bg-emerald-500 text-white border-emerald-500" : base.documentStatus === "SUSPICIOUS" ? "bg-red-500 text-white border-red-500" : "bg-amber-400 border-amber-400"}`}>{base.documentStatus}</span>
              </div>
              <Link to={`/borrower/${effective.borrower_id}`} className="mt-4 h-11 rounded-full bg-foreground text-white font-black text-sm flex items-center justify-center gap-2 w-full">Open full analysis <Eye className="w-4 h-4" /></Link>
            </div>
          </TabsContent>

          <TabsContent value="analyze" className="mt-4">
            <div className="grid lg:grid-cols-[1.25fr_0.85fr] gap-6 items-start">
              <div className="space-y-6">
                <div className="premium-card p-5 sm:p-6">
                  <h3 className="mono text-xs font-black flex items-center gap-2"><TrendingUp className="w-4 h-4 text-primary" /> 6-MONTH CASHFLOW</h3>
                  <div className="mt-4 rounded-2xl border bg-muted/20 p-3 h-[170px]">
                    <ResponsiveContainer width="100%" height="100%"><LineChart data={trendData}><XAxis dataKey="m" tick={{ fontSize: 12, fontWeight: 700 }} axisLine={false} tickLine={false} /><Tooltip contentStyle={{ borderRadius: 16, border: "1px solid #e2e8f0", fontWeight: 700 }} /><Line type="monotone" dataKey="income" stroke="#0f172a" strokeWidth={2.5} dot={false} /><Line type="monotone" dataKey="expenses" stroke="#f59e0b" strokeWidth={2.2} dot={false} /></LineChart></ResponsiveContainer>
                  </div>
                  <div className="mt-3 grid grid-cols-3 gap-2 mono text-xs font-bold text-center">
                    <span className="border bg-amber-50 rounded-2xl py-2.5">{formatINR(base.financial.monthlySurplus)}<br /><span className="text-[11px] font-medium">Surplus</span></span>
                    <span className="border bg-white rounded-2xl py-2.5">{Math.round(base.financial.debtBurden * 100)}%<br /><span className="text-[11px] font-medium">Debt</span></span>
                    <span className="border bg-white rounded-2xl py-2.5">{base.financial.totalBounced}<br /><span className="text-[11px] font-medium">Bounced</span></span>
                  </div>
                </div>

                <div className="premium-card p-5 sm:p-6">
                  <h3 className="mono text-xs font-black">WHY — MODEL WEIGHTS</h3>
                  <div className="mt-4 grid sm:grid-cols-2 gap-4">
                    <div className="rounded-2xl border bg-emerald-50/50 p-4">
                      <p className="mono text-xs font-black flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4 text-emerald-600" /> Strengths</p>
                      <div className="mt-3 space-y-2">{base.positiveFactors.map((f) => (<div key={f.id} className="bg-white border rounded-2xl p-3"><p className="font-bold text-sm leading-none">{f.label}</p><p className="mono text-xs text-muted-foreground mt-1">{f.value}</p></div>))}</div>
                    </div>
                    <div className="rounded-2xl border bg-amber-50/50 p-4">
                      <p className="mono text-xs font-black flex items-center gap-1.5"><AlertTriangle className="w-4 h-4 text-amber-600" /> Risks</p>
                      <div className="mt-3 space-y-2">{base.riskFactors.map((f) => (<div key={f.id} className="bg-white border rounded-2xl p-3"><p className="font-bold text-sm leading-none">{f.label}</p><p className="mono text-xs text-muted-foreground mt-1">{f.value}</p></div>))}</div>
                    </div>
                  </div>
                </div>

                <div className="premium-card p-5">
                  <h3 className="mono text-xs font-black flex items-center gap-2"><Activity className="w-4 h-4 text-primary" /> AUDIT TRAIL</h3>
                  <div className="mt-3 space-y-2">{base.audit.map((a, i) => (<div key={i} className="rounded-2xl border bg-muted/30 px-3 py-2.5 flex justify-between gap-3"><span className="text-sm font-bold leading-5">{a.label}</span><span className={`shrink-0 mono text-xs font-black px-2 py-0.5 rounded-full border ${a.status === "FLAG" ? "bg-red-500 text-white border-red-500" : "bg-emerald-500 text-white border-emerald-500"}`}>{a.status}</span></div>))}</div>
                  <p className="mono text-xs text-muted-foreground mt-2">Trust {base.trustScore} → <b className="text-foreground">{displayTrust}</b> {isAuthenticated ? "• server ledger" : "• local ledger"} • {base.market ? `RBI ${market.repoRate.toFixed(2)}% • ${market.headline}` : ""}</p>
                </div>
              </div>

              <div className="space-y-6">
                <div className="premium-card overflow-hidden">
                  <div className="bg-foreground text-white px-6 py-4 flex items-center justify-between">
                    <span className="mono text-xs font-black tracking-widest">RECOMMENDED</span>
                    <span className={`mono text-xs font-black px-3 py-1 rounded-full border ${decisionTone(simResult.decision)}`}>{simResult.decision.replace(/_/g, " ")}</span>
                  </div>
                  <div className="p-6">
                    <p className="text-[28px] font-black tracking-tight leading-none" style={{ fontFamily: "Fraunces, serif" }}>{formatINR(simResult.recommendedAmount)}</p>
                    <p className="mono text-xs font-bold text-muted-foreground">OF {formatINR(effective.requested_amount_inr)} • {Math.round(simResult.recommendedAmount / Math.max(1, effective.requested_amount_inr) * 100)}%</p>
                    <p className="text-sm font-bold mt-2">{simResult.interestRate}% • {simResult.durationMonths} mo • {formatINR(simResult.monthlyPayment)}/mo</p>
                    <div className="mt-4 grid grid-cols-3 gap-2 mono text-xs font-bold text-center">
                      <span className="border bg-amber-50 rounded-2xl py-2.5">{simResult.confidence}%<br />Conf</span>
                      <span className={`border rounded-2xl py-2.5 ${riskTone(simResult.repaymentRisk)}`}>{simResult.repaymentRisk}</span>
                      <span className="border bg-white rounded-2xl py-2.5">{displayTrust}<br />Trust</span>
                    </div>
                    <Link to="/booking" className="mt-5 h-11 rounded-full bg-foreground text-white font-black text-sm w-full flex items-center justify-center gap-2"><CalendarRange className="w-4 h-4" /> Book & check out</Link>
                  </div>
                </div>

                <div className="premium-card p-5">
                  <h3 className="mono text-xs font-black flex items-center gap-2"><Calculator className="w-4 h-4 text-primary" /> WHAT-IF</h3>
                  <div className="mt-4 rounded-2xl border bg-muted/20 p-4 space-y-5">
                    <div><div className="flex justify-between mono text-xs font-bold"><span>Amount</span><span className="bg-foreground text-white px-2.5 py-1 rounded-full">{formatINR(simAmount ?? base.recommendedAmount)}</span></div><Slider value={[simAmount ?? base.recommendedAmount]} min={5000} max={120000} step={5000} onValueChange={(v) => setSimAmount(v[0])} className="mt-3" /></div>
                    <div><div className="flex justify-between mono text-xs font-bold"><span>Rate</span><span className="border bg-white px-2.5 py-1 rounded-full">{simRate ?? base.interestRate}%</span></div><Slider value={[simRate ?? base.interestRate]} min={6} max={22} step={0.5} onValueChange={(v) => setSimRate(v[0])} className="mt-3" /></div>
                    <div><div className="flex justify-between mono text-xs font-bold"><span>Duration</span><span className="border bg-white px-2.5 py-1 rounded-full">{simMonths ?? base.durationMonths} mo</span></div><Slider value={[simMonths ?? base.durationMonths]} min={2} max={6} step={1} onValueChange={(v) => setSimMonths(v[0])} className="mt-3" /></div>
                    <button onClick={() => { setSimAmount(null); setSimRate(null); setSimMonths(null); }} className="w-full h-10 rounded-full border bg-white font-bold text-sm">Reset</button>
                  </div>
                </div>

                <div className="premium-card p-5">
                  <h3 className="mono text-xs font-black flex items-center gap-2"><MessageSquare className="w-4 h-4 text-primary" /> TEAM NOTES {isAuthenticated ? <span className="ml-1 mono text-[10px] font-black bg-emerald-500 text-white px-2 py-0.5 rounded-full">Server</span> : <span className="ml-1 mono text-[10px] font-black bg-amber-400 px-2 py-0.5 rounded-full">Local</span>}</h3>
                  <div className="mt-3 flex gap-2">
                    <input value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => e.key === "Enter" && post()} placeholder={isAuthenticated ? "Add a note — saved to team…" : "Add a note — sign in to share…"} className="flex-1 h-11 px-4 border rounded-full text-sm font-medium" />
                    <button onClick={post} className="h-11 px-5 rounded-full bg-foreground text-white font-black text-sm flex items-center gap-1.5"><Send className="w-4 h-4" /> Post</button>
                  </div>
                  <div className="mt-3 space-y-2 max-h-[180px] overflow-auto pr-1">
                    {displayComments.length === 0 && <p className="border rounded-2xl bg-muted/30 p-3 mono text-xs font-bold">No notes yet. {isAuthenticated ? "Be the first to comment." : "Sign in so your team can see notes."}</p>}
                    {displayComments.map((c) => (<div key={c.id} className="border rounded-2xl p-3 bg-white"><div className="flex justify-between gap-2"><span className="font-bold text-sm">{c.author}</span><span className="mono text-xs text-muted-foreground">{c.time}</span></div><p className="text-sm leading-6 mt-1">{c.text}</p></div>))}
                  </div>
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="trust" className="mt-4 space-y-6">
            <DynamicTrustHero borrower={effective} baseTrust={base.trustScore} />
            <TrustNetworkGraph borrower={effective} effectiveTrust={displayTrust} baseTrust={base.trustScore} />
          </TabsContent>

          <TabsContent value="market" className="mt-4">
            <MarketNewsFeed />
          </TabsContent>

          <TabsContent value="data" className="mt-4">
            <div className="premium-card p-5 sm:p-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h3 className="text-[18px] font-black flex items-center gap-2"><FileSpreadsheet className="w-5 h-5 text-primary" /> Use your real dataset</h3>
                  <p className="text-sm text-muted-foreground mt-1">Same 51-column model — scored instantly. {isAuthenticated ? "Saved to server, visible to your team." : "Sign in to persist — otherwise stored locally."}</p>
                </div>
                <span className={`mono text-xs font-black px-3 py-1.5 rounded-full ${isAuthenticated ? "bg-emerald-500 text-white" : "bg-amber-400"}`}>{isAuthenticated ? "Server • 51 cols" : "Local • 51 cols"}</span>
              </div>
              <div className="mt-6 grid lg:grid-cols-2 gap-5">
                <div className="rounded-2xl border bg-white p-5">
                  <p className="mono text-xs font-black flex items-center gap-2"><Upload className="w-4 h-4 text-primary" /> Bulk upload {isAuthenticated && <span className="mono text-[10px] font-black bg-emerald-500 text-white px-2 py-0.5 rounded-full">Server</span>}</p>
                  <p className="text-sm text-muted-foreground mt-1">Header must match the 51 columns exactly.</p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <button onClick={handleSampleDownload} className="h-10 px-4 rounded-full border bg-white font-bold text-xs flex items-center gap-1.5"><Download className="w-3.5 h-3.5" /> Sample CSV</button>
                    <label className={`h-10 px-5 rounded-full font-black text-xs flex items-center gap-1.5 cursor-pointer ${csvLoading ? "bg-muted text-muted-foreground" : "bg-foreground text-white"}`}><Upload className="w-3.5 h-3.5" /> {csvLoading ? "Saving…" : isAuthenticated ? "Upload to team" : "Upload locally"}<input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={handleCsvUpload} disabled={csvLoading} /></label>
                  </div>
                  {csvSuccess && <p className="mt-3 mono text-xs font-black bg-emerald-50 border border-emerald-200 text-emerald-800 px-3 py-2 rounded-full">{csvSuccess}</p>}
                  {csvErrors.length > 0 && <div className="mt-3 rounded-2xl border bg-red-50 p-3 mono text-xs font-bold text-red-800">{csvErrors.map((e, i) => <p key={i}>• {e}</p>)}</div>}
                  {!isAuthenticated && <p className="mt-3 mono text-xs font-bold text-muted-foreground">Sign in to make CSV imports visible to teammates and survive refresh on any device.</p>}
                </div>
                <div className="rounded-2xl border bg-amber-50/40 p-5">
                  <p className="mono text-xs font-black">Single borrower form {isAuthenticated && <span className="mono text-[10px] font-black bg-emerald-500 text-white px-2 py-0.5 rounded-full ml-1">Server</span>}</p>
                  {!showRealForm ? (
                    <button onClick={() => setShowRealForm(true)} className="mt-4 h-11 px-6 rounded-full bg-foreground text-white font-black text-sm w-full">Add one borrower</button>
                  ) : (
                    <div className="mt-4 space-y-3">
                      <div className="grid grid-cols-2 gap-2">
                        <label className="mono text-xs font-black">ID <input value={formData.borrower_id} onChange={(e) => setFormData((s) => ({ ...s, borrower_id: e.target.value }))} className="mt-1 w-full h-9 border bg-white rounded-full px-3 text-sm font-bold" /></label>
                        <label className="mono text-xs font-black">Age <input type="number" value={formData.age} onChange={(e) => setFormData((s) => ({ ...s, age: e.target.value }))} className="mt-1 w-full h-9 border bg-white rounded-full px-3 text-sm font-bold" /></label>
                        <label className="mono text-xs font-black">City<select value={formData.city} onChange={(e) => setFormData((s) => ({ ...s, city: e.target.value }))} className="mt-1 w-full h-9 border bg-white rounded-full px-3 text-sm font-bold">{CITIES.map((c) => <option key={c} value={c}>{c}</option>)}</select></label>
                        <label className="mono text-xs font-black">Employment<select value={formData.employment_type} onChange={(e) => setFormData((s) => ({ ...s, employment_type: e.target.value }))} className="mt-1 w-full h-9 border bg-white rounded-full px-3 text-sm font-bold">{EMPLOYMENT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}</select></label>
                        <label className="mono text-xs font-black">Asked (₹) <input type="number" value={formData.requested_amount_inr} onChange={(e) => setFormData((s) => ({ ...s, requested_amount_inr: e.target.value }))} className="mt-1 w-full h-9 border bg-white rounded-full px-3 text-sm font-bold" /></label>
                        <label className="mono text-xs font-black">Doc quality <input type="number" step="0.01" value={formData.document_quality_score} onChange={(e) => setFormData((s) => ({ ...s, document_quality_score: e.target.value }))} className="mt-1 w-full h-9 border bg-white rounded-full px-3 text-sm font-bold" /></label>
                      </div>
                      <details className="rounded-2xl border bg-white p-3"><summary className="mono text-xs font-black cursor-pointer">All 51 fields</summary>
                        <div className="mt-3 grid grid-cols-2 gap-2 max-h-[280px] overflow-auto pr-1">
                          {["employment_stability_months", "loan_purpose", "previous_loans", "loans_repaid", "late_payments", "average_delay_days", "income_m1_inr", "income_m2_inr", "income_m3_inr", "income_m4_inr", "income_m5_inr", "income_m6_inr", "expenses_m1_inr", "expenses_m2_inr", "expenses_m3_inr", "expenses_m4_inr", "expenses_m5_inr", "expenses_m6_inr", "debt_m1_inr", "debt_m2_inr", "debt_m3_inr", "debt_m4_inr", "debt_m5_inr", "debt_m6_inr", "transactions_m1", "transactions_m2", "transactions_m3", "transactions_m4", "transactions_m5", "transactions_m6", "bounced_payments_m1", "bounced_payments_m2", "bounced_payments_m3", "bounced_payments_m4", "bounced_payments_m5", "bounced_payments_m6", "identity_verified", "bank_statement_verified", "income_document_verified", "transaction_variance_score", "income_consistency_score", "trust_network_size", "trusted_references", "disputed_transactions", "account_age_months"].map((k) => (
                            <label key={k} className="mono text-[11px] font-black">{k}
                              {k.includes("verified") ? <select value={String(formData[k] ?? "true")} onChange={(e) => setFormData((s) => ({ ...s, [k]: e.target.value }))} className="mt-1 w-full h-8 border bg-white rounded-full px-2 text-xs font-bold"><option value="true">Verified</option><option value="false">Not verified</option></select> : <input value={formData[k] ?? ""} onChange={(e) => setFormData((s) => ({ ...s, [k]: e.target.value }))} className="mt-1 w-full h-8 border bg-white rounded-full px-2 text-xs font-bold" />}
                            </label>
                          ))}
                        </div></details>
                      {formError && <p className="mono text-xs font-black bg-red-50 border border-red-200 text-red-800 px-3 py-2 rounded-full">{formError}</p>}
                      <div className="flex gap-2"><button onClick={handleRealFormSubmit} disabled={formSaving} className="flex-1 h-11 rounded-full bg-foreground text-white font-black text-sm disabled:opacity-60">{formSaving ? "Saving…" : `Predict ${isAuthenticated ? "• server" : "• local"}`}</button><button onClick={() => setShowRealForm(false)} className="h-11 w-11 rounded-full border bg-white flex items-center justify-center"><X className="w-4 h-4" /></button></div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>

        <div className="rounded-2xl border bg-white px-4 py-3 flex gap-3 items-start">
          <AlertTriangle className="w-5 h-5 shrink-0 text-amber-600" />
          <p className="text-sm font-medium leading-6">Decision support only. Not a guarantee. Market shift is gentle and never overrides verification or debt signals. Trust earns with real repayment — now persisted to your team on the server.</p>
        </div>
      </main>
    </div>
  );
}
