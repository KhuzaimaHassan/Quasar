"use client"

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useState, useEffect, useRef } from 'react'
import { useAuth } from '@clerk/nextjs'

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient())
  const { userId } = useAuth()
  const prevUserIdRef = useRef(userId)

  useEffect(() => {
    // Only clear the cache if we were previously logged in and the user changed.
    // If prevUserIdRef.current is undefined, it means this is the first load, 
    // so we should not wipe the active queries that are currently fetching!
    if (prevUserIdRef.current !== undefined && prevUserIdRef.current !== userId) {
      queryClient.clear()
    }
    prevUserIdRef.current = userId
  }, [userId, queryClient])

  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  )
}
