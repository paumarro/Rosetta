import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { UserAvatar } from '@/components/ui/UserAvatar';
import { useCollaborativeStore } from '@/store/collaborationStore';

export default function AvatarStack() {
  const { connectedUsers, currentUser } = useCollaborativeStore();

  const otherUsers = connectedUsers.filter(
    (user) => user.userId !== currentUser?.userId,
  );

  // Create authors array with current user first
  const connectedAuthors = [
    ...(currentUser ? [currentUser] : []),
    ...otherUsers,
  ];

  const maxVisible = 4;
  const visibleAuthors = connectedAuthors.slice(0, maxVisible);
  const remainingCount = connectedAuthors.length - maxVisible;

  // Don't render if no users
  if (connectedAuthors.length === 0) {
    return null;
  }

  return (
    <div className="">
      <div className="flex -space-x-3 items-center">
        {visibleAuthors.map((user) => (
          <div key={user.userId}>
            <UserAvatar
              userName={user.userName}
              photoURL={user.photoURL}
              color={user.color ?? '#000000'}
              className="w-10 h-10"
              fallbackClassName="text-sm"
            />
          </div>
        ))}
        {remainingCount > 0 && (
          <Avatar className="w-9 h-9">
            <AvatarFallback className="text-sm  ">
              +{remainingCount}
            </AvatarFallback>
          </Avatar>
        )}
      </div>
    </div>
  );
}
