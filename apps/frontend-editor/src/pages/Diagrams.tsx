import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDiagramStore } from '@/lib/stores';
import { Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function DiagramsPage() {
  const navigate = useNavigate();
  const [deletingDiagram, setDeletingDiagram] = useState<string | null>(null);

  const { diagrams, isLoading, fetchDiagrams, deleteDiagram, error, setError } =
    useDiagramStore();

  useEffect(() => {
    void fetchDiagrams();
  }, [fetchDiagrams]);

  const handleDelete = async (name: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent navigating to editor
    if (!confirm(`Are you sure you want to delete "${name}"?`)) {
      return;
    }

    setDeletingDiagram(name);
    try {
      await deleteDiagram(name);
    } catch (error) {
      console.error('Failed to delete diagram:', error);
    } finally {
      setDeletingDiagram(null);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        Loading diagrams...
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold">Your Diagrams</h1>
      </div>

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

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {diagrams.map((diagram) => (
          <div
            key={diagram.name}
            className="relative p-6 bg-white rounded-lg shadow-md border hover:shadow-lg transition-shadow cursor-pointer group"
            onClick={() => void navigate(`/editor/${diagram.name}`)}
          >
            <div className="flex justify-between items-start mb-2">
              <h2 className="text-xl font-semibold flex-1">{diagram.name}</h2>
              <Button
                variant="ghost"
                size="sm"
                className="opacity-0 group-hover:opacity-100 transition-opacity -mt-2 -mr-2 hover:bg-red-50 hover:text-red-600"
                onClick={(e) => void handleDelete(diagram.name, e)}
                disabled={deletingDiagram === diagram.name}
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
            <div className="text-sm text-gray-500">
              <p>Created: {new Date(diagram.createdAt).toLocaleDateString()}</p>
              <p>
                Last updated: {new Date(diagram.updatedAt).toLocaleDateString()}
              </p>
            </div>
            {deletingDiagram === diagram.name && (
              <div className="absolute inset-0 bg-white/80 rounded-lg flex items-center justify-center">
                <p className="text-sm text-gray-600">Deleting...</p>
              </div>
            )}
          </div>
        ))}

        {diagrams.length === 0 && (
          <div className="col-span-full text-center py-12 text-gray-500">
            No diagrams yet. Create a learning path in the main app to get
            started.
          </div>
        )}
      </div>
    </div>
  );
}
