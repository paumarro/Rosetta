import * as React from 'react';
import * as AvatarPrimitive from '@radix-ui/react-avatar';

import { cn } from '@/lib/utils';

interface AvatarProps
  extends React.ComponentProps<typeof AvatarPrimitive.Root> {
  isActive?: boolean;
}

function Avatar({ className, isActive, ...props }: AvatarProps) {
  return (
    <div
      className={cn(
        'm-1',
        isActive && 'border-[3px] border-blue-300 rounded-full w-fit',
      )}
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

function AvatarFallback({
  className,
  ...props
}: React.ComponentProps<typeof AvatarPrimitive.Fallback>) {
  return (
    <AvatarPrimitive.Fallback
      data-slot="avatar-fallback"
      className={cn(
        'bg-muted flex size-full items-center justify-center rounded-full',
        className,
      )}
      {...props}
    />
  );
}

export { Avatar, AvatarImage, AvatarFallback };
