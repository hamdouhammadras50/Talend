"use client";

import { useActionState, useMemo, useRef, useState } from "react";
import type { Client, Product, Warehouse } from "@prisma/client";
import { SubmitButton, FormError } from "@/components/ui";
import { formatLiters, formatMoney } from "@/lib/utils";
import { createSaleAction, type SaleFormState } from "./actions";

const initialState: SaleFormState = {};
const inputClasses =
  "w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500";

type SaleType = "GROS" | "DETAIL";

type Line = {
  key: string;
  productId: string;
  unitType: "CONTAINER" | "LITER";
  quantity: number;
  unitPricePerLiter: number;
  priceTouched: boolean;
};

let keySeq = 0;
function defaultPrice(product: Product | undefined, saleType: SaleType) {
  if (!product) return 0;
  return saleType === "GROS" ? product.wholesalePrice : product.retailPrice;
}
function newLine(product: Product | undefined, saleType: SaleType): Line {
  keySeq += 1;
  return {
    key: `line-${keySeq}`,
    productId: product?.id ?? "",
    unitType: "CONTAINER",
    quantity: 1,
    unitPricePerLiter: defaultPrice(product, saleType),
    priceTouched: false,
  };
}

export function SaleForm({
  products,
  clients,
  warehouses,
  stockLots,
}: {
  products: Product[];
  clients: Client[];
  warehouses: Warehouse[];
  stockLots: { productId: string; warehouseId: string; quantityLiters: number }[];
}) {
  const [state, formAction] = useActionState(createSaleAction, initialState);
  const [saleType, setSaleType] = useState<SaleType>("DETAIL");
  const [warehouseId, setWarehouseId] = useState(warehouses[0]?.id ?? "");
  const firstProduct = products[0];
  const [lines, setLines] = useState<Line[]>(() =>
    firstProduct ? [newLine(firstProduct, "DETAIL")] : []
  );
  const linesJsonRef = useRef<HTMLInputElement>(null);

  const productById = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);
  const stockFor = (productId: string) =>
    stockLots.find((s) => s.productId === productId && s.warehouseId === warehouseId)
      ?.quantityLiters ?? 0;

  const computedLines = lines.map((line) => {
    const product = productById.get(line.productId);
    const litersPerContainer = product?.litersPerContainer ?? 0;
    const quantityLiters =
      line.unitType === "CONTAINER" ? line.quantity * litersPerContainer : line.quantity;
    const quantityContainers = line.unitType === "CONTAINER" ? line.quantity : 0;
    const lineTotal = quantityLiters * line.unitPricePerLiter;
    const available = stockFor(line.productId);
    return {
      ...line,
      product,
      quantityLiters,
      quantityContainers,
      lineTotal,
      available,
      exceedsStock: quantityLiters > available,
    };
  });

  const totalAmount = computedLines.reduce((sum, l) => sum + l.lineTotal, 0);
  const hasStockIssue = computedLines.some((l) => l.exceedsStock);

  function updateLine(key: string, patch: Partial<Line>) {
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  }

  function handleSaleTypeChange(next: SaleType) {
    setSaleType(next);
    setLines((prev) =>
      prev.map((l) =>
        l.priceTouched ? l : { ...l, unitPricePerLiter: defaultPrice(productById.get(l.productId), next) }
      )
    );
  }

  function handleProductChange(key: string, productId: string) {
    const product = productById.get(productId);
    updateLine(key, {
      productId,
      unitPricePerLiter: defaultPrice(product, saleType),
      priceTouched: false,
    });
  }

  function handleSubmit() {
    const payload = computedLines
      .filter((l) => l.productId && l.quantityLiters > 0)
      .map((l) => ({
        productId: l.productId,
        quantityContainers: l.quantityContainers,
        quantityLiters: l.quantityLiters,
        unitPricePerLiter: l.unitPricePerLiter,
      }));
    if (linesJsonRef.current) {
      linesJsonRef.current.value = JSON.stringify(payload);
    }
  }

  const today = new Date().toISOString().slice(0, 10);

  return (
    <form action={formAction} onSubmit={handleSubmit} className="space-y-6">
      <input type="hidden" name="linesJson" ref={linesJsonRef} />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-1">
          <label className="text-sm font-medium text-slate-700">Type de vente *</label>
          <select
            name="saleType"
            value={saleType}
            onChange={(e) => handleSaleTypeChange(e.target.value as SaleType)}
            className={inputClasses}
          >
            <option value="DETAIL">Détail</option>
            <option value="GROS">Gros</option>
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium text-slate-700">Client</label>
          <select name="clientId" defaultValue="" className={inputClasses}>
            <option value="">— Client de passage —</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium text-slate-700">Entrepôt de sortie *</label>
          <select
            name="warehouseId"
            required
            value={warehouseId}
            onChange={(e) => setWarehouseId(e.target.value)}
            className={inputClasses}
          >
            {warehouses.length === 0 ? <option value="">Aucun entrepôt</option> : null}
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
          <label className="text-sm font-medium text-slate-700">Produits vendus</label>
          <button
            type="button"
            onClick={() => setLines((prev) => [...prev, newLine(firstProduct, saleType)])}
            className="text-sm font-medium text-amber-700 hover:underline"
          >
            + Ajouter une ligne
          </button>
        </div>

        {products.length === 0 ? (
          <p className="text-sm text-slate-500">Créez d&apos;abord un produit pour pouvoir saisir une vente.</p>
        ) : (
          <div className="overflow-x-auto rounded-md border border-slate-200">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-3 py-2">Produit</th>
                  <th className="px-3 py-2">Unité</th>
                  <th className="px-3 py-2">Quantité</th>
                  <th className="px-3 py-2">= Litres</th>
                  <th className="px-3 py-2">Stock dispo.</th>
                  <th className="px-3 py-2">Prix / L</th>
                  <th className="px-3 py-2">Total</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {computedLines.map((line) => (
                  <tr key={line.key} className={line.exceedsStock ? "bg-red-50" : undefined}>
                    <td className="px-3 py-2">
                      <select
                        value={line.productId}
                        onChange={(e) => handleProductChange(line.key, e.target.value)}
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
                    <td className={`px-3 py-2 ${line.exceedsStock ? "font-medium text-red-600" : "text-slate-600"}`}>
                      {formatLiters(line.available)}
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={line.unitPricePerLiter}
                        onChange={(e) =>
                          updateLine(line.key, {
                            unitPricePerLiter: Number(e.target.value),
                            priceTouched: true,
                          })
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

        {hasStockIssue ? (
          <p className="mt-2 text-sm font-medium text-red-600">
            Attention : une ou plusieurs lignes dépassent le stock disponible dans cet entrepôt.
          </p>
        ) : null}

        <div className="mt-2 text-right text-sm font-medium text-slate-700">
          Total vente : {formatMoney(totalAmount)}
        </div>
      </div>

      <div className="space-y-1">
        <label className="text-sm font-medium text-slate-700">Notes</label>
        <textarea name="notes" rows={2} className={inputClasses} />
      </div>

      <FormError message={state.error} />

      <div className="flex justify-end">
        <SubmitButton pendingText="Enregistrement…">Enregistrer la vente</SubmitButton>
      </div>
    </form>
  );
}
