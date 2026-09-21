import { PageHeader, Card } from "@/components/StatCard";
import { WarehouseForm } from "../WarehouseForm";

export default function NewWarehousePage() {
  return (
    <div>
      <PageHeader title="Nouvel entrepôt" description="Ajouter un point de stockage" />
      <Card className="max-w-xl p-5">
        <WarehouseForm />
      </Card>
    </div>
  );
}
