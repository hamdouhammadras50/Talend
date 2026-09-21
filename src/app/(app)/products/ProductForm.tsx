"use client";

import { useActionState } from "react";
import type { Product } from "@prisma/client";
import { SubmitButton, FormError } from "@/components/ui";
import { createProduct, updateProduct, type ProductFormState } from "./actions";

const initialState: ProductFormState = {};

export function ProductForm({ product }: { product?: Product }) {
  const action = product ? updateProduct : createProduct;
  const [state, formAction] = useActionState(action, initialState);

  return (
    <form action={formAction} className="space-y-4">
      {product ? <input type="hidden" name="id" value={product.id} /> : null}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Nom du produit" required>
          <input
            name="name"
            required
            defaultValue={product?.name}
            placeholder="Huile d'olive extra vierge"
            className={inputClasses}
          />
        </Field>

        <Field label="Volume par conteneur (L)" required>
          <input
            name="litersPerContainer"
            type="number"
            step="0.01"
            min="0"
            required
            defaultValue={product?.litersPerContainer ?? 200}
            className={inputClasses}
          />
        </Field>

        <Field label="Prix de gros (par litre)" required>
          <input
            name="wholesalePrice"
            type="number"
            step="0.01"
            min="0"
            required
            defaultValue={product?.wholesalePrice ?? 0}
            className={inputClasses}
          />
        </Field>

        <Field label="Prix de détail (par litre)" required>
          <input
            name="retailPrice"
            type="number"
            step="0.01"
            min="0"
            required
            defaultValue={product?.retailPrice ?? 0}
            className={inputClasses}
          />
        </Field>

        <Field label="Seuil de stock minimum (L)">
          <input
            name="minStockLiters"
            type="number"
            step="0.01"
            min="0"
            defaultValue={product?.minStockLiters ?? 0}
            className={inputClasses}
          />
        </Field>

        <Field label="Statut">
          <label className="flex items-center gap-2 pt-2 text-sm text-slate-700">
            <input
              type="checkbox"
              name="active"
              defaultChecked={product?.active ?? true}
              className="h-4 w-4 rounded border-slate-300"
            />
            Produit actif
          </label>
        </Field>
      </div>

      <Field label="Description">
        <textarea
          name="description"
          rows={2}
          defaultValue={product?.description ?? ""}
          className={inputClasses}
        />
      </Field>

      <FormError message={state.error} />

      <div className="flex justify-end gap-2">
        <SubmitButton>{product ? "Enregistrer" : "Créer le produit"}</SubmitButton>
      </div>
    </form>
  );
}

const inputClasses =
  "w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500";

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <label className="text-sm font-medium text-slate-700">
        {label}
        {required ? <span className="text-red-500"> *</span> : null}
      </label>
      {children}
    </div>
  );
}
