import { Card, CardContent } from '@/components/ui/card';
import {
  LayoutGrid,
  LayoutList,
  ChevronDown,
  Heart,
  MessageSquare,
  Share,
  Bookmark,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from '@/components/ui/carousel';

// Frontend interface
interface CreatorLearningPath {
  id: number;
  title: string;
  // Enum-like values for better readability in code
  status: 'draft' | 'published' | 'archived';
  visibility: 'private' | 'public' | 'shared';

  metrics: {
    likes: number;
    comments: number;
    shares: number;
    bookmarks: number;
  };

  dates: {
    created: string;
    lastUpdated: string;
    published: string | null;
  };

  tags: string[];
  thumbnail: string | null;
}

function CreatorPathCard({ path }: { path: CreatorLearningPath }) {
  return (
    <Card
      key={path.id}
      className="bg-muted  hover:bg-secondary/50 cursor-pointer gap-2 transition-colors p-2"
    >
      {path.thumbnail && (
        <div className="bg-white rounded-lg w-full h-40 overflow-hidden">
          <img
            src={path.thumbnail}
            alt={`${path.title} thumbnail`}
            className="w-full h-full object-contain"
          />
        </div>
      )}
      <CardContent className="bg-muted px-4 flex flex-col">
        <h3>{path.title}</h3>
        <div className="flex items-center justify-between mt-4">
          <div className="flex items-center gap-8">
            {/* Likes */}
            <div className="flex flex-col items-center">
              <Heart className="w-5 h-5" />
              <span className="text-sm mt-1">{path.metrics.likes}</span>
            </div>

            {/* Comments */}
            <div className="flex flex-col items-center">
              <MessageSquare className="w-5 h-5" />
              <span className="text-sm mt-1">{path.metrics.comments}</span>
            </div>

            {/* Shares */}
            <div className="flex flex-col items-center">
              <Share className="w-5 h-5" />
              <span className="text-sm mt-1">{path.metrics.shares}</span>
            </div>

            {/* Bookmarks */}
            <div className="flex flex-col items-center">
              <Bookmark className="w-5 h-5" />
              <span className="text-sm mt-1">{path.metrics.bookmarks}</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function OwnPaths() {
  // Sample learning paths data
  const creatorLearningPaths: CreatorLearningPath[] = [
    {
      id: 1,
      title: 'Automotive Grundlagen',
      status: 'published',
      visibility: 'public',
      metrics: {
        likes: 129,
        comments: 49,
        shares: 29,
        bookmarks: 84,
      },
      dates: {
        created: '2024-11-15',
        lastUpdated: '2025-01-20',
        published: '2024-11-20',
      },
      tags: ['automotive', 'engineering', 'mechanics', 'electronics'],
      thumbnail: '/path-preview.png',
    },
    {
      id: 2,
      title: 'Web Development Masterclass',
      status: 'published',
      visibility: 'public',
      metrics: {
        likes: 347,
        comments: 112,
        shares: 86,
        bookmarks: 192,
      },
      dates: {
        created: '2025-02-03',
        lastUpdated: '2025-05-12',
        published: '2025-02-10',
      },
      tags: ['web development', 'javascript', 'react', 'node.js', 'frontend'],
      thumbnail: '/path-preview.png',
    },
    {
      id: 3,
      title: 'Cloud Computing Fundamentals',
      status: 'draft',
      visibility: 'private',
      metrics: {
        likes: 0,
        comments: 0,
        shares: 0,
        bookmarks: 0,
      },
      dates: {
        created: '2025-05-01',
        lastUpdated: '2025-05-22',
        published: null,
      },
      tags: ['cloud', 'aws', 'azure', 'infrastructure', 'devops'],
      thumbnail: '/path-preview.png',
    },
    {
      id: 4,
      title: 'Data Science for Beginners',
      status: 'published',
      visibility: 'public',
      metrics: {
        likes: 215,
        comments: 78,
        shares: 43,
        bookmarks: 127,
      },
      dates: {
        created: '2024-09-18',
        lastUpdated: '2025-03-07',
        published: '2024-10-01',
      },
      tags: [
        'data science',
        'python',
        'statistics',
        'machine learning',
        'pandas',
      ],
      thumbnail: '/path-preview.png',
    },
    {
      id: 5,
      title: 'DevOps Best Practices',
      status: 'published',
      visibility: 'private',
      metrics: {
        likes: 32,
        comments: 8,
        shares: 3,
        bookmarks: 17,
      },
      dates: {
        created: '2025-04-10',
        lastUpdated: '2025-04-30',
        published: '2025-04-15',
      },
      tags: ['devops', 'ci/cd', 'automation', 'docker', 'kubernetes'],
      thumbnail: '/path-preview.png',
    },
  ];

  return (
    <>
      <div className="flex flex-col gap-4 h-full">
        {/* Recently viewed section */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <div className="text-sm text-muted-foreground">Recently edited</div>
          </div>
          <div className="bg-muted p-4 rounded-2xl ">
            <Carousel className="w-full ">
              <CarouselContent className="-ml-4">
                {creatorLearningPaths.map((path) => (
                  <CarouselItem
                    key={path.id}
                    className="pl-4 md:basis-1/2 lg:basis-1/3"
                  >
                    <CreatorPathCard path={path} />
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

          {/* Placeholder for learning paths call */}
          <div className="bg-muted rounded-2xl flex-1">
            <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* Placeholder for learning paths call */}
              {Array(30)
                .fill(0)
                .map((_, index) => {
                  // Just use the existing paths and cycle through them
                  const path =
                    creatorLearningPaths[index % creatorLearningPaths.length];
                  // Use a unique key by combining the original ID with the index
                  return (
                    <CreatorPathCard
                      key={`${String(path.id)}-${String(index)}`}
                      path={path}
                    />
                  );
                })}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
