import { ReactNode, useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { NavigationContext } from '@/contexts/NavigationContext';
import {
  findRouteByPath,
  getBreadcrumbsForPath,
  RouteItem,
} from '@/lib/routes';

//NavigationState Type
export interface NavigationState {
  currentRoute: RouteItem | null;
  breadcrumbs: RouteItem[];
}

// Provider component
export function NavigationProvider({ children }: { children: ReactNode }) {
  const location = useLocation();
  const [navigationState, setNavigationState] = useState<NavigationState>({
    currentRoute: null,
    breadcrumbs: [],
  });
  useEffect(() => {
    const currentRoute = findRouteByPath(location.pathname);
    const breadcrumbs = getBreadcrumbsForPath(location.pathname);
    setNavigationState({
      currentRoute,
      breadcrumbs,
    });
  }, [location.pathname]);

  return (
    <NavigationContext.Provider
      value={{ navigation: navigationState, setNavigation: setNavigationState }}
    >
      {children}
    </NavigationContext.Provider>
  );
}
