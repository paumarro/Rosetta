import { SiteHeader } from '@/layouts/SiteHeader';
import { SidebarProvider } from '@/components/ui/Sidebar';
import { ReactNode } from 'react';

interface AppLayoutProps {
  children: ReactNode;
}

export default function AppLayout({ children }: AppLayoutProps) {
  return (
    <div className="[--header-height:calc(theme(spacing.14))]">
      <SidebarProvider className="flex flex-col">
        <SiteHeader />
        <div className="flex flex-1">
          <div className="flex flex-1 flex-col gap-4 p-4">{children}</div>
        </div>
      </SidebarProvider>
    </div>
  );
}
