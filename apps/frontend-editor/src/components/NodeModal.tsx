import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { X, Trash2 } from 'lucide-react';
import data from '@/lib/templates/mockData.json';
import { useCollaborativeStore } from '@/lib/stores/collaborativeStore';

interface Resource {
  title: string;
  type: 'article' | 'video';
  url: string;
}

interface NodeData {
  label: string;
  description?: string;
  resources?: Resource[];
}

interface ModalData {
  nodeId: string;
  data: NodeData;
}

export function NodeModal() {
  const [isOpen, setIsOpen] = useState(false);
  const [modalData, setModalData] = useState<ModalData | null>(null);
  const [isCompleted, setIsCompleted] = useState(false);
  const { deleteNode } = useCollaborativeStore();

  useEffect(() => {
    const handleOpenModal = (
      event: CustomEvent<{ nodeId: string; data: NodeData }>,
    ) => {
      const nodeData = event.detail.data;
      const mockNode = data.nodes.find(
        (node) => node.id === event.detail.nodeId,
      );

      const mockResources: Resource[] =
        mockNode?.data.resources.map((resource) => ({
          title: resource.title,
          type: resource.type === 'video' ? 'video' : 'article',
          url: resource.url,
        })) || [];

      const enrichedData: ModalData = {
        nodeId: event.detail.nodeId,
        data: {
          label: nodeData.label,
          description: nodeData.description || mockNode?.data.description,
          resources: nodeData.resources || mockResources,
        },
      };

      setModalData(enrichedData);
      setIsOpen(true);

      const completed =
        localStorage.getItem(`node-${event.detail.nodeId}-completed`) ===
        'true';
      setIsCompleted(completed);
    };

    window.addEventListener('openNodeModal', handleOpenModal as EventListener);
    return () => {
      window.removeEventListener(
        'openNodeModal',
        handleOpenModal as EventListener,
      );
    };
  }, []);

  const handleClose = () => {
    setIsOpen(false);
    setModalData(null);
  };

  const handleMarkComplete = () => {
    if (modalData) {
      localStorage.setItem(`node-${modalData.nodeId}-completed`, 'true');
      setIsCompleted(true);
    }
  };

  const handleMarkInProgress = () => {
    if (modalData) {
      localStorage.setItem(`node-${modalData.nodeId}-completed`, 'false');
      setIsCompleted(false);
    }
  };

  const handleDelete = () => {
    if (
      modalData &&
      window.confirm(
        `Are you sure you want to delete "${modalData.data.label}"?`,
      )
    ) {
      deleteNode(modalData.nodeId);
      handleClose();
    }
  };

  if (!isOpen || !modalData) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[80vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-bold">{modalData.data.label}</h2>
            {isCompleted && (
              <div className="flex items-center gap-1 px-2 py-1 bg-green-100 text-green-800 rounded-full text-sm">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                Completed
              </div>
            )}
          </div>
          <Button variant="ghost" size="icon" onClick={handleClose}>
            <X className="w-4 h-4" />
          </Button>
        </div>

        {/* Content */}
        <div className="p-6">
          {modalData.data.description && (
            <div className="mb-6">
              <p className="text-gray-700 leading-relaxed">
                {modalData.data.description}
              </p>
            </div>
          )}

          {modalData.data.resources && modalData.data.resources.length > 0 && (
            <div className="mb-6">
              <h3 className="text-lg font-semibold mb-4">
                Visit the following resources to learn more
              </h3>
              <div className="space-y-3">
                {modalData.data.resources.map((resource, index) => (
                  <div
                    key={index}
                    className="flex items-center gap-3 p-3 border rounded-lg hover:bg-gray-50"
                  >
                    <span
                      className={`px-2 py-1 rounded text-xs font-medium 
                        ${
                          resource.type === 'article'
                            ? 'bg-purple-100 text-purple-800'
                            : 'bg-yellow-100 text-yellow-800'
                        }`}
                    >
                      {resource.type === 'article' ? 'Article' : 'Video'}
                    </span>
                    <a
                      href={resource.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline font-medium flex-1"
                    >
                      {resource.title}
                    </a>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-between items-center p-6 border-t bg-gray-50">
          <div className="flex gap-2">
            <Button
              onClick={handleDelete}
              variant="outline"
              className="text-red-600 hover:text-red-700 hover:bg-red-50"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Delete Node
            </Button>
            {!isCompleted ? (
              <Button onClick={handleMarkInProgress} variant="outline">
                Still in Progress
              </Button>
            ) : (
              <Button onClick={handleMarkInProgress} variant="outline">
                Mark as In Progress
              </Button>
            )}
          </div>
          <Button onClick={handleMarkComplete} disabled={isCompleted}>
            {isCompleted ? 'Completed' : 'Complete'}
          </Button>
        </div>
      </div>
    </div>
  );
}
