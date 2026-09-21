export function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

const currencyFormatter = new Intl.NumberFormat("fr-FR", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

export function formatMoney(value: number) {
  return `${currencyFormatter.format(value)} FCFA`;
}

const numberFormatter = new Intl.NumberFormat("fr-FR", {
  maximumFractionDigits: 2,
});

export function formatNumber(value: number) {
  return numberFormatter.format(value);
}

export function formatLiters(value: number) {
  return `${numberFormatter.format(value)} L`;
}

const dateFormatter = new Intl.DateTimeFormat("fr-FR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

const dateTimeFormatter = new Intl.DateTimeFormat("fr-FR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

export function formatDate(value: Date | string) {
  return dateFormatter.format(new Date(value));
}

export function formatDateTime(value: Date | string) {
  return dateTimeFormatter.format(new Date(value));
}

export function litersToContainers(liters: number, litersPerContainer: number) {
  if (!litersPerContainer) return 0;
  return liters / litersPerContainer;
}

export function buttonClasses(variant: "primary" | "danger" | "secondary" = "primary") {
  const base =
    "inline-flex items-center justify-center gap-1.5 rounded-md px-3.5 py-2 text-sm font-medium transition-colors";
  switch (variant) {
    case "danger":
      return cn(base, "bg-red-600 text-white hover:bg-red-700");
    case "secondary":
      return cn(base, "bg-white text-slate-700 border border-slate-300 hover:bg-slate-50");
    default:
      return cn(base, "bg-amber-600 text-white hover:bg-amber-700");
  }
}
