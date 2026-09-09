import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { useAuth } from "@/hooks/use-auth";
import { ArrowRight, Loader2, Mail, UserX, Shield, Sparkles } from "lucide-react";
import { Suspense, useEffect, useState } from "react";
import { useNavigate, useSearchParams, Link } from "react-router";

interface AuthProps {
  redirectAfterAuth?: string;
}

function resolveRedirectAfterAuth(returnTo: string | null, fallback = "/dashboard") {
  if (returnTo?.startsWith("/") && !returnTo.startsWith("//")) return returnTo;
  return fallback;
}

function Auth({ redirectAfterAuth }: AuthProps = {}) {
  const { isLoading: authLoading, isAuthenticated, signIn } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const redirect = resolveRedirectAfterAuth(searchParams.get("returnTo"), redirectAfterAuth);
  const [step, setStep] = useState<"signIn" | { email: string }>("signIn");
  const [otp, setOtp] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && isAuthenticated) navigate(redirect);
  }, [authLoading, isAuthenticated, navigate, redirect]);

  const handleEmailSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsLoading(true);
    setError(null);
    try {
      const formData = new FormData(event.currentTarget);
      await signIn("email-otp", formData);
      setStep({ email: formData.get("email") as string });
      setIsLoading(false);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Failed to send verification code. Please try again.");
      setIsLoading(false);
    }
  };

  const handleOtpSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsLoading(true);
    setError(null);
    try {
      const formData = new FormData(event.currentTarget);
      await signIn("email-otp", formData);
      navigate(redirect);
    } catch {
      setError("The verification code you entered is incorrect.");
      setIsLoading(false);
      setOtp("");
    }
  };

  const handleGuestLogin = async () => {
    setIsLoading(true);
    setError(null);
    try {
      await signIn("anonymous");
      navigate(redirect);
    } catch (error) {
      setError(`Failed to sign in: ${error instanceof Error ? error.message : "Unknown error"}`);
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FCFCF9] flex flex-col">
      <header className="h-[64px] glass-header flex items-center justify-between px-5">
        <Link to="/" className="flex items-center gap-3">
          <span className="w-9 h-9 rounded-xl bg-foreground text-background flex items-center justify-center font-black text-sm">LS</span>
          <span className="font-bold tracking-tight text-[15px]">LendSure</span>
          <span className="hidden sm:inline mono text-[11px] font-semibold tracking-widest bg-muted px-2.5 py-1 rounded-full">INTERNAL</span>
        </Link>
        <span className="hidden sm:inline mono text-xs font-semibold border bg-white px-3 py-1.5 rounded-full">Private workspace • Evidence-first</span>
      </header>

      <div className="flex-1 flex items-center justify-center p-5 sm:p-8">
        <div className="w-full max-w-[460px]">
          <div className="rounded-2xl bg-foreground text-white px-4 py-3 flex items-center justify-between gap-3 mb-4">
            <span className="mono text-xs font-semibold flex items-center gap-2"><Shield className="w-4 h-4 text-primary" /> Internal access only</span>
            <span className="mono text-xs font-medium bg-white/10 border border-white/10 px-2.5 py-1 rounded-full flex items-center gap-1.5"><Sparkles className="w-3 h-3 text-primary" /> LendSure</span>
          </div>

          <Card className="rounded-[20px] border shadow-xl pb-0 overflow-hidden">
            {step === "signIn" ? (
              <>
                <CardHeader className="text-center pb-3 pt-7">
                  <div className="flex justify-center">
                    <span className="w-14 h-14 rounded-2xl bg-foreground text-background flex items-center justify-center font-black">LS</span>
                  </div>
                  <CardTitle className="text-[24px] mt-4" style={{ fontFamily: "Fraunces, serif" }}>Welcome to LendSure</CardTitle>
                  <CardDescription className="text-[15px] leading-6 mt-1.5">Your team&apos;s private lending workspace. Sign in to upload cases, browse the catalog, and decide together.</CardDescription>
                </CardHeader>
                <form onSubmit={handleEmailSubmit}>
                  <CardContent className="space-y-4">
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <Mail className="absolute left-3.5 top-[14px] h-4 w-4 text-muted-foreground" />
                        <Input name="email" placeholder="you@yourteam.com" type="email" className="pl-10 h-11 text-[15px] font-medium rounded-full" disabled={isLoading} required />
                      </div>
                      <Button type="submit" size="icon" disabled={isLoading} className="h-11 w-11 shrink-0 rounded-full">
                        {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
                      </Button>
                    </div>
                    {error && <p className="text-sm font-medium text-red-600 border border-red-200 bg-red-50 px-3 py-2 rounded-2xl">{error}</p>}
                    <div className="relative py-1">
                      <div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div>
                      <div className="relative flex justify-center"><span className="bg-white px-3 mono text-xs font-bold">OR</span></div>
                    </div>
                    <Button type="button" variant="outline" className="w-full h-11 rounded-full font-semibold text-sm" onClick={handleGuestLogin} disabled={isLoading}>
                      <UserX className="mr-2 h-4 w-4" /> Continue as guest (demo)
                    </Button>
                    <p className="text-xs leading-5 text-muted-foreground border bg-muted/30 px-3 py-2.5 rounded-2xl">You&apos;ll get your own dashboard, the ability to post cases, comment on detail pages, and full access to Admin and Booking.</p>
                  </CardContent>
                </form>
              </>
            ) : (
              <>
                <CardHeader className="text-center pt-7">
                  <CardTitle className="text-[22px]" style={{ fontFamily: "Fraunces, serif" }}>Check your email</CardTitle>
                  <CardDescription className="text-sm leading-6">We sent a code to <span className="font-semibold text-foreground">{step.email}</span></CardDescription>
                </CardHeader>
                <form onSubmit={handleOtpSubmit}>
                  <CardContent className="pb-4 space-y-4">
                    <input type="hidden" name="email" value={step.email} />
                    <input type="hidden" name="code" value={otp} />
                    <div className="flex justify-center">
                      <InputOTP value={otp} onChange={setOtp} maxLength={6} disabled={isLoading} onKeyDown={(e) => {
                        if (e.key === "Enter" && otp.length === 6 && !isLoading) {
                          const form = (e.target as HTMLElement).closest("form");
                          if (form) form.requestSubmit();
                        }
                      }}>
                        <InputOTPGroup>
                          {Array.from({ length: 6 }).map((_, index) => (
                            <InputOTPSlot key={index} index={index} className="h-11 w-11 text-base font-bold rounded-xl" />
                          ))}
                        </InputOTPGroup>
                      </InputOTP>
                    </div>
                    {error && <p className="text-sm font-medium text-red-600 text-center border border-red-200 bg-red-50 px-3 py-2 rounded-2xl">{error}</p>}
                    <p className="text-sm text-muted-foreground text-center">
                      Didn&apos;t get a code? <Button variant="link" className="p-0 h-auto text-sm font-bold underline" onClick={() => setStep("signIn")}>Try again</Button>
                    </p>
                  </CardContent>
                  <CardFooter className="flex-col gap-2.5 pb-6">
                    <Button type="submit" className="w-full h-11 rounded-full font-semibold text-sm" disabled={isLoading || otp.length !== 6}>
                      {isLoading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Verifying…</> : <>Verify code <ArrowRight className="ml-2 h-4 w-4" /></>}
                    </Button>
                    <Button type="button" variant="ghost" onClick={() => setStep("signIn")} disabled={isLoading} className="w-full h-10 rounded-full font-semibold text-sm">Use a different email</Button>
                  </CardFooter>
                </form>
              </>
            )}
            <div className="py-3 px-6 text-center mono text-xs font-medium bg-muted/30 border-t">Internal workspace • Not a public credit bureau • <Link to="/" className="font-bold underline">Back to overview</Link></div>
          </Card>
          <p className="text-xs leading-5 text-center mt-4 text-muted-foreground max-w-[420px] mx-auto">Professional, minimal, and evidence-first — built for operators making real lending decisions with their team.</p>
        </div>
      </div>
    </div>
  );
}

export default function AuthPage(props: AuthProps) {
  return (
    <Suspense>
      <Auth {...props} />
    </Suspense>
  );
}
