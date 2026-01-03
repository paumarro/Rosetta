import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

interface UserAvatarProps {
  userName: string;
  photoURL?: string;
  color: string;
  className?: string;
  fallbackClassName?: string;
}

/**
 * Centralized user avatar component that displays profile picture with initials fallback
 * Shows profile picture if available, otherwise shows user initials
 */
export function UserAvatar({
  userName,
  photoURL,
  color,
  className,
  fallbackClassName,
}: UserAvatarProps) {
  const initials = userName
    .split(' ')
    .map((word) => word[0])
    .join('')
    .toUpperCase();

  return (
    <Avatar className={className} userColor={color}>
      {photoURL && <AvatarImage src={photoURL} alt={`@${userName}`} />}
      <AvatarFallback className={fallbackClassName} userColor={color}>
        {initials}
      </AvatarFallback>
    </Avatar>
  );
}
