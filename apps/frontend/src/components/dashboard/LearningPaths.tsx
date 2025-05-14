import { cn } from '@/lib/utils';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import { Card, CardContent } from '@/components/ui/card';
import { BookmarkIcon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

function NewBadge() {
  return (
    <div className="absolute bottom-1.5 right-2 flex items-center rounded-br rounded-tl text-xs animate-pulse">
      <span className="mr-1.5 flex h-2 w-2  rounded-full bg-primary"></span>
      <span className="text-primary">New</span>
    </div>
  );
}

function BookMarkButton({ isBookmarked }: { isBookmarked: boolean }) {
  return (
    <Button
      variant="ghost"
      size="icon"
      className="absolute top-1 right-1  hover:opacity-100"
    >
      <BookmarkIcon
        className={cn(
          'h-5 w-5 text-muted-foreground',
          isBookmarked ? 'fill-accent-foreground' : 'fill-none',
        )}
      />{' '}
      <span className="sr-only">
        {isBookmarked ? 'Remove from bookmarks' : 'Add to bookmarks'}
      </span>
    </Button>
  );
}

export default function LearningPaths() {
  // Sample learning paths data
  const learningPaths = [
    {
      id: 1,
      title: 'Frontend',
      isPopular: true,
      isBookmarked: false,
      knowledgeAreas: ['HTML', 'CSS', 'JavaScript', 'React', 'TypeScript'],
    },
    {
      id: 2,
      title: 'Backend',

      isPopular: true,
      isBookmarked: true,
      knowledgeAreas: ['Node.js', 'Express', 'SQL', 'NoSQL'],
    },
    {
      id: 3,
      title: 'DevOps',
      isPopular: false,
      isBookmarked: false,
      knowledgeAreas: ['Docker', 'Kubernetes', 'CI/CD'],
    },
    {
      id: 4,
      title: 'Full Stack',
      isPopular: true,
      isBookmarked: true,
      knowledgeAreas: ['React', 'Node.js', 'MongoDB', 'REST API', 'GraphQL'],
    },
    {
      id: 5,
      title: 'AI Engineer',
      isPopular: false,
      isBookmarked: false,
      isNew: true,
      knowledgeAreas: ['Python', 'TensorFlow', 'PyTorch', 'ML'],
    },
    {
      id: 6,
      title: 'Data Analyst',
      isPopular: true,
      isBookmarked: false,
      isNew: true,
      knowledgeAreas: [''],
    },
  ];
  return (
    <DashboardLayout>
      <div className="flex flex-col gap-4">
        <div className="mt-8">
          <h2 className="text-xl font-semibold mb-4">
            Community learning paths
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {learningPaths.map((path) => (
              <Card
                key={path.id}
                className="relative bg-card  hover:bg-secondary/50 cursor-pointer  transition-colors p-2"
              >
                <BookMarkButton isBookmarked={path.isBookmarked} />
                <CardContent className="px-4 py-8 flex flex-col justify-center h-full">
                  <div>{path.title}</div>
                  {/* Knowledge area badges - positioned absolutely */}
                  <div className=" absolute bottom-3 left-4 flex flex-wrap gap-1.5 max-w-[80%]">
                    {path.knowledgeAreas.slice(0, 4).map((area, index) => (
                      <Badge
                        key={index}
                        variant="secondary"
                        className="text-xs py-0.5 px-2"
                      >
                        {area}
                      </Badge>
                    ))}
                    {path.knowledgeAreas.length > 4 && (
                      <Badge variant="outline" className="text-xs py-0.5 px-2">
                        +{path.knowledgeAreas.length - 4}
                      </Badge>
                    )}
                  </div>
                  {path.isNew && <NewBadge />}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
