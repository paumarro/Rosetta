import { data } from '@/lib/navigation';
import { useContext, createContext } from 'react';

export type NavigationState = {
  section: string;
  subSection?: string | null;
};

export type NavigationContextType = {
  navigation: NavigationState;
  setNavigation: (nav: NavigationState) => void;
};

export function getDefaultSection(): string {
  // First try to find an item marked as active
  const activeItem = data.navMain.find((item) => item.isActive);
  if (activeItem) return activeItem.title;
  // If no active item is specified, use the first item in the navigation
  if (data.navMain.length > 0) return data.navMain[0].title;
  // Fallback if somehow there are no items
  return 'Home';
}

// Create a context with default values
export const NavigationContext = createContext<NavigationContextType>({
  navigation: {
    section: getDefaultSection(),
  },
  setNavigation: () => { },
});

// Custom hook to use the NavigationContext
export function useNavigation() {
  return useContext(NavigationContext);
}
