import { MessageSquare, UploadCloud, FolderGit2, FolderPlus } from "lucide-react";

export const MOCK_CONVERSATIONS = [
  { 
    id: "1", 
    title: "React Component Refactoring", 
    preview: "Extracting the conversation list into a reusable UI component to improve readability.",
    time: "2m ago", 
    model: "Claude 3.5", 
    files: 2, 
    isActive: true 
  },
  { 
    id: "2", 
    title: "Database Schema Design", 
    preview: "Designing a robust schema for user workspaces and role-based access control.",
    time: "2h ago", 
    model: "GPT-4", 
    files: 0, 
    isActive: false 
  },
  { 
    id: "3", 
    title: "API Authentication Flow", 
    preview: "Implementing JWT-based authentication with secure HTTP-only cookies.",
    time: "1d ago", 
    model: "Gemini 1.5 Pro", 
    files: 1, 
    isActive: false 
  },
  { 
    id: "4", 
    title: "Next.js App Router Setup", 
    preview: "Configuring layout components and nested routing for the main dashboard.",
    time: "3d ago", 
    model: "GPT-4", 
    files: 0, 
    isActive: false 
  },
];

export const MOCK_QUICK_ACTIONS = [
  { title: "Start New Chat", description: "Talk to your AI assistant", icon: MessageSquare },
  { title: "Upload Documents", description: "PDFs, DOCX, TXT", icon: UploadCloud },
  { title: "Analyze Repository", description: "Connect to GitHub", icon: FolderGit2 },
  { title: "Create Project", description: "Start from a template", icon: FolderPlus },
];

export const MOCK_SUGGESTED_PROMPTS = [
  "Explain how React Server Components work under the hood.",
  "Help me write a Python script to automate my daily reports.",
  "What are the best practices for structuring a Next.js application?",
  "Review this code snippet for any potential security vulnerabilities.",
];

export const MOCK_RECENT_ACTIVITY = [
  { id: "a1", title: "React Component Refactoring", time: "2m ago", type: "chat" },
  { id: "a2", title: "Uploaded API Specs.pdf", time: "1h ago", type: "document" },
  { id: "a3", title: "Database Schema Design", time: "2h ago", type: "chat" },
];
