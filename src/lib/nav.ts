import { MessageSquare, FileText, Brain, Settings, FolderGit2, Bot, LucideIcon } from "lucide-react";

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

export const navGroups: NavGroup[] = [
  {
    label: "Workspace",
    items: [
      { label: "Projects", href: "/projects", icon: FolderGit2 },
      { label: "Documents", href: "/documents", icon: FileText },
    ],
  },
  {
    label: "AI",
    items: [
      { label: "Chat", href: "/chat", icon: MessageSquare },
      { label: "Agents", href: "/agents", icon: Bot },
      { label: "Memory", href: "/memory", icon: Brain },
    ],
  },
  {
    label: "Settings",
    items: [
      { label: "Settings", href: "/settings", icon: Settings },
    ],
  },
];
