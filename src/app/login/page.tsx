import { LoginForm } from "./LoginForm";

export default async function LoginPage({
  searchParams,
}: PageProps<"/login">) {
  const params = await searchParams;
  const nextParam = params?.next;
  const next = Array.isArray(nextParam) ? nextParam[0] : nextParam ?? "/dashboard";

  return (
    <div className="flex flex-1 items-center justify-center bg-gradient-to-b from-amber-50 to-slate-100 px-4">
      <div className="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 text-2xl">
            🛢️
          </div>
          <h1 className="text-lg font-semibold text-slate-900">StockHuile</h1>
          <p className="mt-1 text-sm text-slate-500">
            Gestion de stock d&apos;huile — connectez-vous
          </p>
        </div>
        <LoginForm next={next} />
      </div>
    </div>
  );
}
