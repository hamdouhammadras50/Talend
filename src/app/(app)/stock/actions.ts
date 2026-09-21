"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { adjustStock, StockError } from "@/lib/stock";

const schema = z.object({
  productId: z.string().min(1, "Choisissez un produit."),
  warehouseId: z.string().min(1, "Choisissez un entrepôt."),
  direction: z.enum(["IN", "OUT"]),
  quantityLiters: z.coerce.number().positive("La quantité doit être supérieure à 0."),
  note: z.string().trim().optional(),
});

export type AdjustStockState = { error?: string };

export async function adjustStockAction(
  _prevState: AdjustStockState,
  formData: FormData
): Promise<AdjustStockState> {
  await requireUser();

  const parsed = schema.safeParse({
    productId: formData.get("productId"),
    warehouseId: formData.get("warehouseId"),
    direction: formData.get("direction"),
    quantityLiters: formData.get("quantityLiters"),
    note: formData.get("note"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Formulaire invalide." };
  }

  const delta =
    parsed.data.direction === "IN" ? parsed.data.quantityLiters : -parsed.data.quantityLiters;

  try {
    await adjustStock({
      productId: parsed.data.productId,
      warehouseId: parsed.data.warehouseId,
      deltaLiters: delta,
      note: parsed.data.note,
    });
  } catch (error) {
    if (error instanceof StockError) return { error: error.message };
    throw error;
  }

  revalidatePath("/stock");
  redirect("/stock");
}
