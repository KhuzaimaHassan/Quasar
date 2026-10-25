import { db } from './db';
import { estimateCost } from './pricing';
import { getModelLabel } from './models';

export interface ModelUsage {
  modelId: string;
  label: string;
  totalTokens: number;
  estimatedCost: number | null;
}

export interface DailyTrend {
  date: string;
  totalTokens: number;
  estimatedCost: number | null;
}

export interface UsageAggregation {
  byModel: ModelUsage[];
  trend: DailyTrend[];
  asOfDate: string;
}

export async function getUsageStats(userId: string): Promise<UsageAggregation> {
  // Fetch all assistant messages in conversations belonging to the user
  const messages = await db.message.findMany({
    where: {
      role: 'assistant',
      conversation: {
        userId: userId,
      },
    },
    select: {
      tokenCount: true,
      metadata: true,
      createdAt: true,
      conversation: {
        select: {
          model: true,
        },
      },
    },
    orderBy: {
      createdAt: 'asc',
    },
  });

  const modelStats: Record<string, { tokens: number }> = {};
  const trendStats: Record<string, { tokens: number; cost: number; incomplete: boolean }> = {};

  messages.forEach((msg) => {
    const metadata = msg.metadata && typeof msg.metadata === 'object' && !Array.isArray(msg.metadata) ? msg.metadata : {};
    const modelId = typeof metadata.modelId === 'string' ? metadata.modelId : msg.conversation.model;
    const tokens = msg.tokenCount;
    const dateStr = msg.createdAt.toISOString().split('T')[0]; // YYYY-MM-DD

    if (!modelStats[modelId]) {
      modelStats[modelId] = { tokens: 0 };
    }
    modelStats[modelId].tokens += tokens;

    // We use total tokenCount as outputTokens for estimation since DB doesn't split them
    const cost = estimateCost(modelId, 0, tokens);

    if (!trendStats[dateStr]) {
      trendStats[dateStr] = { tokens: 0, cost: 0, incomplete: false };
    }
    trendStats[dateStr].tokens += tokens;
    trendStats[dateStr].cost += cost ?? 0;
    trendStats[dateStr].incomplete ||= cost === null;
  });

  const byModel: ModelUsage[] = Object.keys(modelStats).map((modelId) => {
    const label = getModelLabel(modelId);
    const tokens = modelStats[modelId].tokens;
    // We treat stored tokenCount as output tokens for cost estimation
    const cost = estimateCost(modelId, 0, tokens);

    return {
      modelId,
      label,
      totalTokens: tokens,
      estimatedCost: cost,
    };
  });

  const trend: DailyTrend[] = Object.keys(trendStats)
    .sort()
    .map((date) => ({
      date,
      totalTokens: trendStats[date].tokens,
      estimatedCost: trendStats[date].incomplete ? null : trendStats[date].cost,
    }));

  return {
    byModel,
    trend,
    asOfDate: new Date().toISOString(),
  };
}
