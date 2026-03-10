import { FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "@/lib/axios";
import { useAuthStore } from "@/store/authStore";
import { decodeAccessToken } from "./LoginPage";

/** Same as landing and login: accounting-related background video (Mixkit). */
const BACKGROUND_VIDEO_URL = "https://assets.mixkit.co/videos/48976/48976-720.mp4";

export function RegisterPage() {
  const navigate = useNavigate();
  const setAuth = useAuthStore((s) => s.setAuth);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    const formData = new FormData(event.currentTarget);
    const fullName = String(formData.get("name") || "");
    const email = String(formData.get("email") || "");
    const password = String(formData.get("password") || "");
    const tenantName = String(formData.get("tenant_name") || "");
    const tenantSlug = String(formData.get("tenant_slug") || "");

    try {
      const res = await api.post("/auth/register", {
        email,
        password,
        full_name: fullName,
        tenant_name: tenantName,
        tenant_slug: tenantSlug,
      });

      const accessToken: string = res.data.access_token;
      const decoded = decodeAccessToken(accessToken);

      if (!decoded) {
        throw new Error("Invalid access token received from server");
      }

      setAuth({
        accessToken,
        tenantId: decoded.tenantId,
        user: {
          id: decoded.userId,
          email,
          role: decoded.role,
        },
      });

      navigate("/dashboard");
    } catch (e: unknown) {
      const err = e as { response?: { status?: number; data?: { detail?: string } } };
      if (err.response?.status === 503) {
        setError(err.response?.data?.detail || "Free business slots are full. Join the waitlist and we'll contact you when a spot opens.");
      } else {
        setError("Registration failed. Check your details and try again.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-900 text-slate-50">
      {/* Same background video as landing and login */}
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
          <Link to="/" className="flex items-center gap-2">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/20 text-emerald-400 ring-1 ring-emerald-500/40">
              <span className="text-lg font-semibold">S</span>
            </span>
            <span className="text-lg font-semibold tracking-tight">SmartSeen</span>
          </Link>
          <nav className="flex items-center gap-4 text-sm">
            <Link
              to="/login"
              className="rounded-lg px-3 py-2 text-slate-200 hover:bg-white/10 hover:text-white"
            >
              Log in
            </Link>
            <span className="rounded-lg px-3 py-2 text-slate-100">Get started</span>
          </nav>
        </header>

        <main className="mx-auto flex flex-1 w-full max-w-md items-center justify-center px-4 py-8">
          <div className="w-full rounded-2xl border border-white/10 bg-slate-900/80 p-6 shadow-2xl backdrop-blur sm:p-8">
            <div className="mb-6 space-y-2 text-center">
              <h1 className="text-2xl font-semibold tracking-tight text-slate-50">
                Create your account
              </h1>
              <p className="text-sm text-slate-400">
                Start tracking invoices, expenses and banking in minutes.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label
                  htmlFor="name"
                  className="block text-xs font-medium text-slate-300"
                >
                  Full name
                </label>
                <input
                  id="name"
                  name="name"
                  type="text"
                  required
                  className="block w-full rounded-xl border border-white/20 bg-slate-800/80 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/30 outline-none"
                  placeholder="Jane Doe"
                />
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor="email"
                  className="block text-xs font-medium text-slate-300"
                >
                  Work email
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  required
                  className="block w-full rounded-xl border border-white/20 bg-slate-800/80 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/30 outline-none"
                  placeholder="you@company.com"
                />
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor="password"
                  className="block text-xs font-medium text-slate-300"
                >
                  Password
                </label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  required
                  className="block w-full rounded-xl border border-white/20 bg-slate-800/80 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/30 outline-none"
                  placeholder="Create a strong password"
                />
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor="tenant_name"
                  className="block text-xs font-medium text-slate-300"
                >
                  Business name
                </label>
                <input
                  id="tenant_name"
                  name="tenant_name"
                  type="text"
                  required
                  className="block w-full rounded-xl border border-white/20 bg-slate-800/80 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/30 outline-none"
                  placeholder="My Company Ltd"
                />
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor="tenant_slug"
                  className="block text-xs font-medium text-slate-300"
                >
                  Business slug
                </label>
                <input
                  id="tenant_slug"
                  name="tenant_slug"
                  type="text"
                  required
                  className="block w-full rounded-xl border border-white/20 bg-slate-800/80 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/30 outline-none"
                  placeholder="my-company"
                />
              </div>

              {error && (
                <div className="space-y-2">
                  <p className="text-xs text-red-400">{error}</p>
                  {error.includes("waitlist") && (
                    <Link to="/" className="text-xs font-medium text-emerald-400 hover:text-emerald-300">
                      Go to waitlist →
                    </Link>
                  )}
                </div>
              )}

              <button
                type="submit"
                disabled={isSubmitting}
                className="mt-2 inline-flex w-full items-center justify-center rounded-xl bg-brand-primary px-4 py-3 text-sm font-medium text-white shadow-lg hover:bg-brand-primary-hover disabled:opacity-70 min-h-[44px]"
              >
                {isSubmitting ? "Creating account..." : "Create account"}
              </button>
            </form>

            <p className="mt-5 text-center text-xs text-slate-400">
              Already have an account?{" "}
              <Link
                to="/login"
                className="font-medium text-emerald-400 hover:text-emerald-300"
              >
                Sign in
              </Link>
            </p>
          </div>
        </main>
      </div>
    </div>
  );
}

