import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useCollaborativeStore } from '@/lib/stores/collaborativeStore';

export default function AvatarDemo() {
  const { connectedUsers, currentUser } = useCollaborativeStore();

  const otherUsers = connectedUsers.filter(
    (user) => user.userId !== currentUser?.userId,
  );

  // Create authors array with current user first
  const connectedAuthors = [
    // Current user first
    ...(currentUser
      ? [
          {
            userId: currentUser.userId,
            src: '',
            alt: `@${currentUser.userName}`,
            fallback: currentUser.userName.slice(0, 2).toUpperCase(),
            isActive: true,
            color: currentUser.color,
          },
        ]
      : []),
    ...otherUsers.map((user) => ({
      userId: user.userId,
      src: '',
      alt: `@${user.userName}`,
      fallback: user.userName.slice(0, 2).toUpperCase(),
      isActive: true,
      color: user.color,
    })),
  ];

  const allAuthors = [...connectedAuthors];

  const maxVisible = 4;
  const visibleAuthors = allAuthors.slice(0, maxVisible);
  const remainingCount = allAuthors.length - maxVisible;

  return (
    <div className="mt-3">
      <h3 className="text-lg font-semibold mb-3">Authors</h3>
      <div className="flex -space-x-1 items-center">
        {visibleAuthors.map((author) => (
          <div key={author.userId}>
            <Avatar
              className="w-9 h-9"
              isActive={author.isActive}
              userColor={author.color}
            >
              <AvatarImage src={author.src} alt={author.alt} />
              <AvatarFallback className="text-sm" userColor={author.color}>
                {author.fallback}
              </AvatarFallback>
            </Avatar>
          </div>
        ))}
        {remainingCount > 0 && (
          <Avatar className="w-9 h-9" isActive={false}>
            <AvatarFallback className="text-sm  ">
              +{remainingCount}
            </AvatarFallback>
          </Avatar>
        )}
      </div>
    </div>
  );
}
