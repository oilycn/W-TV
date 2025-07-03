"use client";

import { History as HistoryIcon } from 'lucide-react';

export default function HistoryPage() {
  return (
    <div className="flex flex-col items-center justify-center h-[calc(100vh-10rem)] text-center p-4">
      <HistoryIcon className="w-24 h-24 mb-6 text-muted-foreground" />
      <h2 className="text-2xl font-semibold mb-2 text-foreground">观看历史</h2>
      <p className="mb-6 text-muted-foreground max-w-md">
        此功能正在开发中，敬请期待！
      </p>
    </div>
  );
}
