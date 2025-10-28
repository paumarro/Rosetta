import * as React from 'react';
import * as AvatarPrimitive from '@radix-ui/react-avatar';

import { cn } from '@/lib/utils';

interface AvatarProps
  extends React.ComponentProps<typeof AvatarPrimitive.Root> {
  isActive?: boolean;
  userColor?: string;
}

function Avatar({ className, isActive, userColor, ...props }: AvatarProps) {
  const borderColor = userColor || '#3b82f6';

  // Convert hex to rgba with 40% opacity for border
  const hexToRgba = (hex: string, alpha: number) => {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${String(r)}, ${String(g)}, ${String(b)}, ${String(alpha)})`;
  };

  return (
    <div
      className={cn('m-1', isActive && 'rounded-full w-fit')}
      style={
        isActive
          ? {
              border: `3px solid ${hexToRgba(borderColor, 0.4)}`,
              boxShadow: `0 0 0 1px rgba(255, 255, 255, 0.8), 0 2px 8px ${borderColor}40`,
            }
          : undefined
      }
    >
      <AvatarPrimitive.Root
        data-slot="avatar"
        className={cn(
          'relative flex size-8 shrink-0 overflow-hidden rounded-full border-[1.5px] border-sub-bg',
          className,
        )}
        {...props}
      />
    </div>
  );
}

function AvatarImage({
  className,
  ...props
}: React.ComponentProps<typeof AvatarPrimitive.Image>) {
  return (
    <AvatarPrimitive.Image
      data-slot="avatar-image"
      className={cn('aspect-square size-full', className)}
      {...props}
    />
  );
}

interface AvatarFallbackProps
  extends React.ComponentProps<typeof AvatarPrimitive.Fallback> {
  userColor?: string;
}

function AvatarFallback({
  className,
  userColor,
  style,
  ...props
}: AvatarFallbackProps) {
  const backgroundColor = userColor || '#3b82f6';

  return (
    <AvatarPrimitive.Fallback
      data-slot="avatar-fallback"
      className={cn(
        'flex size-full items-center justify-center rounded-full text-white font-medium',
        className,
      )}
      style={{
        backgroundColor,
        ...style,
      }}
      {...props}
    />
  );
}

export { Avatar, AvatarImage, AvatarFallback };
