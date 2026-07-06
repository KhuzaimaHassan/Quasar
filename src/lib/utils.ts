import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatRelativeTime(dateString: string | Date) {
  const date = new Date(dateString);
  const now = new Date();
  const diffInMinutes = Math.abs(now.getTime() - date.getTime()) / 60000;
  
  if (diffInMinutes < 1) return 'Just now';
  if (diffInMinutes < 60) return `${Math.floor(diffInMinutes)}m ago`;
  
  const diffInHours = diffInMinutes / 60;
  if (diffInHours < 24) return `${Math.floor(diffInHours)}h ago`;
  if (diffInHours < 48) return 'Yesterday';
  return date.toLocaleDateString();
}
