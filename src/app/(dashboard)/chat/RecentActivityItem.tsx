interface RecentActivityItemProps {
  title: string;
  time: string;
  onClick?: () => void;
}

export function RecentActivityItem({ title, time, onClick }: RecentActivityItemProps) {
  return (
    <div 
      onClick={onClick}
      className="flex items-center gap-3 text-muted-foreground p-1.5 rounded hover:bg-muted/50 transition-colors cursor-pointer min-w-0"
      role="listitem"
    >
      <div className="h-1.5 w-1.5 rounded-full bg-muted-foreground/40 shrink-0" />
      <span className="flex-1 min-w-0 truncate font-medium text-foreground/80 text-xs sm:text-sm">{title}</span>
      <span className="text-xs opacity-60 shrink-0 tabular-nums ml-1">{time}</span>
    </div>
  );
}
