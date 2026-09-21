"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { createSale, StockError } from "@/lib/stock";

const lineSchema = z.object({
  productId: z.string().min(1),
  quantityContainers: z.coerce.number().min(0),
  quantityLiters: z.coerce.number().positive(),
  unitPricePerLiter: z.coerce.number().min(0),
});

const formSchema = z.object({
  clientId: z.string().optional(),
  warehouseId: z.string().min(1, "Choisissez un entrepôt."),
  saleType: z.enum(["GROS", "DETAIL"]),
  date: z.string().min(1, "La date est obligatoire."),
  notes: z.string().trim().optional(),
  lines: z.array(lineSchema).min(1, "Ajoutez au moins une ligne de produit."),
});

export type SaleFormState = { error?: string };

export async function createSaleAction(
  _prevState: SaleFormState,
  formData: FormData
): Promise<SaleFormState> {
  const session = await requireUser();

  let linesRaw: unknown = [];
  try {
    linesRaw = JSON.parse(String(formData.get("linesJson") ?? "[]"));
  } catch {
    return { error: "Lignes de produit invalides." };
  }

  const parsed = formSchema.safeParse({
    clientId: formData.get("clientId") || undefined,
    warehouseId: formData.get("warehouseId"),
    saleType: formData.get("saleType"),
    date: formData.get("date"),
    notes: formData.get("notes"),
    lines: linesRaw,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Formulaire invalide." };
  }

  try {
    const sale = await createSale({
      clientId: parsed.data.clientId,
      warehouseId: parsed.data.warehouseId,
      saleType: parsed.data.saleType,
      date: new Date(parsed.data.date),
      notes: parsed.data.notes,
      createdById: session.sub,
      lines: parsed.data.lines.map((l) => ({
        productId: l.productId,
        quantityContainers: l.quantityContainers,
        quantityLiters: l.quantityLiters,
        unitPriceOrCost: l.unitPricePerLiter,
      })),
    });
    revalidatePath("/sales");
    revalidatePath("/stock");
    revalidatePath("/dashboard");
    redirect(`/sales/${sale.id}`);
  } catch (error) {
    if (error instanceof StockError) return { error: error.message };
    throw error;
  }
}
