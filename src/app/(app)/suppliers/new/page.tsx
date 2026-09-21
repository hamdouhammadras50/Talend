import { PageHeader, Card } from "@/components/StatCard";
import { SupplierForm } from "../SupplierForm";

export default function NewSupplierPage() {
  return (
    <div>
      <PageHeader title="Nouveau fournisseur" />
      <Card className="max-w-xl p-5">
        <SupplierForm />
      </Card>
    </div>
  );
}
