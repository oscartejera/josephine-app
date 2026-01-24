import { useParams } from 'react-router-dom';
import { useApp } from '@/contexts/AppContext';
import { ClockInPanel } from '@/components/staff/ClockInPanel';

export default function StaffClock() {
  const { locationId } = useParams<{ locationId: string }>();
  const { locations } = useApp();
  
  const location = locations.find(l => l.id === locationId);

  if (!locationId) {
    return (
      <div className="p-6 flex items-center justify-center h-[calc(100vh-3.5rem)]">
        <p className="text-muted-foreground">Selecciona un local</p>
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-6 max-w-md mx-auto">
      <div className="mb-6">
        <h1 className="text-xl font-semibold">Fichaje</h1>
        <p className="text-sm text-muted-foreground">
          Registra tu entrada y salida
        </p>
      </div>
      <ClockInPanel 
        locationId={locationId} 
        locationName={location?.name}
      />
    </div>
  );
}
