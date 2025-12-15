// import { SidebarIcon } from 'lucide-react';
// import { useNavigation } from '@/contexts/NavigationContext';
// import { Fragment } from 'react';
// import {
//   Breadcrumb,
//   BreadcrumbItem,
//   BreadcrumbLink,
//   BreadcrumbList,
//   BreadcrumbPage,
//   BreadcrumbSeparator,
// } from '@/components/ui/breadcrumb';
// import { Button } from '@/components/ui/button';
// import { Separator } from '@/components/ui/separator';
// import { useSidebar } from '@/components/ui/sidebar';
// import { Link } from 'react-router-dom';
import RosettaLogo from '@/assets/rosetta-logo.png';
import CarbyteLogo from '@/assets/carbyte-logo.png';
import { User } from './user';
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from './ui/breadcrumb';
import { Fragment } from 'react/jsx-runtime';
import { Link } from 'react-router-dom';

export function SiteHeader() {


  const handleLogoClick = (e: React.MouseEvent<HTMLImageElement>) => {
    e.preventDefault();
    window.location.href = '/';
  };

  return (
    <header className="bg-background py-5 sticky top-0 z-50 flex w-full items-center">
      <div className="flex h-(--header-height) w-full items-center gap-4 px-10">
        <img
          src={RosettaLogo}
          alt="Rosetta logo"
          className="h-7 w-auto"
          onClick={handleLogoClick}
        />
        <div className="mx-2 h-7 w-px bg-border" />
        <img
          src={CarbyteLogo}
          alt="Rosetta logo"
          className="h-7 w-auto"
          onClick={handleLogoClick}
        />
        <div className="ml-auto">
          <User />
        </div>
      </div>
    </header>
  );
}
