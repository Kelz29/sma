import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useMutation } from "@tanstack/react-query";
import { api } from "@/lib/axios";

/** Free stock video: accounters analyzing business documents (Mixkit, accounting/finance). */
const BACKGROUND_VIDEO_URL = "https://assets.mixkit.co/videos/48976/48976-720.mp4";

const LANDING_DISMISS_KEY = "smartseen_landing_promo_dismiss";
const LANDING_DISMISS_TTL_MS = 24 * 60 * 60 * 1000; // 24h

interface LandingData {
  slots_left: number;
  total_slots: number;
  registration_open: boolean;
}

function useLanding() {
  return useQuery<LandingData>({
    queryKey: ["public", "landing"],
    queryFn: async () => {
      const res = await api.get<LandingData>("/landing");
      return res.data;
    },
    // Show counter even if API fails (e.g. backend not running) – use defaults so design is visible
    retry: false,
  });
}

function PromoModal({
  slotsLeft,
  totalSlots,
  onClose,
  onDismissAgain,
}: {
  slotsLeft: number;
  totalSlots: number;
  onClose: () => void;
  onDismissAgain: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="promo-title">
      <div className="absolute inset-0 bg-slate-900/80 backdrop-blur-sm" aria-hidden onClick={onClose} />
      <div className="relative w-full max-w-md rounded-2xl border border-emerald-500/30 bg-slate-900 shadow-2xl ring-1 ring-white/10">
        <div className="p-6 sm:p-8">
          <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-500/20 text-2xl font-bold text-emerald-400 ring-1 ring-emerald-500/40">
            S
          </div>
          <h2 id="promo-title" className="text-xl font-semibold tracking-tight text-white sm:text-2xl">
            Free SmartSeen for the first {totalSlots} businesses
          </h2>
          <p className="mt-2 text-slate-300">
            Join founders and teams who already use SmartSeen for accounting, HR and recognition.
          </p>
          <div className="mt-6 flex flex-col items-center gap-3 rounded-xl bg-slate-800/80 py-4">
            <span className="text-3xl font-bold tabular-nums text-emerald-400">{slotsLeft}</span>
            <span className="text-sm font-medium text-slate-300">spaces left</span>
          </div>
          <div className="mt-6 flex flex-col gap-3">
            <Link
              to="/register"
              className="inline-flex items-center justify-center rounded-xl bg-brand-primary px-4 py-3 text-sm font-medium text-white shadow-lg hover:bg-brand-primary-hover"
            >
              Claim your free spot
            </Link>
            <button
              type="button"
              onClick={onDismissAgain}
              className="text-xs text-slate-400 hover:text-slate-300"
            >
              Don&apos;t show again for 24 hours
            </button>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="absolute right-3 top-3 rounded-lg p-1.5 text-slate-400 hover:bg-white/10 hover:text-white"
          aria-label="Close"
        >
          <span className="sr-only">Close</span>
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
}

function WaitlistForm() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: async (e: string) => {
      const res = await api.post<{ message: string }>("/waitlist", { email: e.trim().toLowerCase() });
      return res.data;
    },
    onSuccess: (data) => {
      setSubmitted(true);
      setMessage(data.message);
      setEmail("");
    },
    onError: (err: { response?: { data?: { detail?: string } } }) => {
      setMessage(err.response?.data?.detail || "Something went wrong. Please try again.");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = email.trim();
    if (!trimmed) return;
    setMessage(null);
    mutation.mutate(trimmed);
  };

  if (submitted && message) {
    return (
      <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-6 py-4 text-center">
        <p className="font-medium text-emerald-300">{message}</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-center">
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="you@company.com"
        required
        className="min-w-0 flex-1 rounded-xl border border-white/20 bg-slate-800/80 px-4 py-3 text-sm text-slate-100 placeholder:text-slate-500 focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/30 outline-none sm:max-w-xs"
      />
      <button
        type="submit"
        disabled={mutation.isPending}
        className="rounded-xl bg-brand-primary px-5 py-3 text-sm font-medium text-white shadow-lg hover:bg-brand-primary-hover disabled:opacity-70"
      >
        {mutation.isPending ? "Joining…" : "Join waitlist"}
      </button>
      {message && <p className="text-sm text-red-400">{message}</p>}
    </form>
  );
}

export function LandingPage() {
  const { data: landing, isLoading } = useLanding();
  const [promoClosed, setPromoClosed] = useState(false);
  const [promoDismissed, setPromoDismissed] = useState(() => {
    try {
      const raw = localStorage.getItem(LANDING_DISMISS_KEY);
      if (!raw) return false;
      const t = parseInt(raw, 10);
      return Date.now() < t;
    } catch {
      return false;
    }
  });

  const showPromoModal =
    landing?.registration_open &&
    landing.slots_left > 0 &&
    !promoClosed &&
    !promoDismissed;

  const dismissPromo = () => {
    setPromoClosed(true);
  };

  const dismissPromoAgain = () => {
    try {
      localStorage.setItem(LANDING_DISMISS_KEY, String(Date.now() + LANDING_DISMISS_TTL_MS));
    } catch {
      // ignore
    }
    setPromoDismissed(true);
    setPromoClosed(true);
  };

  const registrationOpen = landing?.registration_open ?? true;
  const slotsLeft = landing?.slots_left ?? 50;
  const totalSlots = landing?.total_slots ?? 50;

  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-900 text-slate-50">
      {/* Background video */}
      <div className="absolute inset-0">
        <video
          autoPlay
          loop
          muted
          playsInline
          className="h-full w-full object-cover"
          poster="https://assets.mixkit.co/videos/48976/48976-thumb-720-3.jpg"
        >
          <source src={BACKGROUND_VIDEO_URL} type="video/mp4" />
        </video>
        <div className="absolute inset-0 bg-slate-900/70" aria-hidden />
      </div>

      <div className="relative z-10 flex min-h-screen flex-col">
        <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-6">
          <div className="flex items-center gap-2">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/20 text-emerald-400 ring-1 ring-emerald-500/40">
              <span className="text-lg font-semibold">S</span>
            </span>
            <span className="text-lg font-semibold tracking-tight">SmartSeen</span>
          </div>
          <nav className="flex items-center gap-4 text-sm">
            <Link
              to="/login"
              className="rounded-lg px-3 py-2 text-slate-200 hover:bg-white/10 hover:text-white"
            >
              Log in
            </Link>
            {registrationOpen && (
              <Link
                to="/register"
                className="rounded-lg bg-brand-primary px-4 py-2 text-sm font-medium text-white shadow-lg hover:bg-brand-primary-hover"
              >
                Get started
              </Link>
            )}
          </nav>
        </header>

        <main className="mx-auto flex flex-1 w-full max-w-3xl flex-col items-center justify-center px-4 py-12 text-center">
          {!isLoading && !registrationOpen ? (
            /* Waitlist: slots full */
            <>
              <p className="mb-4 inline-flex items-center rounded-full bg-amber-500/20 px-3 py-1 text-xs font-medium text-amber-300 ring-1 ring-amber-500/40">
                We&apos;re at capacity
              </p>
              <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl md:text-5xl">
                Join the <span className="bg-gradient-to-r from-emerald-300 to-sky-300 bg-clip-text text-transparent">waitlist</span>
              </h1>
              <p className="mt-4 max-w-xl text-sm text-slate-300 sm:text-base">
                The first {totalSlots} spots are taken. Leave your email and we&apos;ll contact you as soon as SmartSeen can welcome you onboard.
              </p>
              <div className="mt-8 w-full max-w-md">
                <WaitlistForm />
              </div>
              <p className="mt-6 text-xs text-slate-400">
                Already have an account?{" "}
                <Link to="/login" className="font-medium text-emerald-400 hover:text-emerald-300">
                  Sign in
                </Link>
              </p>
            </>
          ) : (
            /* Normal hero + CTA with always-visible spots counter */
            <>
              <p className="mb-4 inline-flex items-center rounded-full bg-emerald-500/20 px-3 py-1 text-xs font-medium text-emerald-300 ring-1 ring-emerald-500/40">
                Accounting, HR, payroll &amp; employee recognition in one place
              </p>
              {/* Promo: first 50 businesses – counter always visible */}
              <div className="mb-6 w-full max-w-sm rounded-2xl border border-amber-500/40 bg-amber-500/10 px-5 py-4 shadow-lg ring-1 ring-amber-500/20">
                <p className="text-xs font-semibold uppercase tracking-wider text-amber-300">
                  Limited offer — free SmartSeen for the first {totalSlots} businesses
                </p>
                <div className="mt-3 flex items-center justify-center gap-2">
                  <span className="text-4xl font-bold tabular-nums leading-none text-amber-400">
                    {isLoading ? "…" : slotsLeft}
                  </span>
                  <span className="text-lg font-medium leading-tight text-slate-300">spots left</span>
                </div>
                <p className="mt-2 text-xs text-slate-400">
                  Secure your spot — register today
                </p>
              </div>
              <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl md:text-5xl">
                Stay on top of{" "}
                <span className="bg-gradient-to-r from-emerald-300 to-sky-300 bg-clip-text text-transparent">
                  finances, people and recognition
                </span>
              </h1>
              <p className="mt-4 max-w-xl text-sm text-slate-300 sm:text-base">
                One clean dashboard for founders, bookkeepers and growing teams including employee recognition.
              </p>
              <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
                <Link
                  to="/register"
                  className="inline-flex rounded-xl bg-brand-primary px-5 py-2.5 text-sm font-medium text-white shadow-lg hover:bg-brand-primary-hover"
                >
                  Claim your free spot
                </Link>
                <Link
                  to="/login"
                  className="inline-flex rounded-xl border border-white/30 px-5 py-2.5 text-sm font-medium text-slate-100 hover:bg-white/10"
                >
                  Sign in
                </Link>
                
              </div>
            </>
          )}
        </main>

        <footer className="mx-auto w-full max-w-6xl px-4 py-6 text-center">
          <p className="text-xs text-slate-400">
            <Link to="/privacy" className="font-medium text-slate-300 hover:text-white underline underline-offset-2">
              Privacy policy
            </Link>
            {" · "}
            SmartSeen is powered by{" "}
            <a
              href="https://smartmacmane.dev"
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-slate-200 hover:text-white underline underline-offset-2"
            >
              Smart Macmane
            </a>
          </p>
        </footer>
      </div>

      {showPromoModal && (
        <PromoModal
          slotsLeft={slotsLeft}
          totalSlots={totalSlots}
          onClose={dismissPromo}
          onDismissAgain={dismissPromoAgain}
        />
      )}
    </div>
  );
}
