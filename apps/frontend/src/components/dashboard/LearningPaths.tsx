import { cn } from '@/lib/utils';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import { Card, CardContent } from '@/components/ui/card';
import {
  BookmarkIcon,
  LayoutGrid,
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
  // type CarouselApi,
} from '@/components/ui/carousel';
// import { useState, useEffect } from 'react';

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

interface LearningPath {
  id: number;
  title: string;
  isPopular?: boolean;
  isBookmarked: boolean;
  isNew?: boolean;
  knowledgeAreas: string[];
}

function PathCard({ path }: { path: LearningPath }) {
  return (
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
      knowledgeAreas: [],
    },
    {
      id: 7,
      title: 'Mobile Development',
      isPopular: false,
      isBookmarked: false,
      knowledgeAreas: ['React Native', 'Flutter', 'Swift', 'Kotlin'],
    },
    {
      id: 8,
      title: 'Cloud Architecture',
      isPopular: true,
      isBookmarked: false,
      knowledgeAreas: ['AWS', 'Azure', 'GCP', 'Terraform'],
    },
    {
      id: 9,
      title: 'Cybersecurity',
      isPopular: false,
      isBookmarked: false,
      isNew: true,
      knowledgeAreas: ['Network Security', 'Cryptography', 'Threat Analysis'],
    },
  ];

  const recentlyViewedPaths = learningPaths.slice(0, 9);
  // const [api, setApi] = useState<CarouselApi>();
  // const [current, setCurrent] = useState(0);
  // const [count, setCount] = useState(0);

  // useEffect(() => {
  //   if (!api) return;
  //   setCount(api.scrollSnapList().length);
  //   setCurrent(api.selectedScrollSnap() + 1);

  //   api.on('select', () => {
  //     setCurrent(api.selectedScrollSnap() + 1);
  //   });
  // }, [api]);
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
              {/* <div className="flex items-center">
                <div className="">
                  <Button size="icon" variant="ghost" aria-label="Previous">
                    <CircleChevronLeft className="h-4 w-4 text-muted-foreground" />
                  </Button>
                  <Button size="icon" variant="ghost" aria-label="Next">
                    <CircleChevronRight className="h-4 w-4 text-muted-foreground" />
                  </Button>
                </div>
              </div> */}
            </div>
            <div className="bg-muted p-4 rounded-2xl ">
              <Carousel
                // setApi={setApi}
                className="w-full "
              >
                <CarouselContent className="-ml-4">
                  {recentlyViewedPaths.map((path) => (
                    <CarouselItem
                      key={path.id}
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
          {/* <div className="bg-muted p-4 rounded-2xl grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {recentlyViewedPaths.map((path) => (
              <PathCard key={path.id} path={path} />
            ))}
          </div> */}
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

          <div className="bg-muted rounded-2xl flex-1"></div>
        </div>
      </div>
    </DashboardLayout>
  );
}
