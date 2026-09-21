import { db } from "@/lib/db";
import { PageHeader, Card } from "@/components/StatCard";
import { SaleForm } from "../SaleForm";

export default async function NewSalePage() {
  const [products, clients, warehouses, stockLots] = await Promise.all([
    db.product.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
    db.client.findMany({ orderBy: { name: "asc" } }),
    db.warehouse.findMany({ orderBy: { name: "asc" } }),
    db.stockLot.findMany({ select: { productId: true, warehouseId: true, quantityLiters: true } }),
  ]);

  return (
    <div>
      <PageHeader title="Nouvelle vente" description="Enregistrer une vente en gros ou au détail" />
      <Card className="max-w-5xl p-5">
        <SaleForm products={products} clients={clients} warehouses={warehouses} stockLots={stockLots} />
      </Card>
    </div>
  );
}
