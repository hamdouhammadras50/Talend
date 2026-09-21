"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { createPurchase, StockError } from "@/lib/stock";

const lineSchema = z.object({
  productId: z.string().min(1),
  quantityContainers: z.coerce.number().min(0),
  quantityLiters: z.coerce.number().positive(),
  unitCostPerLiter: z.coerce.number().min(0),
});

const formSchema = z.object({
  supplierId: z.string().optional(),
  warehouseId: z.string().min(1, "Choisissez un entrepôt."),
  date: z.string().min(1, "La date est obligatoire."),
  notes: z.string().trim().optional(),
  lines: z.array(lineSchema).min(1, "Ajoutez au moins une ligne de produit."),
});

export type PurchaseFormState = { error?: string };

export async function createPurchaseAction(
  _prevState: PurchaseFormState,
  formData: FormData
): Promise<PurchaseFormState> {
  const session = await requireUser();

  let linesRaw: unknown = [];
  try {
    linesRaw = JSON.parse(String(formData.get("linesJson") ?? "[]"));
  } catch {
    return { error: "Lignes de produit invalides." };
  }

  const parsed = formSchema.safeParse({
    supplierId: formData.get("supplierId") || undefined,
    warehouseId: formData.get("warehouseId"),
    date: formData.get("date"),
    notes: formData.get("notes"),
    lines: linesRaw,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Formulaire invalide." };
  }

  try {
    const purchase = await createPurchase({
      supplierId: parsed.data.supplierId,
      warehouseId: parsed.data.warehouseId,
      date: new Date(parsed.data.date),
      notes: parsed.data.notes,
      createdById: session.sub,
      lines: parsed.data.lines.map((l) => ({
        productId: l.productId,
        quantityContainers: l.quantityContainers,
        quantityLiters: l.quantityLiters,
        unitPriceOrCost: l.unitCostPerLiter,
      })),
    });
    revalidatePath("/purchases");
    revalidatePath("/stock");
    revalidatePath("/dashboard");
    redirect(`/purchases/${purchase.id}`);
  } catch (error) {
    if (error instanceof StockError) return { error: error.message };
    throw error;
  }
}
