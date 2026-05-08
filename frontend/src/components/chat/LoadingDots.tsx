import React from 'react';

export const LoadingDots = () => (
  <div className="flex items-center gap-1">
    <span className="h-2 w-2 rounded-full bg-muted-foreground loading-dot" />
    <span className="h-2 w-2 rounded-full bg-muted-foreground loading-dot" />
    <span className="h-2 w-2 rounded-full bg-muted-foreground loading-dot" />
  </div>
);
