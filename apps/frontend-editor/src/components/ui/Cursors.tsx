import { useCollaborativeStore } from '@/lib/stores/collaborativeStore';

export default function Cursors() {
  const { connectedUsers, currentUser, isViewMode } = useCollaborativeStore();

  // Filter out current user and users without cursor data
  // In view mode, don't show any cursors from other users
  const otherUsersWithCursors = isViewMode
    ? []
    : connectedUsers.filter(
        (user) => user.userId !== currentUser?.userId && user.cursor,
      );

  return (
    <>
      {otherUsersWithCursors.map((user) => {
        if (!user.cursor) return null;

        const userColor = user.color || '#3b82f6';

        return (
          <div
            key={user.userId}
            className="pointer-events-none"
            style={{
              position: 'absolute',
              left: user.cursor.x,
              top: user.cursor.y,
              transform: 'translate(-1px, -1px)',
              transition: 'left 0.1s ease-out, top 0.1s ease-out',
              zIndex: 1000,
            }}
          >
            {/* Figma-style Cursor SVG */}
            <svg
              width="24"
              height="32"
              viewBox="0 0 24 32"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              style={{
                filter: 'drop-shadow(0 2px 4px rgba(0, 0, 0, 0.3))',
              }}
            >
              {/* Cursor shape - Figma style */}
              <path
                d="M3 3L10.07 19.97L12.58 12.58L19.97 10.07L3 3Z"
                fill={userColor}
                stroke="white"
                strokeWidth="1.5"
                strokeLinejoin="round"
              />
            </svg>

            {/* User name label - Figma style */}
            <div
              className="absolute left-6 top-5 text-xs font-semibold text-white px-2.5 py-1 rounded-md whitespace-nowrap"
              style={{
                backgroundColor: userColor,
                boxShadow:
                  '0 2px 8px rgba(0, 0, 0, 0.15), 0 1px 3px rgba(0, 0, 0, 0.2)',
              }}
            >
              {user.userName}
            </div>
          </div>
        );
      })}
    </>
  );
}
