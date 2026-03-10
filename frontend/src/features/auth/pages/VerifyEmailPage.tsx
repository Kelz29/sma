import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api } from "@/lib/axios";

const BACKGROUND_VIDEO_URL = "https://assets.mixkit.co/videos/48976/48976-720.mp4";

type Status = "loading" | "success" | "error";

export function VerifyEmailPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");
  const [status, setStatus] = useState<Status>("loading");
  const [message, setMessage] = useState<string>("");

  useEffect(() => {
    if (!token) {
      setStatus("error");
      setMessage("Missing verification link.");
      return;
    }
    api
      .get("/auth/verify-email", { params: { token } })
      .then(() => {
        setStatus("success");
        setMessage("Your email is verified. You can sign in and use SmartSeen.");
      })
      .catch((err: { response?: { data?: { detail?: string } } }) => {
        setStatus("error");
        setMessage(err.response?.data?.detail || "Verification failed. The link may be invalid or expired.");
      });
  }, [token]);

  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-900 text-slate-50">
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

      <div className="relative z-10 flex min-h-screen flex-col items-center justify-center px-4 py-12">
        <div className="w-full max-w-md rounded-2xl border border-white/10 bg-slate-900/80 p-6 shadow-2xl backdrop-blur sm:p-8">
          <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-500/20 text-2xl font-bold text-emerald-400 ring-1 ring-emerald-500/40">
            S
          </div>
          <h1 className="text-xl font-semibold tracking-tight text-white">
            {status === "loading" && "Verifying your email…"}
            {status === "success" && "Email verified"}
            {status === "error" && "Verification failed"}
          </h1>
          <p className="mt-2 text-sm text-slate-300">
            {status === "loading" && "Please wait."}
            {status === "success" && message}
            {status === "error" && message}
          </p>
          {(status === "success" || status === "error") && (
            <div className="mt-6">
              <Link
                to={status === "success" ? "/login" : "/"}
                className="inline-flex rounded-xl bg-brand-primary px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-primary-hover"
              >
                {status === "success" ? "Sign in" : "Back to home"}
              </Link>
            </div>
          )}
        </div>
        <p className="mt-6 text-xs text-slate-400">
          Powered by{" "}
          <a
            href="https://smartmacmane.dev"
            target="_blank"
            rel="noopener noreferrer"
            className="text-slate-300 hover:text-white"
          >
            Smart Macmane
          </a>
        </p>
      </div>
    </div>
  );
}
