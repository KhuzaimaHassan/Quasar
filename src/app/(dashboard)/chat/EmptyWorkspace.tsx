import { Sparkles, Clock } from "lucide-react";
import { QuickActionCard } from "./QuickActionCard";
import { SuggestedPrompt } from "./SuggestedPrompt";
import { RecentActivityItem } from "./RecentActivityItem";
import { MOCK_QUICK_ACTIONS, MOCK_SUGGESTED_PROMPTS, MOCK_RECENT_ACTIVITY } from "@/lib/mock-data";

export function EmptyWorkspace() {
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
        <section aria-label="Quick Actions" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-16">
          {MOCK_QUICK_ACTIONS.map((action, idx) => (
            <QuickActionCard 
              key={idx}
              title={action.title}
              description={action.description}
              icon={action.icon}
            />
          ))}
        </section>

        {/* Suggested Prompts & Activity */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-10 lg:gap-16">
          <section aria-labelledby="suggested-heading" className="space-y-5">
            <div className="flex items-center gap-2.5 px-1 border-b pb-2">
              <Sparkles className="h-4 w-4 text-primary" aria-hidden="true" />
              <h2 id="suggested-heading" className="text-sm font-semibold tracking-wide">Suggested for you</h2>
            </div>
            <div className="flex flex-col gap-2.5">
              {MOCK_SUGGESTED_PROMPTS.map((prompt, idx) => (
                <SuggestedPrompt key={idx} prompt={prompt} />
              ))}
            </div>
          </section>

          <section aria-labelledby="activity-heading" className="space-y-5">
            <div className="flex items-center gap-2.5 px-1 border-b pb-2">
              <Clock className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
              <h2 id="activity-heading" className="text-sm font-semibold tracking-wide text-muted-foreground">Recent Activity</h2>
            </div>
            <div className="flex flex-col gap-1 p-3 rounded-xl border bg-card/50 shadow-sm" role="list">
              {MOCK_RECENT_ACTIVITY.map((activity) => (
                <RecentActivityItem 
                  key={activity.id}
                  title={activity.title}
                  time={activity.time}
                />
              ))}
            </div>
          </section>
        </div>

      </div>
    </main>
  );
}
