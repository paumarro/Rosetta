import { ReactNode, useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { NavigationContext } from '@/contexts/NavigationContext';
import {
  findRouteByPath,
  getBreadcrumbsForPath,
  RouteItem,
} from '@/services/routes';

//NavigationState Type
export interface NavigationState {
  currentRoute: RouteItem | null;
  breadcrumbs: RouteItem[];
}

/**
 * Provider component that manages navigation state based on current route.
 * Automatically updates current route and breadcrumbs when location changes.
 * @param props - Component props
 * @param props.children - Child components to render within navigation context
 * @returns Provider component with navigation context
 */
export function NavigationProvider({ children }: { children: ReactNode }): React.ReactElement {
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
