import { User } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { UserProfile } from "@clerk/nextjs";

export default function ProfilePage() {
  return (
    <div className="flex flex-col h-full w-full p-6 lg:p-10 max-w-6xl mx-auto gap-8">
      <PageHeader 
        title="Profile" 
        description="Manage your personal profile and account security."
        icon={User}
      />
      <UserProfile routing="hash" />
    </div>
  );
}
