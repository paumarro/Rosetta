import { Card, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Bookmark, X } from 'lucide-react';
import type { LearningPath } from '@/types/learningPath';

interface LearningPathCardProps {
  path: LearningPath;
  isFavorited: boolean;
  canDelete?: boolean;
  onPathClick: (path: LearningPath) => void;
  onToggleFavorite: (e: React.MouseEvent, pathId: string) => void;
  onDelete?: (pathId: string) => Promise<void>;
  formatDate: (dateString: string) => string;
}

export function LearningPathCard({
  path,
  isFavorited,
  canDelete = false,
  onPathClick,
  onToggleFavorite,
  onDelete,
  formatDate,
}: LearningPathCardProps) {
  const handleDeleteClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!onDelete) return;

    const confirmed = window.confirm(
      `Are you sure you want to delete "${path.Title}"? This action cannot be undone.`,
    );

    if (confirmed) {
      await onDelete(path.ID);
    }
  };

  return (
    <Card
      className="group relative cursor-pointer transition animate ease-in-out hover:scale-103 hover:shadow-md duration-400"
      onClick={() => {
        onPathClick(path);
      }}
    >
      {/* Delete button - appears on hover in top-right */}
      {canDelete && (
        <Button
          variant="ghost"
          size="icon"
          onClick={(e) => {
            void handleDeleteClick(e);
          }}
          className="absolute top-2 right-2 z-10 h-7 w-7 text-gray-500 rounded-full bg-background/80 opacity-0 group-hover:opacity-100 transition-opacity duration-200 hover:text-red-500 hover:bg-white"
        >
          <X className="h-4 w-4" />
        </Button>
      )}

      <CardContent className="p-6">
        <p className="text-xs">{formatDate(path.UpdatedAt)}</p>
        <div className="flex justify-between items-start mb-4">
          <h3 className="text-xl font-medium flex-1">{path.Title}</h3>
          <Button
            variant="ghost"
            size="icon"
            onClick={(e) => {
              onToggleFavorite(e, path.ID);
            }}
            className="ml-2"
          >
            <Bookmark
              className={`h-5 w-5 ${isFavorited ? 'fill-current' : ''}`}
            />
          </Button>
        </div>

        {path.Description && (
          <p className="text-sm text-muted-foreground mb-4">
            {path.Description}
          </p>
        )}

        <div className="flex flex-wrap gap-2">
          {path.Skills?.map((skill) => (
            <Badge key={skill.ID} variant="secondary">
              {skill.Name}
            </Badge>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
