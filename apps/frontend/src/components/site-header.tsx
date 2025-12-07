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

export function SiteHeader() {
  // const { toggleSidebar } = useSidebar();
  // const { navigation } = useNavigation();

  const handleLogoClick = (e: React.MouseEvent<HTMLImageElement>) => {
    e.preventDefault();
    window.location.href = '/';
  };

  return (
    <header className="bg-background py-5 sticky top-0 z-50 flex w-full items-center">
      <div className="flex h-(--header-height) w-full items-center gap-4 px-10">
        {/* <Button
          className="h-8 w-8"
          variant="ghost"
          size="icon"
          onClick={toggleSidebar}
        >
          <SidebarIcon />
        </Button> */}
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
        {/* <Separator orientation="vertical" className="mr-2 h-4" /> */}
        {/* <Breadcrumb className="hidden sm:block">
          <BreadcrumbList>
            {navigation.breadcrumbs.map((item, index) => (
              <Fragment key={item.id}>
                {index > 0 && <BreadcrumbSeparator />}
                <BreadcrumbItem>
                  {index === navigation.breadcrumbs.length - 1 ? (
                    <BreadcrumbPage>{item.title}</BreadcrumbPage>
                  ) : (
                    <>
                      <BreadcrumbLink asChild>
                        <Link to={item.path}>{item.title}</Link>
                      </BreadcrumbLink>
                    </>
                  )}
                </BreadcrumbItem>
              </Fragment>
            ))}
          </BreadcrumbList>
        </Breadcrumb> */}
        <div className="ml-auto">
          <User />
        </div>
      </div>
    </header>
  );
}
