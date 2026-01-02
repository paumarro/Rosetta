import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/Avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/DropdownMenu';
import { Button } from '@/components/ui/Button';
import { Bookmark, LogOut, User as UserIcon } from 'lucide-react';
import { useUserStore } from '@/store/userStore';

const AUTH_URL = import.meta.env.VITE_AUTH_URL || '';

export function User() {
  const { user, clearUser } = useUserStore();

  const handleLogout = () => {
    clearUser();
    const redirectUrl = encodeURIComponent(window.location.origin + '/login');
    window.location.href = `${AUTH_URL}/auth/logout?redirect=${redirectUrl}`;
  };

  const handleProfile = () => {
    // Navigate to profile page or implement profile logic
  };

  const handleFavorites = () => {
    // Navigate to profile page or implement profile logic
  };

  if (!user) {
    return null;
  }

  const userImage = user.PhotoURL || '/api/user/photo';
  const initials = user.Name.split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          asChild
          className="rounded-full focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary p-0 h-auto"
        >
          <div>
            <Avatar className="h-12 w-12 cursor-pointer">
              <AvatarImage src={userImage} alt={user.Name} />
              <AvatarFallback>{initials}</AvatarFallback>
            </Avatar>
          </div>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuItem onClick={handleProfile} className="cursor-pointer">
          <UserIcon className="mr-2 h-4 w-4" />
          Profile
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleFavorites} className="cursor-pointer">
          <Bookmark className="mr-2 h-4 w-4" />
          Bookmarks
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleLogout} className="cursor-pointer">
          <LogOut className="mr-2 h-4 w-4" />
          Logout
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
