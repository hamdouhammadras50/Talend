import { db } from "@/lib/db";
import { PageHeader, Card } from "@/components/StatCard";
import { PurchaseForm } from "../PurchaseForm";

export default async function NewPurchasePage() {
  const [products, suppliers, warehouses] = await Promise.all([
    db.product.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
    db.supplier.findMany({ orderBy: { name: "asc" } }),
    db.warehouse.findMany({ orderBy: { name: "asc" } }),
  ]);

  return (
    <div>
      <PageHeader title="Nouvel achat" description="Enregistrer une réception d'huile en entrepôt" />
      <Card className="max-w-4xl p-5">
        <PurchaseForm products={products} suppliers={suppliers} warehouses={warehouses} />
      </Card>
    </div>
  );
}
