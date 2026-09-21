"use client";

import { useActionState, useMemo, useRef, useState } from "react";
import type { Product, Supplier, Warehouse } from "@prisma/client";
import { SubmitButton, FormError } from "@/components/ui";
import { formatLiters, formatMoney } from "@/lib/utils";
import { createPurchaseAction, type PurchaseFormState } from "./actions";

const initialState: PurchaseFormState = {};
const inputClasses =
  "w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500";

type Line = {
  key: string;
  productId: string;
  unitType: "CONTAINER" | "LITER";
  quantity: number;
  unitCostPerLiter: number;
};

let keySeq = 0;
function newLine(defaultProductId: string): Line {
  keySeq += 1;
  return {
    key: `line-${keySeq}`,
    productId: defaultProductId,
    unitType: "CONTAINER",
    quantity: 1,
    unitCostPerLiter: 0,
  };
}

export function PurchaseForm({
  products,
  suppliers,
  warehouses,
}: {
  products: Product[];
  suppliers: Supplier[];
  warehouses: Warehouse[];
}) {
  const [state, formAction] = useActionState(createPurchaseAction, initialState);
  const firstProductId = products[0]?.id ?? "";
  const [lines, setLines] = useState<Line[]>(() => (firstProductId ? [newLine(firstProductId)] : []));
  const linesJsonRef = useRef<HTMLInputElement>(null);

  const productById = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);

  const computedLines = lines.map((line) => {
    const product = productById.get(line.productId);
    const litersPerContainer = product?.litersPerContainer ?? 0;
    const quantityLiters =
      line.unitType === "CONTAINER" ? line.quantity * litersPerContainer : line.quantity;
    const quantityContainers = line.unitType === "CONTAINER" ? line.quantity : 0;
    const lineTotal = quantityLiters * line.unitCostPerLiter;
    return { ...line, product, quantityLiters, quantityContainers, lineTotal };
  });

  const totalCost = computedLines.reduce((sum, l) => sum + l.lineTotal, 0);

  function updateLine(key: string, patch: Partial<Line>) {
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  }

  function handleSubmit() {
    const payload = computedLines
      .filter((l) => l.productId && l.quantityLiters > 0)
      .map((l) => ({
        productId: l.productId,
        quantityContainers: l.quantityContainers,
        quantityLiters: l.quantityLiters,
        unitCostPerLiter: l.unitCostPerLiter,
      }));
    if (linesJsonRef.current) {
      linesJsonRef.current.value = JSON.stringify(payload);
    }
  }

  const today = new Date().toISOString().slice(0, 10);

  return (
    <form action={formAction} onSubmit={handleSubmit} className="space-y-6">
      <input type="hidden" name="linesJson" ref={linesJsonRef} />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="space-y-1">
          <label className="text-sm font-medium text-slate-700">Fournisseur</label>
          <select name="supplierId" defaultValue="" className={inputClasses}>
            <option value="">— Aucun —</option>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium text-slate-700">Entrepôt de réception *</label>
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
        <div className="space-y-1">
          <label className="text-sm font-medium text-slate-700">Date *</label>
          <input name="date" type="date" required defaultValue={today} className={inputClasses} />
        </div>
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <label className="text-sm font-medium text-slate-700">Produits achetés</label>
          <button
            type="button"
            onClick={() => setLines((prev) => [...prev, newLine(firstProductId)])}
            className="text-sm font-medium text-amber-700 hover:underline"
          >
            + Ajouter une ligne
          </button>
        </div>

        {products.length === 0 ? (
          <p className="text-sm text-slate-500">Créez d&apos;abord un produit pour pouvoir saisir un achat.</p>
        ) : (
          <div className="overflow-x-auto rounded-md border border-slate-200">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-3 py-2">Produit</th>
                  <th className="px-3 py-2">Unité</th>
                  <th className="px-3 py-2">Quantité</th>
                  <th className="px-3 py-2">= Litres</th>
                  <th className="px-3 py-2">Coût / L</th>
                  <th className="px-3 py-2">Total</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {computedLines.map((line) => (
                  <tr key={line.key}>
                    <td className="px-3 py-2">
                      <select
                        value={line.productId}
                        onChange={(e) => updateLine(line.key, { productId: e.target.value })}
                        className={inputClasses}
                      >
                        {products.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-3 py-2">
                      <select
                        value={line.unitType}
                        onChange={(e) =>
                          updateLine(line.key, { unitType: e.target.value as Line["unitType"] })
                        }
                        className={inputClasses}
                      >
                        <option value="CONTAINER">Conteneur</option>
                        <option value="LITER">Litre</option>
                      </select>
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={line.quantity}
                        onChange={(e) => updateLine(line.key, { quantity: Number(e.target.value) })}
                        className={`${inputClasses} w-24`}
                      />
                    </td>
                    <td className="px-3 py-2 text-slate-600">{formatLiters(line.quantityLiters)}</td>
                    <td className="px-3 py-2">
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={line.unitCostPerLiter}
                        onChange={(e) =>
                          updateLine(line.key, { unitCostPerLiter: Number(e.target.value) })
                        }
                        className={`${inputClasses} w-24`}
                      />
                    </td>
                    <td className="px-3 py-2 font-medium text-slate-800">
                      {formatMoney(line.lineTotal)}
                    </td>
                    <td className="px-3 py-2">
                      <button
                        type="button"
                        onClick={() => setLines((prev) => prev.filter((l) => l.key !== line.key))}
                        disabled={lines.length === 1}
                        className="text-red-600 hover:underline disabled:cursor-not-allowed disabled:text-slate-300"
                      >
                        Retirer
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="mt-2 text-right text-sm font-medium text-slate-700">
          Total achat : {formatMoney(totalCost)}
        </div>
      </div>

      <div className="space-y-1">
        <label className="text-sm font-medium text-slate-700">Notes</label>
        <textarea name="notes" rows={2} className={inputClasses} />
      </div>

      <FormError message={state.error} />

      <div className="flex justify-end">
        <SubmitButton pendingText="Enregistrement…">Enregistrer l&apos;achat</SubmitButton>
      </div>
    </form>
  );
}
