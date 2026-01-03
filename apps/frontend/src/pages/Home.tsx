import AppLayout from '@/layouts/AppLayout';
import { useUserStore } from '@/store/userStore';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

interface communitiesResponse {
  communities: string[];
}

export default function Home() {
  const [communities, setCommunities] = useState<string[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const navigate = useNavigate();

  const { fetchCurrentUser } = useUserStore();

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
    <AppLayout>
      <div className="flex flex-col mt-8 items-start text-left">
        {loading ? (
          <p className="text-muted-foreground">
            Loading available communities...
          </p>
        ) : (
          <div className=" flex flex-col w-full divide-y divide-gray-300 overflow-hidden animate-in fade-in duration-700">
            {communities.map((community) => (
              <button
                key={community}
                onClick={() =>
                  void navigate(`/hub/${encodeURIComponent(community)}`)
                }
                className="text-5xl px-5 py-4 text-left hover:translate-x-5 transition-all duration-200 ease-in-out hover:text-red-500"
              >
                {community}
              </button>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
