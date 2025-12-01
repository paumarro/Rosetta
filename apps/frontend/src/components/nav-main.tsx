'use client';

import { ChevronRight } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { Link } from 'react-router-dom';
import { routes } from '@/services/routes';

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from '@/components/ui/sidebar';

export function NavMain() {
  const location = useLocation();
  //Get Learning Hub Routes
  const hubRoutes = routes.find((r) => r.id === 'hub')?.children || [];
  //Helper function to check if a route is active
  const isRouteActive = (path: string) => {
    return (
      location.pathname === path || location.pathname.startsWith(`${path}/`)
    );
  };

  return (
    <SidebarGroup>
      <SidebarGroupLabel>Learning Hub</SidebarGroupLabel>
      <SidebarMenu>
        {hubRoutes.map((route) => (
          <Collapsible key={route.title} asChild>
            <SidebarMenuItem>
              <SidebarMenuButton
                asChild
                tooltip={route.title}
                isActive={isRouteActive(route.path)}
              >
                <Link to={route.path}>
                  {route.icon && <route.icon />}
                  <span>{route.title}</span>
                </Link>
              </SidebarMenuButton>
              {route.children?.length ? (
                <>
                  <CollapsibleTrigger asChild>
                    <SidebarMenuAction className="data-[state=open]:rotate-90">
                      <ChevronRight />
                      <span className="sr-only">Toggle</span>
                    </SidebarMenuAction>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <SidebarMenuSub>
                      {route.children.map((subRoute) => (
                        <SidebarMenuSubItem key={subRoute.title}>
                          <SidebarMenuSubButton asChild>
                            <Link to={subRoute.path}>
                              <span>{subRoute.title}</span>
                            </Link>
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                      ))}
                    </SidebarMenuSub>
                  </CollapsibleContent>
                </>
              ) : null}
            </SidebarMenuItem>
          </Collapsible>
        ))}
      </SidebarMenu>
    </SidebarGroup>
  );
}
