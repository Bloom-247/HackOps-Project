import { useMemo, useState } from "react";
import { Link } from "react-router";
import { motion } from "framer-motion";
import {
  ArrowRight,
  AlertTriangle,
  HeartHandshake,
  Eye,
  Layers,
  ScanLine,
  Calculator,
  Settings2,
  CreditCard,
  Brain,
  Landmark,
  Building2,
  Search,
} from "lucide-react";
import { analyzeBorrower, getBorrowerById, distributionStats, formatINR } from "@/lib/trustLend";
import { useMarketLive } from "@/lib/marketLive";
import { MarketNewsFeed, MarketPulseStrip } from "@/components/MarketPulse";
import { Slider } from "@/components/ui/slider";
import { TrustNetworkGraph } from "@/components/TrustGraph";
import { useDynamicTrust } from "@/lib/dynamicTrust";

const DEMO_ID = "TL-0420";

export default function Landing() {
  const base = useMemo(() => getBorrowerById(DEMO_ID)!, []);
  const dist = useMemo(() => distributionStats(), []);
  const market = useMarketLive();
  const marketCtx = useMemo(() => ({ repoRate: market.repoRate, sentimentScore: market.sentimentScore, headline: market.headline }), [market.repoRate, market.sentimentScore, market.headline]);
  const analysis = useMemo(() => analyzeBorrower(base, undefined, marketCtx), [base, marketCtx]);
  const trustDyn = useDynamicTrust(base.borrower_id, analysis.trustScore);
  const displayTrust = trustDyn.effective;
  const [simAmount, setSimAmount] = useState(35000);
  const [simRate, setSimRate] = useState(12);
  const [simMonths, setSimMonths] = useState(3);
  const sim = useMemo(() => analyzeBorrower(base, { amount: simAmount, rate: simRate, duration: simMonths }, marketCtx), [base, simAmount, simRate, simMonths, marketCtx]);
  const ratio = Math.round((analysis.recommendedAmount / Math.max(1, base.requested_amount_inr)) * 100);
  const delta = (market.repoRate - 6.5 - market.sentimentScore * 0.55).toFixed(2);

  return (
    <div className="min-h-screen bg-background text-foreground overflow-x-hidden">
      <header className="sticky top-0 z-40 glass-header">
        <div className="mx-auto max-w-[1280px] px-5 sm:px-6 h-[64px] flex items-center justify-between gap-4">
          <Link to="/" className="flex items-center gap-3">
            <span className="w-9 h-9 rounded-xl bg-foreground text-background flex items-center justify-center font-black text-sm">LS</span>
            <span className="font-black text-[17px]">LendSure</span>
            <span className="hidden sm:inline-flex mono text-[10px] font-black bg-foreground text-background px-2 py-1 rounded-full">v6 • LIVE</span>
          </Link>
          <nav className="hidden lg:flex items-center gap-7 text-[14px] font-bold text-muted-foreground">
            <a href="#model" className="hover:text-foreground">Accuracy</a>
            <a href="#markets" className="hover:text-foreground">Markets</a>
            <a href="#how" className="hover:text-foreground">How it works</a>
            <Link to="/admin" className="hover:text-foreground">Admin</Link>
          </nav>
          <div className="flex items-center gap-2">
            <Link to="/auth" className="hidden sm:inline-flex h-9 px-4 rounded-full border bg-white font-bold text-sm items-center hover:bg-muted">Sign in</Link>
            <Link to="/dashboard" className="inline-flex items-center gap-1.5 h-9 px-5 rounded-full bg-foreground text-background font-black text-sm hover:bg-foreground/90">
              Open workspace <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </header>

      <MarketPulseStrip />

      <section className="relative editorial-gradient">
        <div className="mx-auto max-w-[1280px] px-5 sm:px-6 pt-10 sm:pt-14 pb-10">
          <div className="grid lg:grid-cols-[1.05fr_0.95fr] gap-10 lg:gap-12 items-start">
            <div>
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="inline-flex items-center gap-2 bg-white border rounded-full pl-1.5 pr-3 py-1.5 shadow-sm">
                <span className="w-7 h-7 rounded-full bg-primary flex items-center justify-center"><Brain className="w-3.5 h-3.5 text-white" /></span>
                <span className="text-sm font-bold">LendSure — lending decisions with evidence</span>
              </motion.div>

              <motion.h1 initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }} className="mt-6 text-[42px] sm:text-[56px] leading-[0.9] font-black tracking-tighter">
                How much<br />should you<br /><span className="text-primary">lend?</span>
              </motion.h1>

              <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.14 }} className="mt-5 max-w-[520px] text-[16px] leading-7 text-muted-foreground">
                We answer with <span className="text-foreground font-bold">amount, rate, duration and why</span> — not a black box. Every recommendation shows risks, strengths, evidence and confidence. Now with live market context.
              </motion.p>

              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }} className="mt-8 flex flex-wrap gap-3">
                <Link to="/dashboard" className="inline-flex items-center gap-2 h-11 px-6 rounded-full bg-foreground text-white font-black text-[15px] hover:bg-foreground/90">
                  Open workspace <ArrowRight className="w-4 h-4" />
                </Link>
                <a href="#markets" className="inline-flex items-center gap-2 h-11 px-5 rounded-full bg-white border font-bold text-[15px] hover:bg-muted">See live markets</a>
              </motion.div>

              <div className="mt-8 flex flex-wrap gap-2 mono text-xs font-bold">
                <span className="bg-white border px-3 py-1.5 rounded-full">Repay {analysis.mlMeta.repaymentAccuracy}%</span>
                <span className="bg-white border px-3 py-1.5 rounded-full">51 inputs</span>
                <span className={`px-3 py-1.5 rounded-full border font-black ${market.isLive ? "bg-emerald-500 text-white border-emerald-500" : "bg-white"}`}>{market.isLive ? "● Live headlines" : "○ Demo headlines"}</span>
              </div>
            </div>

            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.18 }} className="lg:sticky lg:top-[80px]">
              <div className="premium-card overflow-hidden">
                <div className="h-10 flex items-center justify-between px-5 bg-foreground text-white">
                  <span className="mono text-xs font-black tracking-widest flex items-center gap-2"><ScanLine className="w-4 h-4 text-primary" /> SAMPLE DECISION</span>
                  <span className="mono text-xs font-bold bg-white/10 px-2.5 py-1 rounded-full">{analysis.borrower.borrower_id}</span>
                </div>
                <div className="p-5">
                  <div className="flex items-baseline gap-2">
                    <span className="text-[42px] font-black leading-none tracking-tight" style={{ fontFamily: "Fraunces, serif" }}>{displayTrust}</span>
                    <span className="mono text-sm font-bold text-muted-foreground">/100 trust</span>
                    {trustDyn.delta !== 0 && <span className={`mono text-xs font-black px-2 py-1 rounded-full ${trustDyn.delta > 0 ? "bg-emerald-500 text-white" : "bg-red-500 text-white"}`}>{trustDyn.delta > 0 ? `+${trustDyn.delta}` : trustDyn.delta}</span>}
                    <span className="ml-auto mono text-xs font-bold bg-muted px-2.5 py-1 rounded-full">{analysis.confidence}% confidence</span>
                  </div>
                  <div className="mt-3 h-2 bg-muted rounded-full overflow-hidden flex"><div className="h-full bg-foreground" style={{ width: `${analysis.trustScore}%` }} /><div className={`h-full ${trustDyn.delta >= 0 ? "bg-emerald-500" : "bg-red-500"}`} style={{ width: `${Math.abs(displayTrust - analysis.trustScore)}%` }} /></div>

                  <div className="mt-4 rounded-2xl bg-foreground text-white p-4">
                    <p className="mono text-xs font-bold tracking-wide text-white/60">ASKED → WE RECOMMEND • {ratio}%</p>
                    <p className="text-[18px] font-black mt-1" style={{ fontFamily: "Fraunces, serif" }}>{formatINR(base.requested_amount_inr)} → {formatINR(analysis.recommendedAmount)}</p>
                    <div className="mt-3 h-1.5 bg-white/15 rounded-full overflow-hidden"><div className="h-full bg-white rounded-full" style={{ width: `${ratio}%` }} /></div>
                    <p className="mono text-xs font-bold text-white/80 mt-3">{analysis.interestRate}% • {analysis.durationMonths} mo • {formatINR(analysis.monthlyPayment)}/mo</p>
                    <p className="mt-2 mono text-xs font-black bg-white text-foreground inline-flex px-3 py-1 rounded-full">{analysis.decision.replace(/_/g, " ")}</p>
                  </div>

                  <div className="mt-3 rounded-2xl border bg-muted/20 p-3 flex items-center gap-3">
                    <span className="w-8 h-8 rounded-xl bg-white border flex items-center justify-center"><Building2 className="w-4 h-4 text-primary" /></span>
                    <div className="min-w-0"><p className="text-sm font-bold leading-none">{analysis.bank.bankName}</p><p className="mono text-xs text-muted-foreground truncate">{analysis.bank.branch} • {analysis.bank.accountLabel}</p></div>
                  </div>

                  <div className="mt-3 grid grid-cols-3 gap-2 mono text-xs font-bold text-center">
                    <span className="border rounded-2xl bg-white p-2.5">{analysis.repaymentRisk}</span>
                    <span className="border rounded-2xl bg-white p-2.5">{analysis.fraudRisk === "LOW" ? "No fraud" : analysis.fraudRisk}</span>
                    <span className="border rounded-2xl bg-white p-2.5">{analysis.documentStatus === "VERIFIED" ? "Verified" : analysis.documentStatus}</span>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-2">
                    <Link to={`/borrower/${analysis.borrower.borrower_id}`} className="h-10 rounded-full border bg-white font-bold text-sm flex items-center justify-center gap-1.5"><Eye className="w-4 h-4" /> See why</Link>
                    <Link to="/dashboard" className="h-10 rounded-full bg-foreground text-white font-black text-sm flex items-center justify-center">Try it</Link>
                  </div>
                </div>
              </div>
              <p className="mono text-xs text-center mt-2 text-muted-foreground">Decision support only • Not a guarantee • Auto-refreshed every 5 min</p>
            </motion.div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-[1280px] px-5 sm:px-6 pb-6">
        <TrustNetworkGraph borrower={base} effectiveTrust={displayTrust} baseTrust={analysis.trustScore} />
      </section>

      <section id="model" className="border-y bg-white">
        <div className="mx-auto max-w-[1280px] px-5 sm:px-6 py-10">
          <p className="mono text-xs font-black tracking-[0.14em] text-primary">ACCURACY YOU CAN TRUST</p>
          <h2 className="mt-2 text-[28px] font-black leading-none tracking-tight">Clear answers, with proof</h2>
          <p className="mt-3 text-[15px] leading-6 text-muted-foreground max-w-[680px]">How much, at what rate and duration — and <b className="text-foreground">why</b>. Every score comes with strengths, risks, evidence, confidence and an audit trail. Plus live market context.</p>

          <div className="mt-8 grid lg:grid-cols-2 gap-6">
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-2xl border bg-foreground text-white p-5 text-center">
                <p className="mono text-xs font-bold text-white/60">REPAY</p>
                <p className="text-[28px] font-black leading-none mt-2">{analysis.mlMeta.repaymentAccuracy}%</p>
                <p className="mono text-xs text-white/60 mt-1">51 inputs → ridge</p>
              </div>
              <div className="rounded-2xl border bg-white p-5 text-center"><p className="mono text-xs font-bold text-muted-foreground">FRAUD</p><p className="text-[28px] font-black leading-none mt-2">{analysis.mlMeta.fraudAccuracy}%</p></div>
              <div className="rounded-2xl border bg-white p-5 text-center"><p className="mono text-xs font-bold text-muted-foreground">TRUST MAE</p><p className="text-[28px] font-black leading-none mt-2">{analysis.mlMeta.trustMAE}</p></div>
              <div className="col-span-3 rounded-2xl border bg-muted/30 p-4 flex flex-wrap gap-2 mono text-xs font-bold">
                <span className="bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-full">LOW {dist.low}</span>
                <span className="bg-amber-50 border border-amber-200 px-3 py-1.5 rounded-full">MED {dist.med}</span>
                <span className="bg-red-50 border border-red-200 px-3 py-1.5 rounded-full">HIGH {dist.high}</span>
                <span className="bg-white border px-3 py-1.5 rounded-full">RBI {market.repoRate.toFixed(2)}%</span>
              </div>
            </div>
            <div className="premium-card p-6">
              <p className="mono text-xs font-black">WHAT YOU GET FOR EVERY BORROWER</p>
              <ul className="mt-4 space-y-2 text-[14px] font-medium leading-6">
                <li className="flex gap-2"><span className="text-primary">•</span> Recommended amount, rate, duration and EMI — math shown</li>
                <li className="flex gap-2"><span className="text-primary">•</span> Why: top strengths and risks from model weights</li>
                <li className="flex gap-2"><span className="text-primary">•</span> Evidence + confidence + audit — exportable</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      <section id="markets" className="mx-auto max-w-[1280px] px-5 sm:px-6 py-8">
        <MarketNewsFeed />
      </section>

      <section className="mx-auto max-w-[1280px] px-5 sm:px-6 pb-8">
        <div className="grid md:grid-cols-3 gap-4">
          {[
            { icon: Search, title: "Missing context?", desc: "We use all 51 fields — incomes, expenses, debts, bounces, verification — so nothing is guessed." },
            { icon: AlertTriangle, title: "Hidden risk?", desc: "Trained on your data, not hand-tuned rules. Fraud and repayment patterns are learned." },
            { icon: HeartHandshake, title: "Hard to trust?", desc: "Trust is a 0–100 score with a clear breakdown. Dynamic — it grows when borrowers repay." },
          ].map((c) => (
            <div key={c.title} className="premium-card p-5">
              <c.icon className="w-5 h-5 text-primary" />
              <h3 className="mt-3 text-[16px] font-black">{c.title}</h3>
              <p className="mt-1 text-[14px] leading-6 text-muted-foreground">{c.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="how" className="bg-muted/30 border-y">
        <div className="mx-auto max-w-[1280px] px-5 sm:px-6 py-10">
          <p className="mono text-xs font-black tracking-[0.14em] text-primary">HOW IT WORKS</p>
          <h2 className="mt-2 text-[24px] font-black leading-none">From data to decision — step by step</h2>
          <div className="mt-6 grid sm:grid-cols-5 gap-3">
            {["Verify documents", "Run model (51 inputs)", "Check fraud signals", "Explain strengths & risks", "Recommend terms"].map((t, i) => (
              <div key={t} className="bg-white border rounded-2xl p-4 text-center">
                <p className="mono text-xs font-black text-primary">0{i + 1}</p>
                <p className="mt-2 font-bold text-sm leading-5">{t}</p>
              </div>
            ))}
          </div>
          <p className="mono text-xs text-muted-foreground mt-3 text-center">Data → Features → Documents → Repayment • Fraud • Trust → Explain → Decision → Audit</p>
        </div>
      </section>

      <section className="mx-auto max-w-[1280px] px-5 sm:px-6 py-8">
        <div className="grid lg:grid-cols-2 gap-8 items-start">
          <div>
            <h3 className="text-[24px] font-black leading-none">Explore the details</h3>
            <p className="mt-3 text-[15px] leading-6 text-muted-foreground">Open a borrower and see the full story — network graph, trust trajectory, what-if simulator and market context. Everything is plain English.</p>
            <div className="mt-6 flex gap-3">
              <Link to="/dashboard" className="h-11 px-6 rounded-full bg-foreground text-white font-black text-sm inline-flex items-center gap-2">Open workspace <ArrowRight className="w-4 h-4" /></Link>
              <Link to="/admin" className="h-11 px-5 rounded-full bg-white border font-bold text-sm inline-flex items-center gap-2"><Settings2 className="w-4 h-4" /> Admin</Link>
            </div>
          </div>

          <div className="premium-card overflow-hidden">
            <div className="bg-foreground text-white p-5">
              <p className="mono text-xs font-bold tracking-wide text-white/60 flex items-center gap-2"><Calculator className="w-4 h-4 text-primary" /> TRY IT — WHAT IF?</p>
              <h3 className="mt-1 text-[18px] font-black leading-none text-white">What if you lend more?</h3>
              <p className="mono text-xs text-white/60 mt-1">Live market shift {delta}% already applied</p>
            </div>
            <div className="p-5 space-y-4">
              <div><div className="flex justify-between mono text-xs font-bold"><span>Amount</span><span className="bg-foreground text-white px-2.5 py-1 rounded-full">{formatINR(simAmount)}</span></div><Slider value={[simAmount]} min={5000} max={120000} step={5000} onValueChange={(v) => setSimAmount(v[0])} className="mt-2" /></div>
              <div><div className="flex justify-between mono text-xs font-bold"><span>Rate</span><span className="border bg-white px-2.5 py-1 rounded-full">{simRate}%</span></div><Slider value={[simRate]} min={6} max={22} step={0.5} onValueChange={(v) => setSimRate(v[0])} className="mt-2" /></div>
              <div><div className="flex justify-between mono text-xs font-bold"><span>Duration</span><span className="border bg-white px-2.5 py-1 rounded-full">{simMonths} mo</span></div><Slider value={[simMonths]} min={2} max={6} step={1} onValueChange={(v) => setSimMonths(v[0])} className="mt-2" /></div>
            </div>
            <div className="m-3 mt-0 rounded-2xl border bg-muted/30 p-4">
              <p className="font-bold text-[15px]">{formatINR(sim.recommendedAmount)} • {sim.interestRate}% • {sim.durationMonths} mo</p>
              <p className="mono text-sm font-bold">{formatINR(sim.monthlyPayment)}/mo • {sim.repaymentRisk}</p>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-[1280px] px-5 sm:px-6 pb-8">
        <div className="rounded-[24px] bg-foreground p-8 sm:p-10 text-center">
          <h2 className="text-[26px] font-black leading-none text-white">Ready to lend with confidence?</h2>
          <p className="mono text-sm text-white/70 mt-2">Evidence first — not guesswork.</p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Link to="/dashboard" className="h-11 px-7 rounded-full bg-white text-foreground font-black text-sm inline-flex items-center gap-2">Enter workspace <ArrowRight className="w-4 h-4" /></Link>
            <Link to="/booking" className="h-11 px-6 rounded-full bg-white/10 border border-white/20 text-white font-bold text-sm inline-flex items-center gap-2"><CreditCard className="w-4 h-4" /> Book a review</Link>
          </div>
        </div>
      </section>

      <footer className="border-t bg-white">
        <div className="mx-auto max-w-[1280px] px-5 sm:px-6 py-4 flex items-center justify-between mono text-xs font-bold text-muted-foreground">
          <span>© 2026 LendSure • Decision support only</span>
          <span>Auto-refresh every 5 min</span>
        </div>
      </footer>
    </div>
  );
}
