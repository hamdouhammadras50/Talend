import { db } from "@/lib/db";
import { PageHeader, Card } from "@/components/StatCard";
import { AdjustStockForm } from "../AdjustStockForm";

export default async function AdjustStockPage() {
  const [products, warehouses] = await Promise.all([
    db.product.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
    db.warehouse.findMany({ orderBy: { name: "asc" } }),
  ]);

  return (
    <div>
      <PageHeader
        title="Ajustement de stock"
        description="Corriger manuellement une quantité (inventaire, casse, erreur de saisie…)"
      />
      <Card className="max-w-xl p-5">
        <AdjustStockForm products={products} warehouses={warehouses} />
      </Card>
    </div>
  );
}
