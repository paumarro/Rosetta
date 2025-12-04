import DashboardLayout from '@/components/dashboard/DashboardLayout';
import CommunitySelectionModal from '@/components/dashboard/CommunitySelectionModal';
import { useUserStore } from '@/store/userStore';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

interface communitiesResponse {
  communities: string[];
}

export default function Dashboard() {
  const [communities, setCommunities] = useState<string[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const navigate = useNavigate();

  const { user, fetchCurrentUser } = useUserStore();
  const showCommunityModal = user && !user.Community;

  useEffect(() => {
    void fetchCurrentUser();
  }, [fetchCurrentUser]);

  useEffect(() => {
    const fetchCommunities = async () => {
      try {
        const response = await fetch('api/communities', {
          credentials: 'include',
        });
        if (!response.ok) {
          throw new Error('Failed to fetch Communities');
        }
        const data = (await response.json()) as communitiesResponse;
        setCommunities(data.communities);
      } catch (error) {
        console.error('Error fetching communities:', error);
      } finally {
        setLoading(false);
      }
    };
    void fetchCommunities();
  }, []);

  return (
    <>
      <CommunitySelectionModal
        open={!!showCommunityModal}
        communities={communities}
      />
      <DashboardLayout>
        <div className="flex flex-col mt-10 py-5 items-start text-left">
        {/* <p className="text-xl font tracking-tight mb-2">
          Welcome to Rosseta, {firstName}
        </p> */}

        {loading ? (
          <p className="text-muted-foreground mt-2">Loading communities...</p>
        ) : (
          <div className="mt-6 flex flex-col w-full divide-y divide-gray-300 overflow-hidden">
            {communities.map((community) => (
              <button
                key={community}
                onClick={() =>
                  void navigate(`/hub/${encodeURIComponent(community)}`)
                }
                className="text-6xl px-5 py-4 text-left hover:translate-x-5 transition-all duration-200 ease-in-out hover:text-red-500"
              >
                {community}
              </button>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
    </>
  );
}
