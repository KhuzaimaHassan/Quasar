import { MessageSquare, FileText, Brain, LucideIcon } from "lucide-react";

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
    label: "",
    items: [
      { label: "Chat", href: "/chat", icon: MessageSquare },
      { label: "Documents", href: "/documents", icon: FileText },
      { label: "Memory", href: "/memory", icon: Brain },
    ],
  },
];
