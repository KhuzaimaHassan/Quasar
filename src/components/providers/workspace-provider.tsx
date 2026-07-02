"use client"

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { useWorkspaces } from '@/lib/queries/workspaces'

interface WorkspaceContextType {
  activeWorkspace: any | null
  setActiveWorkspace: (ws: any) => void
}

const WorkspaceContext = createContext<WorkspaceContextType | undefined>(undefined)

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const { data: workspaces } = useWorkspaces()
  const [activeWorkspace, setActiveWorkspace] = useState<any | null>(null)

  useEffect(() => {
    // Auto-select the first workspace if none is selected
    if (workspaces?.length && !activeWorkspace) {
      setActiveWorkspace(workspaces[0])
    }
  }, [workspaces, activeWorkspace])

  return (
    <WorkspaceContext.Provider value={{ activeWorkspace, setActiveWorkspace }}>
      {children}
    </WorkspaceContext.Provider>
  )
}

export function useWorkspace() {
  const context = useContext(WorkspaceContext)
  if (context === undefined) {
    throw new Error('useWorkspace must be used within a WorkspaceProvider')
  }
  return context
}
