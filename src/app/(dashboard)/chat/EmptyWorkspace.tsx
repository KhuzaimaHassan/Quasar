"use client";

import { useRouter } from "next/navigation";
import { Sparkles, Clock, MessageSquare, FileText, Loader2 } from "lucide-react";
import { QuickActionCard } from "./QuickActionCard";
import { RecentActivityItem } from "./RecentActivityItem";
import { useWorkspace } from "@/components/providers/workspace-provider";
import { useConversations, useCreateConversation } from "@/lib/queries/conversations";
import { formatRelativeTime } from "@/lib/utils";

export function EmptyWorkspace() {
  const router = useRouter();
  const { activeWorkspace } = useWorkspace();
  const { data: conversations = [], isLoading } = useConversations(activeWorkspace?.id);
  const { mutate: createConversation, isPending: isCreating } = useCreateConversation();

  const recentConversations = conversations.slice(0, 3);

  const handleStartNewChat = () => {
    createConversation(
      { workspaceId: activeWorkspace?.id, model: "gemini-3.5-flash" },
      {
        onSuccess: (data) => {
          router.push(`/chat/${data.id}`);
        },
      }
    );
  };

  const handleUploadDocuments = () => {
    router.push("/documents");
  };

  return (
    <main 
      className="flex-1 overflow-y-auto w-full bg-background/50"
      aria-label="Welcome Workspace"
    >
      <div className="max-w-5xl mx-auto p-6 md:p-8 lg:p-12 pb-24 h-full flex flex-col justify-center animate-in fade-in slide-in-from-bottom-4 duration-500">
        
        {/* Welcome Section */}
        <header className="flex flex-col items-center text-center space-y-4 mb-16">
          <div className="h-14 w-14 bg-primary/10 rounded-2xl flex items-center justify-center mb-2 shadow-sm border border-primary/10">
            <Sparkles className="h-7 w-7 text-primary" aria-hidden="true" />
          </div>
          <h1 className="text-3xl font-semibold tracking-tight text-foreground">Welcome to Quasar</h1>
          <p className="text-base text-muted-foreground max-w-2xl leading-relaxed">
            Your intelligent developer workspace. Interact with multiple AI models, upload context, and build software faster.
          </p>
        </header>

        {/* Quick Actions Grid */}
        <section aria-label="Quick Actions" className="grid grid-cols-1 sm:grid-cols-2 gap-5 mb-16 max-w-2xl mx-auto w-full">
          <QuickActionCard 
            title="Start New Chat"
            description="Start a new conversation with an AI model."
            icon={isCreating ? Loader2 : MessageSquare}
            onClick={isCreating ? undefined : handleStartNewChat}
          />
          <QuickActionCard 
            title="Upload Documents"
            description="Add context documents to your workspace."
            icon={FileText}
            onClick={handleUploadDocuments}
          />
        </section>

        {/* Recent Activity */}
        <div className="max-w-2xl mx-auto w-full">
          <section aria-labelledby="activity-heading" className="space-y-5">
            <div className="flex items-center gap-2.5 px-1 border-b pb-2">
              <Clock className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
              <h2 id="activity-heading" className="text-sm font-semibold tracking-wide text-muted-foreground">Recent Activity</h2>
            </div>
            <div className="flex flex-col gap-1 p-3 rounded-xl border bg-card/50 shadow-sm" role="list">
              {isLoading ? (
                <div className="text-sm text-muted-foreground p-2">Loading recent activity...</div>
              ) : recentConversations.length > 0 ? (
                recentConversations.map((activity) => (
                  <RecentActivityItem 
                    key={activity.id}
                    title={activity.title}
                    time={formatRelativeTime(activity.updatedAt)}
                    onClick={() => router.push(`/chat/${activity.id}`)}
                  />
                ))
              ) : (
                <div className="text-sm text-muted-foreground p-2">No recent activity found.</div>
              )}
            </div>
          </section>
        </div>

      </div>
    </main>
  );
}
