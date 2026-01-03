import * as React from 'react';

/** Breakpoint width in pixels for mobile device detection */
const MOBILE_BREAKPOINT = 768;

/** Detects if viewport is mobile-sized using matchMedia API with automatic updates */
export function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = React.useState<boolean | undefined>(
    undefined,
  );

  React.useEffect(() => {
    const mql = window.matchMedia(
      `(max-width: ${String(MOBILE_BREAKPOINT - 1)}px)`,
    );
    const onChange = () => {
      setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    };
    mql.addEventListener('change', onChange);
    setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    return () => {
      mql.removeEventListener('change', onChange);
    };
  }, []);

  return !!isMobile;
}
