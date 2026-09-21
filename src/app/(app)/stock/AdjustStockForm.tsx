"use client";

import { useActionState } from "react";
import type { Product, Warehouse } from "@prisma/client";
import { SubmitButton, FormError } from "@/components/ui";
import { adjustStockAction, type AdjustStockState } from "./actions";

const initialState: AdjustStockState = {};
const inputClasses =
  "w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500";

export function AdjustStockForm({
  products,
  warehouses,
}: {
  products: Product[];
  warehouses: Warehouse[];
}) {
  const [state, formAction] = useActionState(adjustStockAction, initialState);

  return (
    <form action={formAction} className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-1">
          <label className="text-sm font-medium text-slate-700">Produit *</label>
          <select name="productId" required defaultValue="" className={inputClasses}>
            <option value="" disabled>
              Sélectionner…
            </option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium text-slate-700">Entrepôt *</label>
          <select name="warehouseId" required defaultValue="" className={inputClasses}>
            <option value="" disabled>
              Sélectionner…
            </option>
            {warehouses.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-1">
          <label className="text-sm font-medium text-slate-700">Sens de l&apos;ajustement *</label>
          <select name="direction" defaultValue="IN" className={inputClasses}>
            <option value="IN">Ajouter au stock (entrée)</option>
            <option value="OUT">Retirer du stock (sortie)</option>
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium text-slate-700">Quantité (litres) *</label>
          <input
            name="quantityLiters"
            type="number"
            step="0.01"
            min="0.01"
            required
            className={inputClasses}
          />
        </div>
      </div>

      <div className="space-y-1">
        <label className="text-sm font-medium text-slate-700">Motif / note</label>
        <input
          name="note"
          placeholder="Ex: inventaire physique, casse, correction d'erreur…"
          className={inputClasses}
        />
      </div>

      <FormError message={state.error} />

      <div className="flex justify-end">
        <SubmitButton>Enregistrer l&apos;ajustement</SubmitButton>
      </div>
    </form>
  );
}
