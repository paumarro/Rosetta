import { useLocation } from 'react-router-dom';
import { useEffect } from 'react';
import { Button } from '../components/ui/button';
import bottomImage from '../assets/Dotted-Bg.png';

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error(
      '404 Error: User attempted to access non-existent route:',
      location.pathname,
    );
  }, [location.pathname]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="text-center mb-15 z-1">
        <h1 className="text-[200px] font-bold italic">404</h1>
        <p className="text-2xl  -mt-10 mb-4">We all get lost sometimes</p>
        <Button asChild variant={'outline'}>
          <a className="" onClick={() => (window.location.href = '/')}>
            Path back Home
          </a>
        </Button>
      </div>
      <div
        className="absolute inset-0 bg-contain bg-bottom mask-radial-[45%_90%] mask-t-from-80% mask-b-from-95% mask-radial-from-90% "
        style={{ backgroundImage: `url(${bottomImage})` }}
      />
    </div>
  );
};

export default NotFound;
