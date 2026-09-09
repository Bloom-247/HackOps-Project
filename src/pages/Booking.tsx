import { useMemo, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router";
import { ArrowLeft, CalendarRange, Clock3, CreditCard, CheckCircle2, AlertTriangle, Sparkles, CloudCheck, LockKeyhole } from "lucide-react";
import { analyzeBorrower, getBorrowerById, formatINR } from "@/lib/trustLend";
import { useQuery, useMutation, useConvexAuth } from "convex/react";
import { api } from "@/convex/_generated/api";

const DEMO_ID = "TL-0420";

export default function Booking() {
  const [search] = useSearchParams();
  const params = useParams();
  const borrowerId = params.id ?? search.get("borrower") ?? DEMO_ID;
  const synthetic = useMemo(() => getBorrowerById(borrowerId) ?? getBorrowerById(DEMO_ID)!, [borrowerId]);
  const serverDoc = useQuery(api.lendsure.getBorrower, { borrowerId }) as unknown as Record<string, unknown> | null | undefined;
  const borrower = useMemo(() => {
    if (serverDoc && (serverDoc as Record<string, unknown>).borrower_id) {
      const { _id, _creationTime, ownerId, ...rest } = serverDoc as Record<string, unknown> & { _id: unknown; ownerId: unknown };
      return rest as unknown as typeof synthetic;
    }
    return synthetic;
  }, [serverDoc, synthetic]);

  const base = useMemo(() => analyzeBorrower(borrower!), [borrower]);
  const bookings = useQuery(api.lendsure.listBookings) as unknown as { borrowerId: string; kind: string; status: string; amount?: number; createdAt: number }[] | undefined;
  const createBooking = useMutation(api.lendsure.createBooking);
  const { isAuthenticated } = useConvexAuth();

  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [slot, setSlot] = useState("10:30 AM • Team review");
  const [paying, setPaying] = useState(false);
  const [paid, setPaid] = useState(false);
  const [bookedLocal, setBookedLocal] = useState(false);
  const [error, setError] = useState("");
  const slots = ["09:00 AM • Underwriting", "10:30 AM • Team review", "02:00 PM • Disbursement check", "04:00 PM • Callback"];

  const handlePay = async () => {
    setPaying(true);
    setError("");
    const scheduledAt = new Date(`${date}T10:00:00`).getTime();
    if (isAuthenticated) {
      try {
        await createBooking({ borrowerId: borrower.borrower_id, kind: slot, amount: base.recommendedAmount, note: `Booked ${date} • ${slot}`, scheduledAt });
        setPaid(true);
        setPaying(false);
        return;
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    }
    // local fallback
    setTimeout(() => {
      setPaying(false);
      setBookedLocal(true);
    }, 700);
  };

  const recentBookings = (bookings ?? []).filter((b) => b.borrowerId === borrower.borrower_id).slice(0, 3);

  return (
    <div className="min-h-screen bg-[#FCFCF9] text-foreground">
      <header className="sticky top-0 z-40 glass-header">
        <div className="mx-auto max-w-[1080px] px-5 h-[64px] flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="w-9 h-9 rounded-xl bg-foreground text-background flex items-center justify-center font-black text-sm">LS</span>
            <span className="font-bold tracking-tight text-[15px]">LendSure</span>
            <span className="hidden sm:inline mono text-[11px] font-semibold tracking-widest bg-muted px-2.5 py-1 rounded-full">BOOK • PAY</span>
            {isAuthenticated ? <span className="hidden sm:inline mono text-[11px] font-black bg-emerald-500 text-white px-2.5 py-1 rounded-full flex items-center gap-1"><CloudCheck className="w-3 h-3" /> Server</span> : <span className="hidden sm:inline mono text-[11px] font-black bg-amber-400 px-2.5 py-1 rounded-full flex items-center gap-1"><LockKeyhole className="w-3 h-3" /> Local</span>}
          </div>
          <div className="flex items-center gap-2">
            <Link to="/dashboard" className="h-9 px-4 rounded-full border bg-white font-medium text-sm inline-flex items-center gap-1.5"><ArrowLeft className="w-4 h-4" /> Workspace</Link>
            <Link to="/admin" className="hidden sm:inline-flex h-9 px-4 rounded-full bg-foreground text-background font-semibold text-sm items-center">Admin</Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1080px] px-5 py-6 sm:py-8 space-y-6">
        <section className="premium-card p-6 sm:p-8">
          <div className="flex items-start gap-3">
            <span className="hidden sm:flex w-10 h-10 rounded-2xl bg-primary text-white items-center justify-center shrink-0"><CalendarRange className="w-5 h-5" /></span>
            <div className="flex-1">
              <h1 className="text-[28px] leading-none">Schedule a review and check out</h1>
              <p className="text-[15px] leading-6 text-muted-foreground mt-2 max-w-[680px]">Book a time for your team to review the case, then confirm payment or disbursement. {isAuthenticated ? "Saved to your team on the server." : "Sign in to persist bookings to your team."}</p>
            </div>
            <span className="hidden sm:inline-flex mono text-xs font-semibold bg-muted px-3 py-1.5 rounded-full items-center gap-1.5"><Sparkles className="w-3 h-3 text-primary" /> {isAuthenticated ? "Persisted" : "Demo flow"}</span>
          </div>

          <div className="mt-8 grid lg:grid-cols-[1.05fr_0.95fr] gap-6">
            <div className="rounded-2xl border bg-amber-50/40 p-5 sm:p-6">
              <p className="mono text-xs font-bold tracking-[0.1em] text-primary">1 — PICK A TIME</p>
              <h3 className="mt-1 font-bold">Choose when your team meets</h3>
              <label className="text-sm font-semibold mt-4 block">Date<input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="mt-1.5 w-full h-11 border bg-white px-3 rounded-full text-sm font-medium" /></label>
              <p className="text-sm font-semibold mt-4">Time slot</p>
              <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2">
                {slots.map((s) => (
                  <button key={s} onClick={() => setSlot(s)} className={`h-11 border text-sm font-semibold px-3 text-left rounded-full ${slot === s ? "bg-foreground text-background border-foreground" : "bg-white hover:bg-muted border"}`}>{s}</button>
                ))}
              </div>
              <div className="mt-4 rounded-2xl border bg-white px-3 py-2.5 flex items-center gap-2 text-sm">
                <Clock3 className="w-4 h-4 shrink-0 text-primary" /> Selected: <span className="font-bold">{date}</span> • {slot}
              </div>
              {isAuthenticated && recentBookings.length > 0 && (
                <div className="mt-4 rounded-2xl border bg-white p-3">
                  <p className="mono text-xs font-black">YOUR TEAM BOOKINGS FOR {borrower.borrower_id}</p>
                  <div className="mt-2 space-y-1.5">
                    {recentBookings.map((b, i) => (
                      <div key={i} className="flex items-center justify-between mono text-xs font-bold border rounded-full px-3 py-1.5 bg-muted/20">
                        <span>{b.kind} • {new Date(b.createdAt).toLocaleDateString()}</span>
                        <span className="bg-emerald-500 text-white px-2 py-0.5 rounded-full">{b.status}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <p className="mono text-xs text-muted-foreground mt-3 border bg-white px-3 py-2 rounded-full flex items-center gap-1.5">{isAuthenticated ? <><CloudCheck className="w-3.5 h-3.5 text-emerald-600" /> Bookings are saved to your team and visible in Admin.</> : "Your team will see this booking after you sign in."}</p>
            </div>

            <div className="rounded-2xl border bg-white p-5 sm:p-6 shadow-sm">
              <p className="mono text-xs font-bold tracking-[0.1em] flex items-center gap-2"><CreditCard className="w-4 h-4 text-primary" /> 2 — PAY & CHECK OUT</p>
              <h3 className="mt-1 font-bold">Confirm the terms</h3>
              <div className="mt-4 rounded-2xl bg-foreground text-white p-5">
                <p className="mono text-xs font-semibold tracking-widest text-white/60">CASE {base.borrower.borrower_id} • {base.borrower.city}</p>
                <p className="text-[22px] font-bold mt-1" style={{ fontFamily: "Fraunces, serif" }}>{formatINR(base.recommendedAmount)} <span className="text-sm font-semibold mono text-white/70">@ {base.interestRate}% • {base.durationMonths} mo</span></p>
                <p className="text-sm font-medium text-white/70">EMI {formatINR(base.monthlyPayment)}/mo • Trust {base.trustScore}/100 • {String(base.decision).split("_").join(" ")}</p>
                <p className="mono text-xs text-white/40 mt-2 leading-4">Mock checkout — no real money moves. {isAuthenticated ? "Confirmed bookings are persisted." : "Sign in to persist."}</p>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2 mono text-xs font-semibold text-center">
                <span className="border bg-amber-50 px-2 py-2.5 rounded-2xl">BOOKED<br /><span className="text-[11px] font-bold">{slot}</span></span>
                <span className="border bg-white px-2 py-2.5 rounded-2xl">DATE<br /><span className="text-[11px] font-bold">{date}</span></span>
              </div>
              {error && <p className="mt-3 mono text-xs font-bold bg-red-50 border border-red-200 text-red-800 px-3 py-2 rounded-full">{error}</p>}
              {!paid && !bookedLocal ? (
                <button
                  onClick={handlePay}
                  disabled={paying}
                  className="mt-5 w-full h-12 rounded-full bg-foreground text-background font-bold text-sm inline-flex items-center justify-center gap-2 disabled:opacity-60 hover:bg-foreground/90"
                >
                  {paying ? "Processing…" : isAuthenticated ? "Confirm & save to team" : "Confirm & pay"} <CreditCard className="w-4 h-4" />
                </button>
              ) : (
                <div className="mt-5 rounded-2xl border bg-emerald-50 border-emerald-100 p-4 flex items-start gap-3">
                  <span className="w-8 h-8 rounded-full bg-emerald-500 text-white flex items-center justify-center shrink-0"><CheckCircle2 className="w-4 h-4" /></span>
                  <div><p className="font-bold text-sm leading-none">{paid ? "Booked and saved to your team" : "Booked — local confirmation"}</p><p className="text-sm leading-5 text-muted-foreground mt-1">{paid ? "Your booking is on the server. Your team can see it in Admin and on the detail page." : "Sign in to persist bookings so your whole team sees them."}</p></div>
                </div>
              )}
              <div className="mt-4 rounded-2xl border bg-amber-50 px-3 py-2.5 flex gap-2.5 items-start">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-600" />
                <p className="text-xs leading-5 text-muted-foreground">Every step is linked to evidence and the audit log. For production, connect your payment provider here — the booking mutation is ready.</p>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2">
                <Link to="/dashboard" className="h-10 rounded-full border bg-white font-semibold text-sm flex items-center justify-center gap-1.5"><ArrowLeft className="w-4 h-4" /> Dashboard</Link>
                <Link to={`/borrower/${base.borrower.borrower_id}`} className="h-10 rounded-full bg-foreground text-background font-semibold text-sm flex items-center justify-center">View detail</Link>
              </div>
            </div>
          </div>
        </section>
        <p className="mono text-xs font-medium border bg-white px-4 py-3 rounded-full text-center text-muted-foreground">LENDSURE INTERNAL • {isAuthenticated ? "Bookings are persisted per team on Convex — evidence-linked, audit-ready." : "Sign in to persist bookings per team on Convex."}</p>
      </main>
    </div>
  );
}
