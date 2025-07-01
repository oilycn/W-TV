import { Tv2 } from 'lucide-react';

export default function AppLogo() {
  return (
    <div className="flex items-center gap-2">
      <Tv2 className="h-6 w-6 text-primary" />
      <span className="hidden sm:inline text-lg font-semibold text-foreground">晚风TV</span>
    </div>
  );
}
