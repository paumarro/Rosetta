import * as React from 'react';
import * as AvatarPrimitive from '@radix-ui/react-avatar';

import { cn } from '@/utils/cn';

interface AvatarProps
  extends React.ComponentProps<typeof AvatarPrimitive.Root> {
  userColor?: string;
}

function Avatar({ className, ...props }: AvatarProps) {
  return (
    <AvatarPrimitive.Root
      data-slot="avatar"
      className={cn('relative flex overflow-hidden rounded-full', className)}
      {...props}
    />
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
