import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Bookmark } from 'lucide-react';
import type { LearningPath } from '@/types/learningPath';

interface LearningPathCardProps {
  path: LearningPath;
  isFavorited: boolean;
  onPathClick: (path: LearningPath) => void;
  onToggleFavorite: (e: React.MouseEvent, pathId: string) => void;
  formatDate: (dateString: string) => string;
}

export function LearningPathCard({
  path,
  isFavorited,
  onPathClick,
  onToggleFavorite,
  formatDate,
}: LearningPathCardProps) {
  return (
    <Card
      className="cursor-pointer transition animate ease-in-out hover:scale-103 hover:shadow-md duration-400"
      onClick={() => onPathClick(path)}
    >
      <CardContent className="p-6">
        <p className="text-xs">{formatDate(path.UpdatedAt)}</p>
        <div className="flex justify-between items-start mb-4">
          <h3 className="text-xl font-medium flex-1">{path.Title}</h3>
          <Button
            variant="ghost"
            size="icon"
            onClick={(e) => onToggleFavorite(e, path.ID)}
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
