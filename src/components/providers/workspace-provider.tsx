"use client"

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { useWorkspaces } from '@/lib/queries/workspaces'
import { Workspace } from '@/types'

interface WorkspaceContextType {
  activeWorkspace: Workspace | null
  setActiveWorkspace: (ws: Workspace) => void
}

const WorkspaceContext = createContext<WorkspaceContextType | undefined>(undefined)

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const { data: workspaces } = useWorkspaces()
  const [activeWorkspace, setActiveWorkspace] = useState<Workspace | null>(null)

  useEffect(() => {
    if (!workspaces?.length) return

    // If we don't have an active workspace yet
    if (!activeWorkspace) {
      // 1. Try to restore from localStorage
      const savedId = localStorage.getItem('quasar-workspace-id')
      if (savedId) {
        const found = workspaces.find((w: Workspace) => w.id === savedId)
        if (found) {
          setActiveWorkspace(found)
          return
        }
      }
      
      // 2. Fallback to the first workspace
      setActiveWorkspace(workspaces[0])
    } else {
      // If we have an active workspace, but it's not in the loaded workspaces (e.g., user changed)
      const exists = workspaces.some((w: Workspace) => w.id === activeWorkspace.id)
      if (!exists) {
        setActiveWorkspace(workspaces[0])
      }
    }
  }, [workspaces, activeWorkspace])

  // Save to localStorage whenever it changes
  useEffect(() => {
    if (activeWorkspace) {
      localStorage.setItem('quasar-workspace-id', activeWorkspace.id)
    } else {
      localStorage.removeItem('quasar-workspace-id')
    }
  }, [activeWorkspace])

  // Also clear localStorage on logout by listening to a custom event or just let it naturally fallback if the ID isn't found in the new user's workspaces

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
