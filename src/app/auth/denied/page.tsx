import Link from "next/link";

export default function DeniedPage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-xl items-center justify-center px-4">
      <div className="w-full rounded-2xl border border-rose-200 bg-rose-50 p-8">
        <h1 className="text-2xl font-semibold text-rose-900">Access restricted</h1>
        <p className="mt-2 text-sm text-rose-800">
          This application is only available to users with an <span className="font-semibold">@appzen.com</span> Google account.
        </p>
        <div className="mt-5">
          <Link
            href="/auth/signin"
            className="inline-flex items-center rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-800"
          >
            Try again
          </Link>
        </div>
      </div>
    </main>
  );
}
