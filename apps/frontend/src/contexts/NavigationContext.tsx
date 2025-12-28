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
  setNavigation: () => { },
});

// Custom hook to use the NavigationContext
export function useNavigation() {
  return useContext(NavigationContext);
}
