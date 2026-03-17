import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { CheckCircle, Send } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface PublishModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (emailBody: string) => {t('scheduling.PublishModal.promise')}<void>;
  locationName: string;
  mode?: 'approve' | 'publish';
}

export function PublishModal({ isOpen, onClose, onConfirm, locationName, mode = 'publish' }: PublishModalProps) {
  const { t } = useTranslation();
  const [emailBody, setEmailBody] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  const isApprove = mode === 'approve';

  const handleConfirm = async () => {
    setIsProcessing(true);
    try {
      await onConfirm(emailBody);
      onClose();
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2">
              {isApprove ? (
                <>
                  <CheckCircle className="h-5 w-5 text-amber-500" />
                  {t('scheduling.PublishModal.aprobarHorario')}
                </>
              ) : (
                <>
                  <Send className="h-5 w-5 text-primary" />
                  {t('scheduling.PublishModal.publicarHorario')}
                </>
              )}
            </DialogTitle>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <p className="text-sm text-muted-foreground">
            {isApprove ? (
              <>
                {t('scheduling.PublishModal.aprobarLosTurnosDe')} <strong>{locationName}</strong>{t('scheduling.PublishModal.unaVezAprobadosLosManagers')}
              </>
            ) : (
              <>
                {t('scheduling.PublishModal.losTurnosDe')} <strong>{locationName}</strong> {t('scheduling.PublishModal.seranEnviadosATodosLos')}
              </>
            )}
          </p>

          {!isApprove && (
            <div className="space-y-2">
              <Label htmlFor="email-body">{t('scheduling.PublishModal.mensajeOpcional')}</Label>
              <Textarea
                id="email-body"
                placeholder={t('scheduling.anadeUnMensajeConLa')}
                value={emailBody}
                onChange={(e) => setEmailBody(e.target.value)}
                rows={4}
              />
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose} disabled={isProcessing}>
            {t('scheduling.PublishModal.cancelar')}
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={isProcessing}
            className={isApprove
              ? "bg-amber-500 hover:bg-amber-600 text-white"
              : "bg-primary hover:bg-primary/90"
            }
          >
            {isProcessing ? (
              <>
                <span className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
                {isApprove ? 'Aprobando...' : 'Publicando...'}
              </>
            ) : (
              isApprove ? 'Aprobar' : 'Publicar'
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
