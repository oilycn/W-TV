import { Tv2 } from 'lucide-react';

export default function AppLogo() {
  return (
    <div className="flex shrink-0 items-center gap-2.5">
      <span className="flex h-9 w-9 items-center justify-center rounded-lg border border-border/70 bg-background shadow-sm">
        <Tv2 className="h-5 w-5 text-foreground" />
      </span>
      <span className="hidden whitespace-nowrap text-lg font-bold text-foreground sm:inline">晚风TV</span>
    </div>
  );
}
