import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

export type ApiKeyInfo = {
  provider: string;
  keyPreview: string;
  updatedAt: string;
};

export function useApiKeys() {
  return useQuery<ApiKeyInfo[]>({
    queryKey: ['api-keys'],
    queryFn: async () => {
      const res = await fetch('/api/api-keys');
      if (!res.ok) throw new Error('Failed to fetch API keys');
      return res.json();
    },
  });
}

export function useAddApiKey() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ provider, apiKey }: { provider: string; apiKey: string }) => {
      const res = await fetch('/api/api-keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider, apiKey }),
      });
      if (!res.ok) throw new Error('Failed to save API key');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['api-keys'] });
    },
  });
}

export function useRemoveApiKey() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (provider: string) => {
      const res = await fetch(`/api/api-keys/${provider}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Failed to remove API key');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['api-keys'] });
    },
  });
}
