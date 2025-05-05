import { SidebarIcon } from 'lucide-react';
import { useNavigation } from '@/contexts/NavigationContext';

import { SearchForm } from '@/components/search-form';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { useSidebar } from '@/components/ui/sidebar';

export function SiteHeader() {
  const { toggleSidebar } = useSidebar();
  const { navigation } = useNavigation();

  return (
    <header className="bg-background sticky top-0 z-50 flex w-full items-center border-b">
      <div className="flex h-(--header-height) w-full items-center gap-2 px-4">
        <Button
          className="h-8 w-8"
          variant="ghost"
          size="icon"
          onClick={toggleSidebar}
        >
          <SidebarIcon />
        </Button>
        <Separator orientation="vertical" className="mr-2 h-4" />
        <Breadcrumb className="hidden sm:block">
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink href="/home">Home</BreadcrumbLink>
            </BreadcrumbItem>
            {navigation.section && (
              <>
                <BreadcrumbSeparator />
                {/* Fix: Should redirect to URL of the section, not to section name */}
                <BreadcrumbLink href={`/${navigation.section}`}>
                  <BreadcrumbItem>
                    <BreadcrumbPage>{navigation.section}</BreadcrumbPage>
                  </BreadcrumbItem>
                </BreadcrumbLink>
              </>
            )}
            {navigation.subSection && (
              <>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  <BreadcrumbPage>{navigation.subSection}</BreadcrumbPage>
                </BreadcrumbItem>
              </>
            )}
          </BreadcrumbList>
        </Breadcrumb>
        <SearchForm className="w-full sm:ml-auto sm:w-auto" />
      </div>
    </header>
  );
}
