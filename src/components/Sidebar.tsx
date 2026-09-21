"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import type { Role } from "@prisma/client";

const NAV_ITEMS: Array<{ href: string; label: string; icon: string; adminOnly?: boolean }> = [
  { href: "/dashboard", label: "Tableau de bord", icon: "📊" },
  { href: "/stock", label: "Stock", icon: "🛢️" },
  { href: "/purchases", label: "Achats", icon: "📥" },
  { href: "/sales", label: "Ventes", icon: "📤" },
  { href: "/products", label: "Produits", icon: "🧴" },
  { href: "/clients", label: "Clients", icon: "🧑‍💼" },
  { href: "/suppliers", label: "Fournisseurs", icon: "🚚" },
  { href: "/warehouses", label: "Entrepôts", icon: "🏬" },
  { href: "/users", label: "Utilisateurs", icon: "🔑", adminOnly: true },
];

export function Sidebar({ role }: { role: Role }) {
  const pathname = usePathname();

  return (
    <nav className="flex flex-col gap-1 p-3">
      {NAV_ITEMS.filter((item) => !item.adminOnly || role === "ADMIN").map((item) => {
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-colors",
              active
                ? "bg-amber-100 text-amber-900"
                : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
            )}
          >
            <span aria-hidden>{item.icon}</span>
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
