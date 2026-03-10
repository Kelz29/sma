import { FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "@/lib/axios";
import { useAuthStore } from "@/store/authStore";

/** Same as landing page: accounting-related background video (Mixkit). */
const BACKGROUND_VIDEO_URL = "https://assets.mixkit.co/videos/48976/48976-720.mp4";

export function decodeAccessToken(token: string) {
  try {
    const [, payloadPart] = token.split(".");
    const payloadJson = atob(payloadPart);
    const payload = JSON.parse(payloadJson) as {
      sub?: string;
      tenant_id?: number | string;
      role?: string;
    };

    if (!payload.sub || payload.tenant_id == null || !payload.role) {
      return null;
    }

    return {
      userId: String(payload.sub),
      tenantId: Number(payload.tenant_id),
      role: payload.role,
    };
  } catch {
    return null;
  }
}

export function LoginPage() {
  const navigate = useNavigate();
  const setAuth = useAuthStore((s) => s.setAuth);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    const formData = new FormData(event.currentTarget);
    const email = String(formData.get("email") || "");
    const password = String(formData.get("password") || "");
    const tenantSlug = String(formData.get("tenant_slug") || "");

    try {
      const res = await api.post("/auth/login", {
        email,
        password,
        tenant_slug: tenantSlug,
      });

      const accessToken = res.data?.access_token;
      if (typeof accessToken !== "string" || !accessToken) {
        throw new Error("Invalid response from server");
      }

      const decoded = decodeAccessToken(accessToken);
      if (!decoded) {
        throw new Error("Invalid access token received from server");
      }

      const role = String(decoded.role);
      setAuth({
        accessToken,
        tenantId: String(decoded.tenantId),
        user: {
          id: decoded.userId,
          email,
          role,
        },
      });

      if (role === "employee") navigate("/portal");
      else if (role === "superadmin") navigate("/superadmin");
      else navigate("/dashboard");
    } catch (e: unknown) {
      const msg =
        e && typeof e === "object" && "response" in e && e.response && typeof e.response === "object" && "data" in e.response && e.response.data && typeof e.response.data === "object" && "detail" in e.response.data
          ? String((e.response.data as { detail: unknown }).detail)
          : "Login failed. Check your credentials, tenant slug, and backend.";
      setError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-900 text-slate-50">
      {/* Same background video as landing page */}
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
            <span className="rounded-lg px-3 py-2 text-slate-100">Log in</span>
            <Link
              to="/register"
              className="rounded-lg bg-brand-primary px-4 py-2 text-sm font-medium text-white shadow-lg hover:bg-brand-primary-hover"
            >
              Get started
            </Link>
          </nav>
        </header>

        <main className="mx-auto flex flex-1 w-full max-w-md items-center justify-center px-4 py-8">
          <div className="w-full rounded-2xl border border-white/10 bg-slate-900/80 p-6 shadow-2xl backdrop-blur sm:p-8">
            <div className="mb-6 space-y-2 text-center">
              <h1 className="text-2xl font-semibold tracking-tight text-slate-50">
                Welcome back
              </h1>
              <p className="text-sm text-slate-400">
                Sign in to access your SmartSeen dashboard.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label
                  htmlFor="email"
                  className="block text-xs font-medium text-slate-300"
                >
                  Email
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  required
                  className="block w-full rounded-xl border border-white/20 bg-slate-800/80 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/30 outline-none"
                  placeholder="you@example.com"
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
                  placeholder="••••••••"
                />
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor="tenant_slug"
                  className="block text-xs font-medium text-slate-300"
                >
                  Tenant slug
                </label>
                <input
                  id="tenant_slug"
                  name="tenant_slug"
                  required
                  className="block w-full rounded-xl border border-white/20 bg-slate-800/80 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/30 outline-none"
                  placeholder="e.g. my-company"
                />
              </div>

              {error && (
                <p className="text-xs text-red-400">{error}</p>
              )}

              <button
                type="submit"
                disabled={isSubmitting}
                className="mt-2 inline-flex w-full items-center justify-center rounded-xl bg-brand-primary px-4 py-3 text-sm font-medium text-white shadow-lg hover:bg-brand-primary-hover disabled:opacity-70 min-h-[44px]"
              >
                {isSubmitting ? "Signing in..." : "Sign in"}
              </button>
            </form>

            <p className="mt-5 text-center text-xs text-slate-400">
              Don&apos;t have an account?{" "}
              <Link
                to="/register"
                className="font-medium text-emerald-400 hover:text-emerald-300"
              >
                Create one
              </Link>
            </p>
          </div>
        </main>
      </div>
    </div>
  );
}

