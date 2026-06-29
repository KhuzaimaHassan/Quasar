import { Settings as SettingsIcon } from "lucide-react";
import { PageHeader, EmptyState } from "@/components/layout/PageHeader";

export default function SettingsPage() {
  return (
    <div className="flex flex-col h-full w-full p-6 lg:p-10 max-w-6xl mx-auto gap-8">
      <PageHeader 
        title="Settings" 
        description="Manage your account, billing, and API integrations."
        icon={SettingsIcon}
      />
      <EmptyState 
        icon={SettingsIcon}
        title="Coming Soon"
        description="User settings and workspace configuration will be available in Phase 2."
      />
    </div>
  );
}
