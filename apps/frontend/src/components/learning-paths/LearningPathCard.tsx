import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { Bookmark, MoreVertical, X } from 'lucide-react';
import type { LearningPath } from '@/types/learningPath';

interface LearningPathCardProps {
  path: LearningPath;
  isFavorited: boolean;
  canEdit?: boolean;
  onPathClick: (path: LearningPath) => void;
  onToggleFavorite: (e: React.MouseEvent, pathId: string) => void;
  onDelete?: (pathId: string) => Promise<void>;
  onUpdate?: (
    pathId: string,
    title: string,
    description: string,
  ) => Promise<void>;
  formatDate: (dateString: string) => string;
}

export function LearningPathCard({
  path,
  isFavorited,
  canEdit = false,
  onPathClick,
  onToggleFavorite,
  onDelete,
  onUpdate,
  formatDate,
}: LearningPathCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(path.Title);
  const [editDescription, setEditDescription] = useState(
    path.Description || '',
  );
  const [isSaving, setIsSaving] = useState(false);

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

  const handleEditClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setEditTitle(path.Title);
    setEditDescription(path.Description || '');
    setIsEditing(true);
  };

  const handleCancelEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsEditing(false);
    setEditTitle(path.Title);
    setEditDescription(path.Description || '');
  };

  const handleSaveEdit = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!onUpdate || !editTitle.trim()) return;

    setIsSaving(true);
    try {
      await onUpdate(path.ID, editTitle.trim(), editDescription.trim());
      setIsEditing(false);
    } catch (error) {
      console.error('Failed to update learning path:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCardClick = () => {
    if (!isEditing) {
      onPathClick(path);
    }
  };

  return (
    <Card
      className={`group relative cursor-pointer transition-all ease-in-out duration-300 ${
        isEditing ? 'scale-102 shadow-lg' : 'hover:scale-103 hover:shadow-md'
      }`}
      onClick={handleCardClick}
    >
      {/* Action buttons - appear on hover in top-right */}
      {canEdit && !isEditing && (
        <div className="absolute top-2 right-2 z-10 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
          <Button
            variant="ghost"
            size="icon"
            onClick={handleEditClick}
            className="h-7 w-7 text-gray-500 rounded-full bg-background/80 hover:text-blue-500 hover:bg-white"
          >
            <MoreVertical className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={(e) => {
              void handleDeleteClick(e);
            }}
            className="h-7 w-7 text-gray-500 rounded-full bg-background/80 hover:text-red-500 hover:bg-white"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}

      <CardContent className="p-6">
        <p className="text-xs">{formatDate(path.UpdatedAt)}</p>

        {isEditing ? (
          <div
            className="mt-2 space-y-3"
            onClick={(e) => {
              e.stopPropagation();
            }}
          >
            <Input
              value={editTitle}
              onChange={(e) => {
                setEditTitle(e.target.value);
              }}
              placeholder="Title"
              className="text-xl font-xl border-0 border-b-1 border-gray"
              autoFocus
            />
            <Textarea
              value={editDescription}
              onChange={(e) => {
                setEditDescription(e.target.value);
              }}
              placeholder="Description"
              className="text-sm min-h-[80px] border-radius-sm"
            />
            <div className="mt-4 flex justify-end items-center">
              <div className="flex gap-2 justify-end">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleCancelEdit}
                  disabled={isSaving}
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={(e) => {
                    void handleSaveEdit(e);
                  }}
                  disabled={isSaving || !editTitle.trim()}
                >
                  {isSaving ? 'Saving...' : 'Save'}
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <>
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
          </>
        )}
      </CardContent>
    </Card>
  );
}
