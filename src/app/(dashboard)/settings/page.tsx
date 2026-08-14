import { Settings as SettingsIcon } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { ApiKeysSection } from "@/components/settings/ApiKeysSection";
import { UsageSection } from "@/components/settings/UsageSection";

export default function SettingsPage() {
  return (
    <div className="flex flex-col h-full w-full p-4 sm:p-6 lg:p-10 max-w-6xl mx-auto gap-6 sm:gap-8">
      <PageHeader 
        title="Settings" 
        description="Manage your account, billing, and API integrations."
        icon={SettingsIcon}
      />
      
      <div className="max-w-2xl w-full flex flex-col gap-8">
        <ApiKeysSection />
        <UsageSection />
      </div>
    </div>
  );
}
