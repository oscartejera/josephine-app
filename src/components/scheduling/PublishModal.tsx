import { useState } from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface PublishModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (emailBody: string) => Promise<void>;
  locationName: string;
}

export function PublishModal({ isOpen, onClose, onConfirm, locationName }: PublishModalProps) {
  const [emailBody, setEmailBody] = useState('');
  const [isPublishing, setIsPublishing] = useState(false);
  
  const handleConfirm = async () => {
    setIsPublishing(true);
    try {
      await onConfirm(emailBody);
      onClose();
    } finally {
      setIsPublishing(false);
    }
  };
  
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle>Publish schedule</DialogTitle>
          </div>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <p className="text-sm text-muted-foreground">
            This schedule will be sent to all employees in <strong>{locationName}</strong>.
          </p>
          
          <div className="space-y-2">
            <Label htmlFor="email-body">Email Body (optional)</Label>
            <Textarea
              id="email-body"
              placeholder="Add a message to include with the schedule notification..."
              value={emailBody}
              onChange={(e) => setEmailBody(e.target.value)}
              rows={4}
            />
          </div>
        </div>
        
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose} disabled={isPublishing}>
            Cancel
          </Button>
          <Button 
            onClick={handleConfirm} 
            disabled={isPublishing}
            className="bg-primary hover:bg-primary/90"
          >
            {isPublishing ? (
              <>
                <span className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
                Publishing...
              </>
            ) : (
              'Confirm'
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
