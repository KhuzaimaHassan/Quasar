import { User } from "lucide-react";
import { PageHeader, EmptyState } from "@/components/layout/PageHeader";

export default function ProfilePage() {
  return (
    <div className="flex flex-col h-full w-full p-6 lg:p-10 max-w-6xl mx-auto gap-8">
      <PageHeader 
        title="Profile" 
        description="Manage your personal profile and account security."
        icon={User}
      />
      <EmptyState 
        icon={User}
        title="Coming Soon"
        description="Profile management will be available when authentication is integrated."
      />
    </div>
  );
}
