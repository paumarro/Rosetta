import { useCallback, useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useLearningPathStore } from '@/store/learningPathStore';
import { useUserStore } from '@/store/userStore';
import { Button } from '@/components/ui/Button';
import { ChevronDown, ChevronLeft } from 'lucide-react';
import type { LearningPath } from '@/types/learningPath';
import { buildViewUrl, formatDate } from '@shared/utils';
import AppLayout from '@/layouts/AppLayout';
import { OrganizeDropdown } from '@/components/learning-paths/OrganizeDropdown';
import { LearningPathCard } from '@/components/learning-paths/LearningPathCard';
import { usePathOrganizer } from '@/hooks/usePathOrganizer';

const DEV_EDITOR_FE_URL = import.meta.env.VITE_DEV_EDITOR_FE_URL as string;

export default function CommunityHub() {
  const { communityname } = useParams<{ communityname?: string }>();
  const navigate = useNavigate();
  const [allPaths, setAllPaths] = useState<LearningPath[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  const {
    fetchLearningPathsByCommunity,
    fetchRecentlyViewed,
    fetchUserFavorites,
    addToFavorites,
    removeFromFavorites,
    isFavorited,
    favorites,
    deleteLearningPath,
    updateLearningPath,
  } = useLearningPathStore();

  const { user } = useUserStore();

  const { filter, order, organizedPaths, setFilter, setOrder } =
    usePathOrganizer({
      allPaths,
      isFavorited,
      favorites,
    });

  const fetchCommunityPaths = useCallback(async () => {
    if (!communityname) return;

    setLoading(true);
    try {
      const fetchedPaths = await fetchLearningPathsByCommunity(communityname);
      // Sort by default (Last Update)
      const sortedPaths = fetchedPaths.sort(
        (a, b) =>
          new Date(b.UpdatedAt).getTime() - new Date(a.UpdatedAt).getTime(),
      );
      setAllPaths(sortedPaths);
      // Fetch recently viewed for filtering
      fetchRecentlyViewed();
    } catch (error) {
      console.error('Error fetching community paths:', error);
    } finally {
      setLoading(false);
    }
  }, [communityname, fetchLearningPathsByCommunity, fetchRecentlyViewed]);

  useEffect(() => {
    if (communityname) {
      void fetchCommunityPaths();
      void fetchUserFavorites();
    }
  }, [communityname, fetchCommunityPaths, fetchUserFavorites]);

  const handlePathClick = (path: LearningPath) => {
    const url = buildViewUrl(DEV_EDITOR_FE_URL, communityname || '', path.ID);
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

  const handleDeletePath = async (pathId: string) => {
    try {
      await deleteLearningPath(pathId);
      // Update local state to remove the deleted path
      setAllPaths((prev) => prev.filter((p) => p.ID !== pathId));
    } catch (error) {
      console.error('Error deleting learning path:', error);
      throw error; // Re-throw to let the card component handle the error state
    }
  };

  const handleUpdatePath = async (pathId: string, title: string, description: string) => {
    try {
      const updatedPath = await updateLearningPath(pathId, title, description);
      // Update local state with the updated path
      setAllPaths((prev) =>
        prev.map((p) => (p.ID === pathId ? updatedPath : p)),
      );
    } catch (error) {
      console.error('Error updating learning path:', error);
      throw error;
    }
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
    <AppLayout>
      <div className=" mx-5 mt-14 animate-in fade-in duration-700">
        <div className="flex ">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => void navigate('/')}
              className="hover:bg-accent"
            >
              <ChevronLeft className="h-5 w-5" />
            </Button>
            <h1 className="text-5xl font">{communityname}</h1>
          </div>
          <div className="ml-auto flex items-center align-center gap-5">
            {allPaths.length > 0 && (
              <Button
                variant="secondary"
                className="!p-4.5 mt-0.5 ml-auto"
                onClick={() => {
                  setIsDropdownOpen(!isDropdownOpen);
                }}
              >
                Organize
                <ChevronDown
                  className={`h-4 w-4 transition-transform duration-300 ${isDropdownOpen ? 'rotate-180' : ''}`}
                />
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

        <OrganizeDropdown
          isOpen={isDropdownOpen}
          filter={filter}
          order={order}
          onFilterChange={setFilter}
          onSortChange={setOrder}
          onClose={() => {
            setIsDropdownOpen(false);
          }}
        />

        <div className="mt-10 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {organizedPaths.map((path) => (
            <LearningPathCard
              key={path.ID}
              path={path}
              isFavorited={isFavorited(path.ID)}
              canEdit={canCreatePath}
              onPathClick={handlePathClick}
              onToggleFavorite={(e) => {
                void handleToggleFavorite(e, path.ID);
              }}
              onDelete={handleDeletePath}
              onUpdate={handleUpdatePath}
              formatDate={formatDate}
            />
          ))}
        </div>

        {organizedPaths.length === 0 && (
          <div className="text-center py-12">
            <p className="text-muted-foreground">No learning paths here yet.</p>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
