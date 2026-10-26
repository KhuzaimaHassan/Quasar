import { User } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { UserProfile } from "@clerk/nextjs";

export default function ProfilePage() {
  return (
    <div className="flex min-w-0 flex-col h-full w-full p-4 sm:p-6 lg:p-10 max-w-6xl mx-auto gap-6 sm:gap-8">
      <PageHeader 
        title="Profile" 
        description="Manage your personal profile and account security."
        icon={User}
      />
      <UserProfile routing="hash" appearance={{ elements: {
        rootBox: { width: '100%', maxWidth: '100%', minWidth: 0 },
        cardBox: { width: '100%', maxWidth: '100%', minWidth: 0 },
        card: { width: '100%', maxWidth: '100%', minWidth: 0 },
      } }} />
    </div>
  );
}
