import * as React from 'react';
import { useLocation } from 'react-router-dom';
import { routes } from '@/lib/routes';
import { Link } from 'react-router-dom';

import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar';

export function NavSecondary({
  ...props
}: React.ComponentPropsWithoutRef<typeof SidebarGroup>) {
  const location = useLocation();
  const secondaryRoutes = routes.filter(
    (r) => r.id === 'support' || r.id === 'feedback',
  );

  const isRouteActive = (path: string) => {
    return (
      location.pathname === path || location.pathname.startsWith(`${path}/`)
    );
  };

  return (
    <SidebarGroup {...props}>
      <SidebarGroupContent>
        <SidebarMenu>
          {secondaryRoutes.map((route) => (
            <SidebarMenuItem key={route.title}>
              <SidebarMenuButton
                asChild
                size="sm"
                isActive={isRouteActive(route.path)}
              >
                <Link to={route.path}>
                  {route.icon && <route.icon />}
                  <span>{route.title}</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}
