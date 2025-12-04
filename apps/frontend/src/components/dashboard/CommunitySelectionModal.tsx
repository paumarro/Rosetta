import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useUserStore } from '@/store/userStore';

interface CommunitySelectionModalProps {
  open: boolean;
  communities: string[];
}

export default function CommunitySelectionModal({
  open,
  communities,
}: CommunitySelectionModalProps) {
  const [selectedCommunity, setSelectedCommunity] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { setCommunity } = useUserStore();

  const handleSubmit = async () => {
    if (!selectedCommunity) return;

    setIsSubmitting(true);
    try {
      await setCommunity(selectedCommunity);
    } catch (error) {
      console.error('Failed to set community:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent className="sm:max-w-md"  onInteractOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle className="text-2xl">Welcome to Rosetta</DialogTitle>
          <DialogDescription className="text-base pt-2">
            Please select your community to get started. You'll be able to view
            and create learning paths for your community.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3 py-4">
          {communities.map((community) => (
            <button
              key={community}
              onClick={() => setSelectedCommunity(community)}
              className={`p-4 text-left border-2 rounded-lg transition-all hover:border-primary ${
                selectedCommunity === community
                  ? 'border-primary bg-primary/5'
                  : 'border-gray-200'
              }`}
            >
              <span className="font-medium text-lg">{community}</span>
            </button>
          ))}
        </div>

        <div className="flex justify-end">
          <Button
            onClick={handleSubmit}
            disabled={!selectedCommunity || isSubmitting}
            className="w-full sm:w-auto"
          >
            {isSubmitting ? 'Setting Community...' : 'Continue'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
