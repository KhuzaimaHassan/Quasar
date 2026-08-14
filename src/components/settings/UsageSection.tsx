"use client";

import { useQuery } from "@tanstack/react-query";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Activity, Loader2, AlertCircle } from "lucide-react";
import type { UsageAggregation } from "@/lib/cost-aggregation";

export function UsageSection() {
  const { data, isLoading, error } = useQuery<UsageAggregation>({
    queryKey: ["usage-stats"],
    queryFn: async () => {
      const res = await fetch("/api/usage");
      if (!res.ok) throw new Error("Failed to load usage stats");
      return res.json();
    },
  });

  return (
    <Card className="border-primary/10 shadow-sm">
      <CardHeader>
        <CardTitle className="text-xl flex items-center gap-2">
          <Activity className="w-5 h-5 text-primary" />
          Usage & Estimated Cost
        </CardTitle>
        <CardDescription>
          View your token usage and estimated costs based on published list pricing.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {isLoading && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" />
            Loading usage stats...
          </div>
        )}

        {error && (
          <div className="flex items-center gap-2 text-sm text-destructive">
            <AlertCircle className="w-4 h-4" />
            Failed to load usage statistics.
          </div>
        )}

        {data && data.byModel.length === 0 && (
          <div className="text-sm text-muted-foreground border rounded-lg p-6 text-center border-dashed">
            No usage data found yet. Start chatting to see your usage here!
          </div>
        )}

        {data && data.byModel.length > 0 && (
          <>
            <div className="space-y-4">
              <h3 className="font-medium text-sm text-muted-foreground">Breakdown by Model</h3>
              <div className="border rounded-lg overflow-x-auto">
                <table className="w-full text-xs sm:text-sm text-left">
                  <thead className="bg-muted/50 border-b">
                    <tr>
                      <th className="px-3 sm:px-4 py-2.5 sm:py-3 font-medium whitespace-nowrap">Model</th>
                      <th className="px-3 sm:px-4 py-2.5 sm:py-3 font-medium text-right whitespace-nowrap">Total Tokens</th>
                      <th className="px-3 sm:px-4 py-2.5 sm:py-3 font-medium text-right whitespace-nowrap">Est. Cost</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {data.byModel.map((model) => (
                      <tr key={model.modelId} className="hover:bg-muted/30">
                        <td className="px-3 sm:px-4 py-2.5 sm:py-3 font-medium whitespace-nowrap">{model.label}</td>
                        <td className="px-3 sm:px-4 py-2.5 sm:py-3 text-right whitespace-nowrap">{model.totalTokens.toLocaleString()}</td>
                        <td className="px-3 sm:px-4 py-2.5 sm:py-3 text-right font-medium whitespace-nowrap">
                          {model.modelId === 'gemini-3.5-flash' ? (
                            <span className="text-green-600 dark:text-green-500">$0.00 (free tier)</span>
                          ) : (
                            `$${model.estimatedCost.toFixed(4)}`
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              
              <div className="bg-blue-50/50 dark:bg-blue-950/20 p-3 rounded-md border border-blue-100 dark:border-blue-900 text-xs text-blue-800 dark:text-blue-300 flex gap-2 items-start mt-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <p>
                  <strong>Note on Estimates:</strong> Costs are estimated using published list pricing and treat all stored tokens as output tokens. Your actual bill from Anthropic/OpenAI/Google may differ depending on input/output splits, caching, or volume discounts.
                </p>
              </div>
            </div>

            {data.trend.length > 0 && (
              <div className="space-y-4 pt-4 border-t">
                <h3 className="font-medium text-sm text-muted-foreground">Daily Trend</h3>
                <div className="border rounded-lg overflow-x-auto">
                  <table className="w-full text-xs sm:text-sm text-left">
                    <thead className="bg-muted/50 border-b">
                      <tr>
                        <th className="px-3 sm:px-4 py-2 sm:py-3 font-medium whitespace-nowrap">Date</th>
                        <th className="px-3 sm:px-4 py-2 sm:py-3 font-medium text-right whitespace-nowrap">Tokens</th>
                        <th className="px-3 sm:px-4 py-2 sm:py-3 font-medium text-right whitespace-nowrap">Cost</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {data.trend.map((day) => (
                        <tr key={day.date} className="hover:bg-muted/30">
                          <td className="px-3 sm:px-4 py-2 font-medium whitespace-nowrap">{day.date}</td>
                          <td className="px-3 sm:px-4 py-2 text-right whitespace-nowrap">{day.totalTokens.toLocaleString()}</td>
                          <td className="px-3 sm:px-4 py-2 text-right whitespace-nowrap">${day.estimatedCost.toFixed(4)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
