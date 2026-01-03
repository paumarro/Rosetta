import { useContext, createContext } from 'react';
import { NavigationState } from '@/layouts/NavProvider';

export type NavigationContextType = {
  navigation: NavigationState;
  setNavigation: (nav: NavigationState) => void;
};

// Create a context with default values
export const NavigationContext = createContext<NavigationContextType>({
  navigation: {
    currentRoute: null,
    breadcrumbs: [],
  },
  setNavigation: () => {},
});

/** Accesses navigation context with current route and breadcrumbs */
export function useNavigation(): NavigationContextType {
  return useContext(NavigationContext);
}
