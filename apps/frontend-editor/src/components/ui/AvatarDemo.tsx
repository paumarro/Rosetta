import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useCollaborativeStore } from '@/lib/stores/collaborativeStore';

export default function AvatarDemo() {
  const { currentUser } = useCollaborativeStore();

  const authors = [
    {
      src: '',
      alt: `@${currentUser?.userName || 'user'}`,
      fallback: currentUser?.userName.slice(0, 2).toUpperCase() || 'US',
      isActive: true,
    },
    {
      src: 'https://github.com/maxleiter.png',
      alt: '@maxleiter',
      fallback: 'LR',
      isActive: true,
    },
    {
      src: 'https://github.com/evilrabbit.png',
      alt: '@evilrabbit',
      fallback: 'ER',
      isActive: true,
    },
    {
      src: 'https://github.com/vercel.png',
      alt: '@vercel',
      fallback: 'VR',
      isActive: false,
    },
    {
      src: 'https://github.com/nextjs.png',
      alt: '@nextjs',
      fallback: 'NJ',
      isActive: false,
    },
    {
      src: 'https://github.com/react.png',
      alt: '@react',
      fallback: 'RC',
      isActive: true,
    },
  ];
  const maxVisible = 4;
  const visibleAuthors = authors.slice(0, maxVisible);
  const remainingCount = authors.length - maxVisible;

  return (
    <div className="mt-3">
      <h3 className="text-lg font-semibold mb-3">Authors</h3>
      <div className="flex -space-x-1 items-center">
        {visibleAuthors.map((author, index) => (
          <div key={index}>
            <Avatar className="w-9 h-9" isActive={author.isActive}>
              <AvatarImage src={author.src} alt={author.alt} />
              <AvatarFallback className="text-sm">
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
