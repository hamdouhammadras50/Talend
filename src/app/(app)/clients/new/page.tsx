import { PageHeader, Card } from "@/components/StatCard";
import { ClientForm } from "../ClientForm";

export default function NewClientPage() {
  return (
    <div>
      <PageHeader title="Nouveau client" />
      <Card className="max-w-xl p-5">
        <ClientForm />
      </Card>
    </div>
  );
}
