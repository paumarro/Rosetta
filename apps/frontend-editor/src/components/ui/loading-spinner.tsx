import { cn } from '@/utils/cn';
import './loading-spinner.css';

interface LoadingSpinnerProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export function LoadingSpinner({
  className,
  size = 'md',
}: LoadingSpinnerProps) {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-6 h-6',
    lg: 'w-8 h-8',
  };

  return (
    <div
      role="status"
      className={cn('flex items-center justify-center', className)}
    >
      <div className={cn('loading-spinner', sizeClasses[size])} />
      <span className="sr-only">Loading...</span>
    </div>
  );
}
