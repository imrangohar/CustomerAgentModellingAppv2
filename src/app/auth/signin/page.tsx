import Link from "next/link";
import { signIn } from "../../../../auth";

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string }>;
}) {
  const { callbackUrl } = await searchParams;
  const safeCallback = callbackUrl || "/onboarding";

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-xl items-center justify-center px-4">
      <div className="w-full rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <h1 className="text-2xl font-semibold text-slate-900">Sign in to continue</h1>
        <p className="mt-2 text-sm text-slate-600">
          Continue with Google to access this workspace. Only <span className="font-semibold">@appzen.com</span> accounts are allowed.
        </p>

        <form
          className="mt-6"
          action={async () => {
            "use server";
            await signIn("google", { redirectTo: safeCallback });
          }}
        >
          <button
            type="submit"
            className="inline-flex w-full items-center justify-center rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-800"
          >
            Continue with Google
          </button>
        </form>

        <p className="mt-4 text-xs text-slate-500">
          If you are not part of AppZen, access will be denied. <Link href="/auth/denied" className="text-blue-700 underline">Learn more</Link>.
        </p>
      </div>
    </main>
  );
}
