import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useLearningPathStore } from '@/store/learningPathStore';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Bookmark } from 'lucide-react';
import type { LearningPath } from '@/types/learningPath';

const DEV_EDITOR_FE_URL =
  import.meta.env.VITE_DEV_EDITOR_FE_URL || 'http://localhost:3001/';

export default function CommunityHub() {
  const { communityname } = useParams<{ communityname: string }>();
  const navigate = useNavigate();
  const [paths, setPaths] = useState<LearningPath[]>([]);
  const [loading, setLoading] = useState(true);

  const {
    fetchLearningPathsByCommunity,
    addToFavorites,
    removeFromFavorites,
    isFavorited,
  } = useLearningPathStore();

  useEffect(() => {
    if (communityname) {
      fetchCommunityPaths();
    }
  }, [communityname]);

  const fetchCommunityPaths = async () => {
    if (!communityname) return;

    setLoading(true);
    try {
      const fetchedPaths = await fetchLearningPathsByCommunity(communityname);
      setPaths(fetchedPaths);
    } catch (error) {
      console.error('Error fetching community paths:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePathClick = (path: LearningPath) => {
    const url = `${DEV_EDITOR_FE_URL}view/${encodeURIComponent(path.Title)}?pathId=${path.ID}`;
    window.location.href = url;
  };

  const handleToggleFavorite = async (e: React.MouseEvent, pathId: string) => {
    e.stopPropagation();
    try {
      if (isFavorited(pathId)) {
        await removeFromFavorites(pathId);
      } else {
        await addToFavorites(pathId);
      }
    } catch (error) {
      console.error('Error toggling favorite:', error);
    }
  };

  const isNew = (createdAt: string) => {
    const created = new Date(createdAt);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - created.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays <= 7;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <p>Loading...</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      <div className="mb-8">
        <Button
          variant="ghost"
          onClick={() => void navigate('/')}
          className="mb-4"
        >
          ← Back to Communities
        </Button>
        <h1 className="text-4xl font-bold">{communityname}</h1>
        <p className="text-muted-foreground mt-2">
          {paths.length} learning path{paths.length !== 1 ? 's' : ''} available
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {paths.map((path) => (
          <Card
            key={path.ID}
            className="cursor-pointer hover:shadow-lg transition-shadow"
            onClick={() => {
              handlePathClick(path);
            }}
          >
            <CardContent className="p-6">
              <div className="flex justify-between items-start mb-4">
                <h3 className="text-xl font-semibold flex-1">{path.Title}</h3>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={(e) => handleToggleFavorite(e, path.ID)}
                  className="ml-2"
                >
                  <Bookmark
                    className={`h-5 w-5 ${
                      isFavorited(path.ID) ? 'fill-current' : ''
                    }`}
                  />
                </Button>
              </div>

              {path.Description && (
                <p className="text-sm text-muted-foreground mb-4">
                  {path.Description}
                </p>
              )}

              <div className="flex flex-wrap gap-2">
                {isNew(path.CreatedAt) && <Badge variant="default">New</Badge>}
                {path.Skills?.map((skill) => (
                  <Badge key={skill.ID} variant="secondary">
                    {skill.Name}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {paths.length === 0 && (
        <div className="text-center py-12">
          <p className="text-muted-foreground">
            No learning paths available for this community yet.
          </p>
        </div>
      )}
    </div>
  );
}
