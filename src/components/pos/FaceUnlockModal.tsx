/**
 * Face Unlock Modal (Mock)
 * Simula desbloqueo facial sin reconocimiento real
 */

import { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Camera, Scan } from 'lucide-react';

interface FaceUnlockModalProps {
  open: boolean;
  staffName: string;
  onSuccess: () => void;
  onCancel: () => void;
}

export function FaceUnlockModal({
  open,
  staffName,
  onSuccess,
  onCancel,
}: FaceUnlockModalProps) {
  const [scanning, setScanning] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    if (open && !cameraReady) {
      initCamera();
    }

    return () => {
      stopCamera();
    };
  }, [open]);

  const initCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'user' } 
      });
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        streamRef.current = stream;
        setCameraReady(true);
      }
    } catch (error) {
      console.error('Camera error:', error);
      // Mock mode: continue without camera
      setCameraReady(true);
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
  };

  const handleScan = () => {
    setScanning(true);

    // Mock: auto-success after 1.5s
    setTimeout(() => {
      setScanning(false);
      stopCamera();
      onSuccess();
    }, 1500);
  };

  return (
    <Dialog open={open} onOpenChange={(open) => !open && onCancel()}>
      <DialogContent className="sm:max-w-md">
        <div className="space-y-4">
          <div className="text-center">
            <Camera className="h-16 w-16 mx-auto mb-4 text-primary" />
            <h2 className="text-2xl font-bold mb-2">Desbloqueo Facial</h2>
            <p className="text-muted-foreground">
              Verificando identidad de <strong>{staffName}</strong>
            </p>
          </div>

          {/* Camera Preview */}
          <div className="relative aspect-video bg-zinc-900 rounded-lg overflow-hidden">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover"
            />
            
            {scanning && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                <div className="text-center">
                  <Scan className="h-12 w-12 text-primary animate-pulse mx-auto mb-2" />
                  <p className="text-white font-medium">Escaneando...</p>
                </div>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={onCancel}
              className="flex-1"
              disabled={scanning}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleScan}
              className="flex-1"
              disabled={scanning || !cameraReady}
            >
              {scanning ? 'Escaneando...' : 'Continuar'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
