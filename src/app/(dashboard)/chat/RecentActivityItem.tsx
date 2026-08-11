interface RecentActivityItemProps {
  title: string;
  time: string;
  onClick?: () => void;
}

export function RecentActivityItem({ title, time, onClick }: RecentActivityItemProps) {
  return (
    <div 
      onClick={onClick}
      className="flex items-center gap-3 text-muted-foreground p-1 rounded hover:bg-muted/50 transition-colors cursor-pointer"
      role="listitem"
    >
      <div className="h-1.5 w-1.5 rounded-full bg-muted-foreground/40 shrink-0" />
      <span className="flex-1 truncate font-medium text-foreground/80">{title}</span>
      <span className="text-xs opacity-60 shrink-0 tabular-nums">{time}</span>
    </div>
  );
}
