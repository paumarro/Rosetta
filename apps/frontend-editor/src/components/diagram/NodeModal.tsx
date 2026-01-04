import { useEffect, useState, useMemo, useRef } from 'react';
import { Button } from '@/components/ui/Button';
import { Plus, X, ChevronDown, ChevronUp } from 'lucide-react';
import { useCollaborativeStore } from '@/store/collaborationStore';
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
import { getNodeCompletion, setNodeCompletion } from '@/utils/storage';

interface Resource {
  type: 'article' | 'video';
  title: string;
  url: string;
}

/** Modal dialog for viewing and editing node details with view mode (read-only + completion) and edit mode */
export function NodeModal(): React.ReactElement | null {
  // Get modal state from store
  const {
    modalNodeId,
    closeNodeModal,
    nodes,
    deleteNode,
    updateNodeData,
    isViewMode,
    learningPathId,
  } = useCollaborativeStore();

  // Local UI state
  const [isCompleted, setIsCompleted] = useState(false);
  const [isResourcesExpanded, setIsResourcesExpanded] = useState(false);

  // Form state for editing (local, not synced until save)
  const [editLabel, setEditLabel] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editResources, setEditResources] = useState<Resource[]>([]);

  // Track which node the form was initialized for (prevents re-init on Yjs updates)
  const initializedNodeIdRef = useRef<string | null>(null);
  // Capture original data to preserve fields like 'side' and 'parentId' when saving
  const originalNodeDataRef = useRef<Record<string, unknown> | null>(null);

  // Derive modal data from store
  const modalNode = useMemo(() => {
    if (!modalNodeId) return null;
    return nodes.find((n) => n.id === modalNodeId) || null;
  }, [modalNodeId, nodes]);

  const isOpen = modalNodeId !== null && modalNode !== null;

  // Initialize form state only once when modal opens for a new node
  useEffect(() => {
    if (modalNode && initializedNodeIdRef.current !== modalNode.id) {
      // Capture original data for use when saving
      originalNodeDataRef.current = { ...modalNode.data };

      const label = modalNode.data.label;
      const description = modalNode.data.description;
      const resources = modalNode.data.resources;

      setEditLabel(typeof label === 'string' ? label : '');
      setEditDescription(typeof description === 'string' ? description : '');
      setEditResources(Array.isArray(resources) ? resources : []);
      setIsResourcesExpanded(false);
      setIsCompleted(getNodeCompletion(learningPathId, modalNode.id));

      initializedNodeIdRef.current = modalNode.id;
    }
  }, [modalNode, learningPathId]);

  // Reset when modal closes
  useEffect(() => {
    if (!modalNodeId) {
      initializedNodeIdRef.current = null;
      originalNodeDataRef.current = null;
    }
  }, [modalNodeId]);

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      closeNodeModal();
    }
  };

  const handleToggleComplete = () => {
    if (modalNode) {
      const newCompletedState = !isCompleted;
      setNodeCompletion(learningPathId, modalNode.id, newCompletedState);
      setIsCompleted(newCompletedState);
    }
  };

  const handleDelete = () => {
    if (!modalNode) return;
    const label =
      typeof modalNode.data.label === 'string'
        ? modalNode.data.label
        : 'this node';
    if (window.confirm(`Are you sure you want to delete "${label}"?`)) {
      deleteNode(modalNode.id);
      closeNodeModal();
    }
  };

  const handleCancelEdit = () => {
    closeNodeModal();
  };

  const handleSaveEdit = () => {
    if (modalNode) {
      // Use captured original data as base to preserve fields like 'side', 'parentId'
      const baseData = originalNodeDataRef.current ?? modalNode.data;
      const updatedData = {
        ...baseData,
        label: editLabel,
        description: editDescription,
        resources: editResources,
      };
      updateNodeData(modalNode.id, updatedData);
      closeNodeModal();
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

  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent
        className={cn(
          'flex flex-col',
          'max-h-[90vh] sm:max-h-[85vh]',
          'sm:max-w-lg md:max-w-xl lg:max-w-5xl p-17',
          'overflow-hidden',
        )}
        onOpenAutoFocus={(e: Event) => {
          e.preventDefault();
        }}
      >
        {/* Fixed Header - Title only */}
        <DialogHeader className="flex-shrink-0 pb-4">
          <div className="flex flex-col gap-3">
            {isViewMode ? (
              <>
                <DialogTitle className="text-5xl font-bold">
                  {modalNode.data.label}
                </DialogTitle>
                <div className="h-px bg-gray-200 w-full mt-2"></div>
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
            {modalNode.data.description && (
              <DialogDescription className="leading-relaxed rounded-none text-left text-base pb-4 text-black whitespace-pre-line">
                {modalNode.data.description}
              </DialogDescription>
            )}

            {/* Resources */}
            {Array.isArray(modalNode.data.resources) &&
              modalNode.data.resources.length > 0 && (
                <>
                  <h3 className="leading-relaxed text-left text-base mb-4 mt-4 font-bold">
                    Resources
                  </h3>
                  <div className="space-y-1">
                    {modalNode.data.resources.map(
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
                placeholder={`${modalNode.data.label} description`}
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
              <Button onClick={handleDelete} variant="ghost-danger">
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
