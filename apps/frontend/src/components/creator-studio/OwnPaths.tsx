import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import {
  LayoutGrid,
  LayoutList,
  ChevronDown,
  Trash2,
  Edit,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from '@/components/ui/carousel';
import { buildEditorUrl } from '@shared/utils';
import { useLearningPathStore } from '@/store/learningPathStore';
import { useUserStore } from '@/store/userStore';

// Frontend interface
interface CreatorLearningPath {
  ID: string;
  Title: string;
  Description: string;
  IsPublic: boolean;
  Thumbnail: string;
  DiagramID: string;
  CreatedAt: string;
  UpdatedAt: string;
  Skills?: Array<{ ID: string; Name: string }>;
}

function CreatorPathCard({
  path,
  onDelete,
  onEdit,
  deleting,
}: {
  path: CreatorLearningPath;
  onDelete: (id: string, e: React.MouseEvent) => Promise<void>;
  onEdit: (id: string) => void;
  deleting: boolean;
}) {
  return (
    <Card className="relative bg-muted hover:bg-secondary/50 cursor-pointer gap-2 transition-colors p-2 group">
      {path.Thumbnail && (
        <div className="bg-white rounded-lg w-full h-40 overflow-hidden">
          <img
            src={path.Thumbnail}
            alt={`${path.Title} thumbnail`}
            className="w-full h-full object-contain"
          />
        </div>
      )}
      <CardContent className="bg-muted px-4 flex flex-col">
        <div className="flex justify-between items-start mb-2">
          <h3 className="flex-1">{path.Title}</h3>
          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0 hover:bg-blue-50 hover:text-blue-600"
              onClick={(e) => {
                e.stopPropagation();
                onEdit(path.ID);
              }}
              disabled={deleting}
            >
              <Edit className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0 hover:bg-red-50 hover:text-red-600"
              onClick={(e) => {
                onDelete(path.ID, e).catch(console.error);
              }}
              disabled={deleting}
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        </div>
        <p className="text-sm text-muted-foreground line-clamp-2 mb-2">
          {path.Description || 'No description'}
        </p>
        <div className="text-xs text-muted-foreground mb-3">
          Created: {new Date(path.CreatedAt).toLocaleDateString()}
        </div>

        {/* Skills badges */}
        <div className="flex flex-wrap gap-1.5 mt-auto">
          {path.Skills && path.Skills.length > 0 ? (
            path.Skills.slice(0, 4).map((skill, index) => (
              <Badge
                key={index}
                variant="outline"
                className="text-xs py-0.5 px-2"
              >
                {skill.Name}
              </Badge>
            ))
          ) : (
            <span className="text-xs text-muted-foreground">
              No skills added yet
            </span>
          )}
          {path.Skills && path.Skills.length > 4 && (
            <Badge variant="secondary" className="text-xs py-0.5 px-2">
              +{path.Skills.length - 4}
            </Badge>
          )}
        </div>
      </CardContent>
      {deleting && (
        <div className="absolute inset-0 bg-white/80 rounded-lg flex items-center justify-center">
          <p className="text-sm text-gray-600">Deleting...</p>
        </div>
      )}
    </Card>
  );
}

export default function OwnPaths() {
  const { user } = useUserStore();
  const {
    learningPaths,
    isLoading,
    error,
    fetchLearningPaths,
    deleteLearningPath,
    setError,
  } = useLearningPathStore();
  const [deletingPathId, setDeletingPathId] = useState<string | null>(null);
  const DEV_EDITOR_FE_URL = import.meta.env.VITE_DEV_EDITOR_FE_URL as string;

  useEffect(() => {
    void fetchLearningPaths();
  }, [fetchLearningPaths]);

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const path = learningPaths.find((lp) => lp.ID === id);
    if (
      !confirm(
        `Are you sure you want to delete "${path?.Title ?? 'this learning path'}"? This will also delete the associated diagram.`,
      )
    ) {
      return;
    }

    setDeletingPathId(id);
    try {
      await deleteLearningPath(id);
    } catch (error) {
      console.error('Failed to delete learning path:', error);
    } finally {
      setDeletingPathId(null);
    }
  };

  const handleEdit = (id: string) => {
    // Navigate to editor with the learning path's diagram
    const path = learningPaths.find((lp) => lp.ID === id);
    if (path && user?.Community) {
      // Include user's community in editor URL
      window.location.href = buildEditorUrl(DEV_EDITOR_FE_URL, user.Community, path.ID);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Loading learning paths...</p>
      </div>
    );
  }

  return (
    <>
      <div className="flex flex-col gap-4 h-full">
        {/* Error display */}
        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-600">{error}</p>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setError(null);
              }}
            >
              Dismiss
            </Button>
          </div>
        )}

        {/* Recently edited section */}
        {learningPaths.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="text-sm text-muted-foreground">
                Recently edited
              </div>
            </div>
            <div className="bg-muted p-4 rounded-2xl ">
              <Carousel className="w-full ">
                <CarouselContent className="-ml-4">
                  {learningPaths.slice(0, 6).map((path) => (
                    <CarouselItem
                      key={path.ID}
                      className="pl-4 md:basis-1/2 lg:basis-1/3"
                    >
                      <CreatorPathCard
                        path={path}
                        onDelete={handleDelete}
                        onEdit={handleEdit}
                        deleting={deletingPathId === path.ID}
                      />
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
        )}

        <Separator />
        {/* Filters and sorting */}
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

          {/* Learning paths grid */}
          <div className="bg-muted rounded-2xl flex-1 ">
            <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {learningPaths.length > 0 ? (
                learningPaths.map((path) => (
                  <CreatorPathCard
                    key={path.ID}
                    path={path}
                    onDelete={handleDelete}
                    onEdit={handleEdit}
                    deleting={deletingPathId === path.ID}
                  />
                ))
              ) : (
                <div className="col-span-full flex items-center justify-center py-12 text-muted-foreground">
                  No learning paths yet. Create your first one!
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
