import { requireUser } from "@/lib/auth";
import { Sidebar } from "@/components/Sidebar";
import { logoutAction } from "./logout-action";

const ROLE_LABELS: Record<string, string> = {
  ADMIN: "Administrateur",
  VENDEUR: "Vendeur",
};

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireUser();

  return (
    <div className="flex min-h-screen">
      <aside className="hidden w-60 shrink-0 border-r border-slate-200 bg-white md:flex md:flex-col">
        <div className="flex items-center gap-2 border-b border-slate-200 px-4 py-4">
          <span className="text-xl" aria-hidden>
            🛢️
          </span>
          <span className="font-semibold text-slate-900">StockHuile</span>
        </div>
        <div className="flex-1 overflow-y-auto">
          <Sidebar role={session.role} />
        </div>
      </aside>

      <div className="flex min-h-screen flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3 md:px-6">
          <div className="md:hidden font-semibold text-slate-900">StockHuile</div>
          <div className="ml-auto flex items-center gap-4">
            <div className="text-right text-sm">
              <div className="font-medium text-slate-900">{session.name}</div>
              <div className="text-xs text-slate-500">
                {ROLE_LABELS[session.role] ?? session.role}
              </div>
            </div>
            <form action={logoutAction}>
              <button
                type="submit"
                className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
              >
                Déconnexion
              </button>
            </form>
          </div>
        </header>

        <div className="md:hidden border-b border-slate-200 bg-white">
          <Sidebar role={session.role} />
        </div>

        <main className="flex-1 bg-slate-50 p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
