'use client';

import { useEffect } from 'react';
import { useAuthStore } from '@/stores/authStore';

export default function Providers({ children }: { children: React.ReactNode }) {
  const hydrate = useAuthStore((s) => s.hydrate);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  return <>{children}</>;
}
