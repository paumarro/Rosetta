import { Route, PenTool, LifeBuoy, Send } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export interface RouteItem {
  id: string;
  title: string;
  path: string;
  icon?: LucideIcon;
  parent?: string;
  component?: React.ComponentType;
  children?: RouteItem[];
}

//Main route configuration

export const routes: RouteItem[] = [
  {
    id: 'home',
    title: 'Home',
    path: '/',
    component: undefined,
  },
  {
    id: 'hub',
    title: 'Learning Hub',
    path: '/hub',
    children: [
      {
        id: 'learning-path',
        title: 'Learning Paths',
        path: '/hub/learning-path',
        icon: Route,
        parent: 'hub',
        component: undefined,
      },
    ],
  },
  {
    id: 'creator',
    title: 'Creator',
    path: '/creator',
    children: [
      {
        id: 'path-design',
        title: 'Path Designer',
        path: '/creator/path-design',
        icon: PenTool,
        parent: 'creator',
        component: undefined,
        children: [
          {
            id: 'create-new',
            title: 'Create New',
            path: '/creator/path-design/create-new',
            parent: 'path-design',
          },
        ],
      },
    ],
  },
  {
    id: 'support',
    title: 'Support',
    path: '/support',
    icon: LifeBuoy,
  },
  {
    id: 'feedback',
    title: 'Feedback',
    path: '/feedback',
    icon: Send,
  },
];

//Helper funcitons
export function findRouteByPath(path: string): RouteItem | null {
  //exact match
  const findRoute = (items: RouteItem[]): RouteItem | null => {
    for (const item of items) {
      if (item.path === path) return item;
      if (item.children) {
        const found = findRoute(item.children);
        if (found) return found;
      }
    }
    return null;
  };
  return findRoute(routes);
}

export function getBreadcrumbsForPath(path: string): RouteItem[] {
  const breadcrumbs: RouteItem[] = [];
  const route = findRouteByPath(path);
  if (!route) return breadcrumbs;

  //Add the current route
  breadcrumbs.unshift(route);

  //Add parent routes
  let currentRoute = route;
  while (currentRoute.parent) {
    const parentRoute =
      routes.find((r) => r.id === currentRoute.parent) ||
      routes
        .flatMap((r) => r.children || [])
        .find((r) => r.id === currentRoute.parent);
    if (parentRoute) {
      breadcrumbs.unshift(parentRoute);
      currentRoute = parentRoute;
    } else {
      break;
    }
  }
  // Always add home at the beginning if not already there
  if (breadcrumbs[0]?.id !== 'home') {
    const home = routes.find((r) => r.id === 'home');
    if (home) breadcrumbs.unshift(home);
  }

  return breadcrumbs;
}
