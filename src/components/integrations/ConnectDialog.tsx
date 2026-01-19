import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Loader2, Info } from 'lucide-react';
import { ProviderInfo } from './IntegrationCard';

interface ConnectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  provider: ProviderInfo | null;
  locations: { id: string; name: string }[];
  onConnect: (data: {
    providerId: string;
    locationId: string;
    authType: string;
    schedule: string;
  }) => Promise<void>;
}

export function ConnectDialog({
  open,
  onOpenChange,
  provider,
  locations,
  onConnect,
}: ConnectDialogProps) {
  const [selectedLocation, setSelectedLocation] = useState('');
  const [authType, setAuthType] = useState('api_key');
  const [schedule, setSchedule] = useState('1hour');
  const [loading, setLoading] = useState(false);

  const handleConnect = async () => {
    if (!provider || !selectedLocation) return;
    
    setLoading(true);
    try {
      await onConnect({
        providerId: provider.id,
        locationId: selectedLocation,
        authType,
        schedule,
      });
      onOpenChange(false);
      setSelectedLocation('');
      setAuthType('api_key');
      setSchedule('1hour');
    } finally {
      setLoading(false);
    }
  };

  if (!provider) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="text-2xl">{provider.logo}</span>
            Connect {provider.name}
          </DialogTitle>
          <DialogDescription>
            Configure la conexión con {provider.name} para sincronizar tickets automáticamente.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 pt-2">
          <div className="space-y-2">
            <Label>Local</Label>
            <Select value={selectedLocation} onValueChange={setSelectedLocation}>
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar local" />
              </SelectTrigger>
              <SelectContent>
                {locations.map(loc => (
                  <SelectItem key={loc.id} value={loc.id}>{loc.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <div className="space-y-2">
            <Label>Tipo de autenticación</Label>
            <RadioGroup value={authType} onValueChange={setAuthType}>
              {provider.authTypes.includes('api_key') && (
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="api_key" id="api_key" />
                  <Label htmlFor="api_key" className="font-normal">API Key</Label>
                </div>
              )}
              {provider.authTypes.includes('oauth') && (
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="oauth" id="oauth" />
                  <Label htmlFor="oauth" className="font-normal">OAuth 2.0</Label>
                </div>
              )}
              {provider.authTypes.includes('username_password') && (
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="username_password" id="username_password" />
                  <Label htmlFor="username_password" className="font-normal">Usuario/Contraseña</Label>
                </div>
              )}
            </RadioGroup>
          </div>
          
          <div className="space-y-2">
            <Label>Frecuencia de sincronización</Label>
            <Select value={schedule} onValueChange={setSchedule}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="15min">Cada 15 minutos</SelectItem>
                <SelectItem value="1hour">Cada hora</SelectItem>
                <SelectItem value="daily">Diario</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div className="flex items-start gap-2 p-3 bg-muted/50 rounded-lg">
            <Info className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
            <p className="text-xs text-muted-foreground">
              Las credenciales de API se configuran de forma segura. Una vez conectado, 
              se generarán datos de demo hasta que configure las credenciales reales en Settings &gt; Secrets.
            </p>
          </div>
          
          <Button 
            onClick={handleConnect} 
            disabled={!selectedLocation || loading}
            className="w-full"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Conectando...
              </>
            ) : (
              'Conectar'
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
