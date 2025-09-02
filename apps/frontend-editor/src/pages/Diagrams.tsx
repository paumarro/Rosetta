import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Plus } from 'lucide-react';
import { useDiagramStore } from '@/lib/stores';

export default function DiagramsPage() {
  // const [diagrams, setDiagrams] = useState<Diagram[]>([]);
  // const [isLoading, setIsLoading] = useState(true);
  const [newDiagramName, setNewDiagramName] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const navigate = useNavigate();

  const { diagrams, isLoading, error, fetchDiagrams, addDiagram, setError } =
    useDiagramStore();

  useEffect(() => {
    void fetchDiagrams();
  }, [fetchDiagrams]);

  const handleCreateNewDiagram = async () => {
    if (!newDiagramName.trim()) return;
    await addDiagram(newDiagramName);

    //Reset form after sucessfull creation (only if no error)
    if (!error) {
      setNewDiagramName('');
      setIsCreating(false);
    }
  };

  const handleCancelCreate = () => {
    setIsCreating(false);
    setNewDiagramName('');
    setError(null);
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
        <Button
          onClick={() => {
            setIsCreating(true);
          }}
          variant="outline"
          size="sm"
          className="flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          New Diagram
        </Button>
      </div>

      {/* Errro display */}
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

      {isCreating && (
        <div className="mb-8 p-4 border rounded-lg bg-white">
          <h2 className="text-lg font-semibold mb-4">Create New Diagram</h2>
          <div className="flex gap-4">
            <input
              type="text"
              value={newDiagramName}
              onChange={(e) => {
                setNewDiagramName(e.target.value);
              }}
              placeholder="Enter diagram name"
              className="flex-1 px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  void handleCreateNewDiagram();
                }
              }}
            />
            <Button
              onClick={() => void handleCreateNewDiagram()}
              disabled={!newDiagramName.trim()}
            >
              Create
            </Button>
            <Button variant="outline" onClick={handleCancelCreate}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {diagrams.map((diagram) => (
          <div
            key={diagram.name}
            className="p-6 bg-white rounded-lg shadow-md border hover:shadow-lg transition-shadow cursor-pointer"
            onClick={() => void navigate(`/editor/${diagram.name}`)}
          >
            <h2 className="text-xl font-semibold mb-2">{diagram.name}</h2>
            <div className="text-sm text-gray-500">
              <p>Created: {new Date(diagram.createdAt).toLocaleDateString()}</p>
              <p>
                Last updated: {new Date(diagram.updatedAt).toLocaleDateString()}
              </p>
            </div>
          </div>
        ))}

        {diagrams.length === 0 && !isCreating && (
          <div className="col-span-full text-center py-12 text-gray-500">
            No diagrams yet. Click `&ldquo;New Diagram`&ldquo; to create one.
          </div>
        )}
      </div>
    </div>
  );
}
