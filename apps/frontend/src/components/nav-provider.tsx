import { ReactNode, useState } from 'react';

import {
  NavigationContext,
  NavigationState,
  getDefaultSection,
} from '@/contexts/NavigationContext';

// Provider component
export function NavigationProvider({ children }: { children: ReactNode }) {
  const [navigation, setNavigation] = useState<NavigationState>({
    section: getDefaultSection(),
    subSection: null,
  });

  return (
    <NavigationContext.Provider value={{ navigation, setNavigation }}>
      {children}
    </NavigationContext.Provider>
  );
}
