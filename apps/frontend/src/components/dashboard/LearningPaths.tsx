import { cn } from '@/utils/cn';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import { Card, CardContent } from '@/components/ui/card';
import {
  LayoutGrid,
  BookmarkIcon,
  LayoutList,
  ChevronDown,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from '@/components/ui/carousel';
import { useEffect } from 'react';
import {
  useLearningPathStore,
  type LearningPath,
} from '@/store/learningPathStore';

const DEV_EDITOR_FE_URL = import.meta.env.VITE_DEV_EDITOR_FE_URL as string;

function NewBadge() {
  return (
    <div className="absolute bottom-1.5 right-2 flex items-center rounded-br rounded-tl text-xs animate-pulse">
      <span className="mr-1.5 flex h-2 w-2  rounded-full bg-primary"></span>
      <span className="text-primary">New</span>
    </div>
  );
}

function BookMarkButton({
  isBookmarked,
  onClick,
}: {
  isBookmarked: boolean;
  onClick: (e: React.MouseEvent) => void;
}) {
  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={onClick}
      className="absolute top-1 right-1  hover:opacity-100 group cursor-pointer"
    >
      <BookmarkIcon
        className={cn(
          'h-5 w-5 text-muted-foreground transition-transform duration-200 group-hover:scale-115',
          isBookmarked
            ? 'fill-accent-foreground text-accent-foreground'
            : 'fill-none',
        )}
      />{' '}
      <span className="sr-only">
        {isBookmarked ? 'Remove from bookmarks' : 'Add to bookmarks'}
      </span>
    </Button>
  );
}

function PathCard({ path }: { path: LearningPath }) {
  const { isFavorited, addToFavorites, removeFromFavorites } =
    useLearningPathStore();

  // Check if path was created in the last 7 days
  const isNew =
    new Date(path.CreatedAt).getTime() > Date.now() - 7 * 24 * 60 * 60 * 1000;

  const handlePathClick = () => {
    // Use path's Community field for URL
    if (path.Community) {
      window.location.href = `${DEV_EDITOR_FE_URL}view/${encodeURIComponent(path.Community)}/${encodeURIComponent(path.ID)}`;
    } else {
      // Fallback: legacy path without community
      window.location.href = `${DEV_EDITOR_FE_URL}view/${encodeURIComponent(path.ID)}`;
    }
  };

  const isBookmarked = isFavorited(path.ID);

  const handleBookmarkToggle = (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent card click event
    void (async () => {
      try {
        if (isBookmarked) {
          await removeFromFavorites(path.ID);
        } else {
          await addToFavorites(path.ID);
        }
      } catch (error) {
        console.error('Failed to toggle bookmark:', error);
      }
    })();
  };

  return (
    <Card
      key={path.ID}
      className="relative bg-card  hover:bg-secondary/50 cursor-pointer  transition-colors p-2"
      onClick={handlePathClick}
    >
      <BookMarkButton
        isBookmarked={isBookmarked}
        onClick={handleBookmarkToggle}
      />
      <CardContent className="px-4 py-8 flex flex-col justify-center h-full">
        <div>{path.Title}</div>
        {/* Skill badges - positioned absolutely */}
        <div className=" absolute bottom-3 left-4 flex flex-wrap gap-1.5 max-w-[80%]">
          {path.Skills?.slice(0, 4).map((skill) => (
            <Badge
              key={skill.ID}
              variant="secondary"
              className="text-xs py-0.5 px-2"
            >
              {skill.Name}
            </Badge>
          ))}
          {path.Skills && path.Skills.length > 4 && (
            <Badge variant="outline" className="text-xs py-0.5 px-2">
              +{path.Skills.length - 4}
            </Badge>
          )}
        </div>
        {isNew && <NewBadge />}
      </CardContent>
    </Card>
  );
}

export default function LearningPaths() {
  const {
    fetchLearningPaths,
    fetchUserFavorites,
    fetchRecentlyViewed,
    recentlyViewed,
    learningPaths,
    isLoading,
    error,
  } = useLearningPathStore() as {
    fetchLearningPaths: () => Promise<void>;
    fetchUserFavorites: () => Promise<void>;
    fetchRecentlyViewed: () => void;
    recentlyViewed: LearningPath[];
    learningPaths: LearningPath[];
    isLoading: boolean;
    error: string | null;
  };

  useEffect(() => {
    void fetchLearningPaths().then(() => {
      fetchRecentlyViewed();
    });
    void fetchUserFavorites();
  }, [fetchLearningPaths, fetchUserFavorites, fetchRecentlyViewed]);

  const recentlyViewedPaths = recentlyViewed.slice(0, 9);

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <p className="text-muted-foreground">Loading learning paths...</p>
        </div>
      </DashboardLayout>
    );
  }

  if (error) {
    return (
      <DashboardLayout>
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-600 font-semibold">Error</p>
          <p className="text-red-600">{error}</p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="flex flex-col gap-4 h-full">
        <h2 className="text-xl font-semibold">Community Learning Paths</h2>
        <div>
          {/* Recently viewed section */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="text-sm text-muted-foreground">
                Recently viewed
              </div>
            </div>
            <div className="bg-muted p-4 rounded-2xl ">
              <Carousel className="w-full ">
                <CarouselContent className="-ml-4">
                  {recentlyViewedPaths.map((path) => (
                    <CarouselItem
                      key={path.ID}
                      className="pl-4 md:basis-1/2 lg:basis-1/3"
                    >
                      <PathCard path={path} />
                    </CarouselItem>
                  ))}
                </CarouselContent>
                <div className="mt-2 flex justify-between">
                  <CarouselPrevious className="relative left-0 right-auto translate-y-0 position-static" />
                  <CarouselNext className="relative right-0 left-auto translate-y-0 position-static" />
                </div>
              </Carousel>
            </div>
          </div>
        </div>
        <Separator />
        {/* Fillters and sorting */}
        <div className="flex flex-col flex-1 h-full">
          <div className="text-sm flex items-center justify-end text-muted-foreground gap-2 mb-2">
            <div className="flex items-center gap-2">
              All <ChevronDown className="h-3 w-3" />
            </div>
            <div className="flex items-center gap-2">
              Alphabethical
              <ChevronDown className="h-3 w-3" />
            </div>
            <div className="flex items-center gap-2">
              Newest first <ChevronDown className="h-3 w-3" />
            </div>

            <div className="bg-muted border rounded-md">
              <Button
                variant="ghost"
                size="icon"
                data-state="active"
                className="data-[state=active]:bg-white"
              >
                <LayoutGrid className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon">
                <LayoutList className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="bg-muted rounded-2xl flex-1">
            <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {learningPaths.map((path) => (
                <PathCard key={path.ID} path={path} />
              ))}
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
