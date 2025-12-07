import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useLearningPathStore } from '@/store/learningPathStore';
import { useUserStore } from '@/store/userStore';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ChevronLeft, Bookmark, ChevronDown } from 'lucide-react';
import type { LearningPath } from '@/types/learningPath';
import DashboardLayout from './DashboardLayout';

const DEV_EDITOR_FE_URL: string =
  (import.meta.env.VITE_DEV_EDITOR_FE_URL as string) ||
  'http://localhost:3001/';

export default function CommunityHub() {
  const { communityname } = useParams<{ communityname?: string }>();
  const navigate = useNavigate();
  const [paths, setPaths] = useState<LearningPath[]>([]);
  const [loading, setLoading] = useState(true);

  const {
    fetchLearningPathsByCommunity,
    addToFavorites,
    removeFromFavorites,
    isFavorited,
  } = useLearningPathStore();

  const { user } = useUserStore();

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
    const url = `${DEV_EDITOR_FE_URL}view/${encodeURIComponent(communityname || '')}/${encodeURIComponent(path.Title)}?pathId=${path.ID}`;
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

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const day = date.getDate();
    const monthNames = [
      'Jan',
      'Feb',
      'Mar',
      'Apr',
      'May',
      'Jun',
      'Jul',
      'Aug',
      'Sep',
      'Oct',
      'Nov',
      'Dec',
    ];
    const month = monthNames[date.getMonth()];
    const year = date.getFullYear();
    return `${String(day)} ${month} ${String(year)}`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <p>Loading...</p>
      </div>
    );
  }

  const isUserCommunity = user?.Community === communityname;
  const isAdmin = user?.IsAdmin === true;
  const canCreatePath = isUserCommunity || isAdmin;

  return (
    <DashboardLayout>
      <div className=" mx-25 mt-14 animate-in fade-in duration-700">
        <div className="flex ">
          <div>
            <h1 className="text-5xl font">{communityname}</h1>
          </div>
          <div className="ml-auto flex items-center align-center gap-5">
            {paths.length > 0 && (
              <Button variant="secondary" className="!p-4.5 mt-0.5 ml-auto">
                Sort by
                <ChevronDown className="h-4 w-4" />
              </Button>
            )}
            {canCreatePath && (
              <Button
                onClick={() =>
                  void navigate(
                    `/hub/${encodeURIComponent(communityname || '')}/create-path`,
                  )
                }
                className="relative overflow-hidden cursor-pointer before:absolute before:inset-0 before:rounded-[inherit] before:bg-[linear-gradient(135deg,transparent_25%,rgba(255,255,255,0.2)_50%,transparent_75%,transparent_100%)] before:bg-[length:250%_250%,100%_100%] before:bg-no-repeat before:[animation:shine_3000ms_linear_infinite]"
              >
                Create Learning Path
              </Button>
            )}
          </div>
        </div>
        <div className="h-px bg-gray-200 w-full mt-10"></div>

        <div className="mt-10 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {paths.map((path) => (
            <Card
              key={path.ID}
              className="cursor-pointer transition animate ease-in-out hover:scale-103 hover:shadow-md duration-400"
              onClick={() => {
                handlePathClick(path);
              }}
            >
              <CardContent className="p-6">
                <p className="text-xs">{formatDate(path.UpdatedAt)}</p>
                <div className="flex justify-between items-start mb-4">
                  <h3 className="text-xl font-medium flex-1">{path.Title}</h3>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={(e) => void handleToggleFavorite(e, path.ID)}
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
    </DashboardLayout>
  );
}
