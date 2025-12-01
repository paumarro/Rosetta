import { LoadingSpinner } from './loading-spinner';
import { cn } from '@/utils/cn';

interface LoadingOverlayProps {
  className?: string;
  message?: string;
}

export function LoadingOverlay({
  className,
  message = 'Loading...',
}: LoadingOverlayProps) {
  return (
    <div
      className={cn(
        'fixed inset-0 bg-white/90 dark:bg-black/90',
        'flex flex-col items-center justify-center gap-4',
        'z-[9999]', // Ensure it's above everything
        className,
      )}
      style={{
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
      }}
    >
      <LoadingSpinner size="lg" />
      <p className="text-lg font-medium text-gray-700 dark:text-gray-300 animate-pulse">
        {message}
      </p>
    </div>
  );
}
