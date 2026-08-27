import { Link } from "react-router-dom";

export function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100">
      <header className="border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-4">
          <Link
            to="/"
            className="flex items-center gap-2 text-lg font-semibold text-slate-900 dark:text-white"
          >
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 ring-1 ring-emerald-500/40">
              S
            </span>
            SmartSeen
          </Link>
          <Link
            to="/"
            className="text-sm font-medium text-emerald-600 dark:text-emerald-400 hover:underline"
          >
            Back to home
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-8">
        <h1 className="text-2xl font-bold tracking-tight">Privacy Policy</h1>
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
          Last updated: March 2026
        </p>
        <div className="prose prose-slate dark:prose-invert mt-6 max-w-none space-y-4 text-sm">
          <section>
            <h2 className="text-lg font-semibold">1. Who we are</h2>
            <p>
              SmartSeen is a business platform for accounting, HR, payroll and employee recognition.
              This privacy policy describes how we collect, use and protect your information when you
              use our service. SmartSeen is powered by Smart Macmane.
            </p>
          </section>
          <section>
            <h2 className="text-lg font-semibold">2. Information we collect</h2>
            <p>
              We collect information you provide when you register (e.g. name, email, business name),
              and data you create when using the platform (invoices, employees, expenses, etc.).
              We also collect technical data such as IP address and usage for security and
              operational purposes.
            </p>
          </section>
          <section>
            <h2 className="text-lg font-semibold">3. How we use it</h2>
            <p>
              We use your information to provide and improve the service, to communicate with you
              (e.g. welcome emails, verification), to enforce our terms, and to comply with law.
              We do not sell your personal data to third parties.
            </p>
          </section>
          <section>
            <h2 className="text-lg font-semibold">4. Data storage and security</h2>
            <p>
              Your data is stored securely. We use industry standard measures to protect it.
              Access tokens are used for authentication; we recommend you keep your credentials
              secure and log out on shared devices.
            </p>
          </section>
          <section>
            <h2 className="text-lg font-semibold">5. Cookies and local storage</h2>
            <p>
              We use local storage to keep you signed in (e.g. authentication state). We do not
              use cookies for tracking or advertising. If we introduce non essential cookies in the
              future, we will ask for your consent where required by law.
            </p>
          </section>
          <section>
            <h2 className="text-lg font-semibold">6. Your rights (GDPR / POPIA)</h2>
            <p>
              Depending on your location, you may have the right to access, correct, delete or
              export your data, or to object to certain processing. To exercise these rights or
              ask questions, contact us using the details on our website or in the app.
            </p>
          </section>
          <section>
            <h2 className="text-lg font-semibold">7. Changes</h2>
            <p>
              We may update this policy from time to time. We will post the updated version here
              and, where appropriate, notify you. Continued use of the service after changes
              constitutes acceptance.
            </p>
          </section>
        </div>
        <footer className="mt-10 border-t border-slate-200 dark:border-slate-700 pt-6 text-xs text-slate-500 dark:text-slate-400">
          SmartSeen is powered by{" "}
          <a
            href="https://smartmacmane.dev"
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-slate-700 dark:text-slate-300 hover:underline"
          >
            Smart Macmane
          </a>
        </footer>
      </main>
    </div>
  );
}
