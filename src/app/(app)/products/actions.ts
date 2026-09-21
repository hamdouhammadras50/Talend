"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";

const productSchema = z.object({
  name: z.string().trim().min(1, "Le nom est obligatoire."),
  description: z.string().trim().optional(),
  litersPerContainer: z.coerce.number().positive("Doit être supérieur à 0."),
  wholesalePrice: z.coerce.number().min(0),
  retailPrice: z.coerce.number().min(0),
  minStockLiters: z.coerce.number().min(0),
  active: z.coerce.boolean().default(true),
});

export type ProductFormState = { error?: string };

function parseForm(formData: FormData) {
  return productSchema.safeParse({
    name: formData.get("name"),
    description: formData.get("description"),
    litersPerContainer: formData.get("litersPerContainer"),
    wholesalePrice: formData.get("wholesalePrice"),
    retailPrice: formData.get("retailPrice"),
    minStockLiters: formData.get("minStockLiters"),
    active: formData.get("active") === "on",
  });
}

export async function createProduct(
  _prevState: ProductFormState,
  formData: FormData
): Promise<ProductFormState> {
  await requireUser();
  const parsed = parseForm(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Formulaire invalide." };
  }

  try {
    await db.product.create({ data: parsed.data });
  } catch {
    return { error: "Un produit avec ce nom existe déjà." };
  }

  revalidatePath("/products");
  redirect("/products");
}

export async function updateProduct(
  _prevState: ProductFormState,
  formData: FormData
): Promise<ProductFormState> {
  await requireUser();
  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "Produit introuvable." };

  const parsed = parseForm(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Formulaire invalide." };
  }

  try {
    await db.product.update({ where: { id }, data: parsed.data });
  } catch {
    return { error: "Un produit avec ce nom existe déjà." };
  }

  revalidatePath("/products");
  redirect("/products");
}

export async function deleteProduct(formData: FormData) {
  await requireUser();
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const [movements, purchaseLines, saleLines] = await Promise.all([
    db.stockMovement.count({ where: { productId: id } }),
    db.purchaseLine.count({ where: { productId: id } }),
    db.saleLine.count({ where: { productId: id } }),
  ]);

  if (movements > 0 || purchaseLines > 0 || saleLines > 0) {
    redirect(
      `/products?error=${encodeURIComponent(
        "Impossible de supprimer ce produit : des achats, ventes ou mouvements y sont liés. Vous pouvez le désactiver à la place."
      )}`
    );
  }

  await db.stockLot.deleteMany({ where: { productId: id } });
  await db.product.delete({ where: { id } });

  revalidatePath("/products");
  redirect("/products");
}
