import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Plus, X, ChevronDown, ChevronUp } from 'lucide-react';
import { useCollaborativeStore } from '@/store/collaborativeStore';
import { DiagramNode } from '@/types/reactflow';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/Dialog';
import { Input } from '@/components/ui/Input';
import { cn } from '@shared/utils';
import { Check } from 'lucide-react';

type ModalData = Pick<DiagramNode, 'id' | 'data'>;

interface Resource {
  type: 'article' | 'video';
  title: string;
  url: string;
}

export function NodeModal() {
  const [isOpen, setIsOpen] = useState(false);
  const [modalData, setModalData] = useState<ModalData | null>(null);
  const [isCompleted, setIsCompleted] = useState(false);
  const [isResourcesExpanded, setIsResourcesExpanded] = useState(false);

  // Form state for editing
  const [editLabel, setEditLabel] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editResources, setEditResources] = useState<Resource[]>([]);

  const { deleteNode, setNodeBeingEdited, updateNodeData, isViewMode } =
    useCollaborativeStore();

  useEffect(() => {
    const handleOpenModal = (event: CustomEvent<ModalData>) => {
      // console.log('📨 Modal received event:', event.detail);
      setModalData({
        id: event.detail.id,
        data: event.detail.data,
      });

      // Initialize edit form with current data
      setEditLabel(event.detail.data.label || '');
      setEditDescription(event.detail.data.description || '');
      setEditResources(event.detail.data.resources || []);

      setIsOpen(true);
      setNodeBeingEdited(event.detail.id, true);

      const completed =
        localStorage.getItem(`node-${event.detail.id}-completed`) === 'true';
      setIsCompleted(completed);
    };

    window.addEventListener('openNodeModal', handleOpenModal as EventListener);
    return () => {
      window.removeEventListener(
        'openNodeModal',
        handleOpenModal as EventListener,
      );
    };
  }, [setNodeBeingEdited]);

  const handleOpenChange = (open: boolean) => {
    if (!open && modalData) {
      // Clear editing state when modal closes
      setNodeBeingEdited(modalData.id, false);
    }
    setIsOpen(open);
    if (!open) {
      setModalData(null);
    }
  };

  const handleToggleComplete = () => {
    if (modalData) {
      const newCompletedState = !isCompleted;
      localStorage.setItem(
        `node-${modalData.id}-completed`,
        String(newCompletedState),
      );
      setIsCompleted(newCompletedState);
    }
  };

  const handleDelete = () => {
    if (!modalData) return;
    const label =
      typeof modalData.data.label === 'string'
        ? modalData.data.label
        : 'this node';
    if (window.confirm(`Are you sure you want to delete "${label}"?`)) {
      deleteNode(modalData.id);
      handleOpenChange(false);
    }
  };

  const handleCancelEdit = () => {
    // Close modal without saving
    handleOpenChange(false);
  };

  const handleSaveEdit = () => {
    if (modalData) {
      const updatedData = {
        ...modalData.data,
        label: editLabel,
        description: editDescription,
        resources: editResources,
      };
      updateNodeData(modalData.id, updatedData);
      setModalData({ ...modalData, data: updatedData });
      handleOpenChange(false);
    }
  };

  const handleAddResource = () => {
    setEditResources([
      ...editResources,
      { type: 'article', title: '', url: '' },
    ]);
  };

  const handleRemoveResource = (index: number) => {
    setEditResources(editResources.filter((_, i) => i !== index));
  };

  const handleResourceChange = (
    index: number,
    field: keyof Resource,
    value: string,
  ) => {
    const updated = [...editResources];
    updated[index] = { ...updated[index], [field]: value };
    setEditResources(updated);
  };

  if (!isOpen || !modalData) return null;

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent
        className={cn(
          'flex flex-col',
          'max-h-[90vh] sm:max-h-[85vh]',
          'sm:max-w-lg md:max-w-xl lg:max-w-5xl p-17',
          'overflow-hidden',
        )}
        onOpenAutoFocus={(e) => {
          e.preventDefault();
        }}
      >
        {/* Fixed Header - Title only */}
        <DialogHeader className="flex-shrink-0 pb-4">
          <div className="flex flex-col gap-3">
            {isViewMode ? (
              <>
                <DialogTitle className="text-5xl font-bold">
                  {modalData.data.label}
                </DialogTitle>
                <div className="h-px bg-gray-200 w-full mt-2"></div>
                {isCompleted && (
                  <div className="w-15 h-15 flex items-center gap-1 px-2 py-1 bg-[#ECFDF3] rounded-full text-sm justify-center">
                    <div className="w-10 h-10 bg-[#D1FADF] rounded-full flex items-center justify-center">
                      <Check
                        className="text-[#039855]"
                        width={20}
                        height={20}
                      />
                    </div>
                  </div>
                )}
              </>
            ) : (
              <Input
                value={editLabel}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                  setEditLabel(e.target.value);
                }}
                autoFocus={false}
                tabIndex={-1}
                className="text-5xl font-bold h-auto border-0 border-b-1 border-gray-300 rounded-none focus:border-black focus:ring-0 focus-visible:ring-0 focus-visible:ring-offset-0"
                placeholder="Topic Title"
              />
            )}
          </div>
        </DialogHeader>

        {isViewMode ? (
          // View Mode: Sequential content with scrolling
          <div className="flex-1 overflow-y-auto min-h-0 -mx-1 px-1">
            {/* Description */}
            {modalData.data.description && (
              <DialogDescription className="leading-relaxed rounded-none text-left text-base pb-4 text-black">
                {modalData.data.description}
                <br />
              </DialogDescription>
            )}

            {/* Resources */}
            {Array.isArray(modalData.data.resources) &&
              modalData.data.resources.length > 0 && (
                <>
                  <h3 className="leading-relaxed text-left text-base mb-4 mt-4 font-bold">
                    Resources
                  </h3>
                  <div className="space-y-1">
                    {modalData.data.resources.map(
                      (resource: Resource, index: number) => (
                        <div
                          key={index}
                          className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-50"
                        >
                          <span
                            className={`px-2 py-1 rounded text-xs font-medium 
                        ${
                          resource.type === 'article'
                            ? 'bg-[oklch(0.55_0.32_295_/_0.16)]  text-[#8830B7]'
                            : 'bg-[#FFDC69] text-[#7E6D37]'
                        }`}
                          >
                            {resource.type === 'article' ? 'Article' : 'Video'}
                          </span>
                          <a
                            href={resource.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="hover:underline hover:font-bold flex-1"
                          >
                            {resource.title}
                          </a>
                        </div>
                      ),
                    )}
                  </div>
                </>
              )}
          </div>
        ) : (
          // Edit Mode: Expandable sections
          <>
            {/* Description Area - Scrollable if needed */}
            <div
              className={cn(
                'flex-shrink-0 -mx-1 px-1 transition-all duration-300',
                isResourcesExpanded ? 'max-h-[20vh]' : 'flex-1 min-h-0',
              )}
            >
              <textarea
                value={editDescription}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => {
                  setEditDescription(e.target.value);
                }}
                className={cn(
                  'pb-4 text-black w-full p-4 border rounded-none resize-none',
                  isResourcesExpanded
                    ? 'h-full min-h-[20vh]'
                    : 'h-full min-h-[300px]',
                )}
                placeholder="Node description"
              />
            </div>

            {/* Resources Section - Expandable */}
            <div
              className={cn(
                'flex flex-col mt-4 transition-all duration-300',
                isResourcesExpanded
                  ? 'flex-1 min-h-0'
                  : 'flex-shrink-0 max-h-[60px]',
              )}
            >
              {/* Clickable Header */}
              <Button
                variant="ghost"
                onClick={() => {
                  setIsResourcesExpanded(!isResourcesExpanded);
                }}
                className="flex items-center justify-between w-full leading-relaxed text-left text-base mb-4 flex-shrink-0 font-bold hover:text-gray-700 transition-colors h-auto p-0"
              >
                <span>Resources</span>
                {isResourcesExpanded ? (
                  <ChevronUp className="w-5 h-5" />
                ) : (
                  <ChevronDown className="w-5 h-5" />
                )}
              </Button>

              {/* Resources Content - Scrollable when expanded */}
              {isResourcesExpanded && (
                <div className="flex-1 overflow-y-auto min-h-0 -mx-1 px-1">
                  <div className="space-y-3">
                    {editResources.map((resource, index) => (
                      <div
                        key={index}
                        className="flex flex-col gap-3 p-1 border rounded-lg"
                      >
                        <div className="flex items-center gap-1">
                          <select
                            value={resource.type}
                            onChange={(
                              e: React.ChangeEvent<HTMLSelectElement>,
                            ) => {
                              handleResourceChange(
                                index,
                                'type',
                                e.target.value,
                              );
                            }}
                            className="px-2 py-2 rounded text-xs font-medium border"
                          >
                            <option value="article">Article</option>
                            <option value="video">Video</option>
                          </select>
                          <Button
                            onClick={() => {
                              handleRemoveResource(index);
                            }}
                            variant="ghost-danger"
                            size="sm"
                            className="ml-auto"
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        </div>
                        <Input
                          value={resource.title}
                          onChange={(
                            e: React.ChangeEvent<HTMLInputElement>,
                          ) => {
                            handleResourceChange(
                              index,
                              'title',
                              e.target.value,
                            );
                          }}
                          placeholder="Resource title"
                          className="w-full"
                        />
                        <Input
                          value={resource.url}
                          onChange={(
                            e: React.ChangeEvent<HTMLInputElement>,
                          ) => {
                            handleResourceChange(index, 'url', e.target.value);
                          }}
                          placeholder="Resource URL"
                          className="w-full"
                        />
                      </div>
                    ))}
                    <Button
                      onClick={handleAddResource}
                      variant="outline"
                      className="w-full"
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Add Resource
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </>
        )}

        {/* Fixed Footer */}
        <DialogFooter className="flex-col sm:flex-row gap-2 -mx-6 -mb-6 flex-shrink-0 pt-4">
          {isViewMode ? (
            // View mode: Only show completion toggle for learning progress tracking
            <div className="flex gap-2 w-full justify-end">
              <Button
                onClick={handleToggleComplete}
                className={
                  isCompleted
                    ? 'bg-green-600 hover:bg-green-700 text-white'
                    : 'bg-black hover:bg-gray-800 text-white'
                }
              >
                {isCompleted ? '✓ Completed' : 'Mark Complete'}
              </Button>
            </div>
          ) : (
            // Edit mode: Always show editing controls
            <div className="flex gap-2 w-full justify-end">
              <Button
                onClick={handleDelete}
                variant="ghost-danger"
              >
                Delete
              </Button>
              <Button onClick={handleCancelEdit} variant="outline">
                Cancel
              </Button>
              <Button
                onClick={handleSaveEdit}
                className="bg-black hover:bg-topic-hover"
              >
                Save Changes
              </Button>
            </div>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
