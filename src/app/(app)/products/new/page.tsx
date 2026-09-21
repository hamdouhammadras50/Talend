import { PageHeader, Card } from "@/components/StatCard";
import { ProductForm } from "../ProductForm";

export default function NewProductPage() {
  return (
    <div>
      <PageHeader title="Nouveau produit" description="Ajouter un type d'huile au catalogue" />
      <Card className="max-w-2xl p-5">
        <ProductForm />
      </Card>
    </div>
  );
}
