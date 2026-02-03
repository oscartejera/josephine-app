/**
 * POS Staff Login
 * Pantalla inicial para seleccionar camarero
 */

import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { ChefHat, User } from 'lucide-react';
import { FaceUnlockModal } from '@/components/pos/FaceUnlockModal';
import { POSSession } from '@/lib/pos/session';

interface StaffProfile {
  id: string;
  name: string;
  role: string;
  photo_url: string | null;
}

export default function POSStaffLogin() {
  const { locationId } = useParams<{ locationId: string }>();
  const navigate = useNavigate();
  const [staff, setStaff] = useState<StaffProfile[]>([]);
  const [selectedStaff, setSelectedStaff] = useState<StaffProfile | null>(null);
  const [showUnlock, setShowUnlock] = useState(false);

  useEffect(() => {
    loadStaff();
  }, [locationId]);

  const loadStaff = async () => {
    if (!locationId) return;

    // Try Supabase first
    const { data, error } = await supabase
      .from('pos_staff_profiles')
      .select('*')
      .eq('location_id', locationId)
      .eq('is_active', true)
      .order('name');

    if (error || !data || data.length === 0) {
      // Fallback to InMemory seed
      console.log('[POS] Using InMemory staff seed');
      const { getStaffProfiles } = await import('@/data/pos-staff-seed');
      setStaff(getStaffProfiles(locationId) as any);
      return;
    }

    setStaff((data || []) as StaffProfile[]);
  };

  const handleStaffClick = (staffMember: StaffProfile) => {
    setSelectedStaff(staffMember);
    setShowUnlock(true);
  };

  const handleUnlockSuccess = () => {
    if (!selectedStaff || !locationId) return;

    // Create session
    POSSession.start({
      staff_id: selectedStaff.id,
      staff_name: selectedStaff.name,
      staff_photo_url: selectedStaff.photo_url,
      location_id: locationId,
      started_at: new Date().toISOString(),
    });

    // Navigate to floor map
    navigate(`/pos/${locationId}/floor`);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 to-primary/10 flex items-center justify-center p-8">
      <div className="w-full max-w-4xl">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-primary rounded-full mb-4">
            <ChefHat className="h-10 w-10 text-primary-foreground" />
          </div>
          <h1 className="text-4xl font-display font-bold mb-2">Josephine POS</h1>
          <p className="text-xl text-muted-foreground">Selecciona tu perfil para continuar</p>
        </div>

        {/* Staff Grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-6">
          {staff.map((member) => (
            <Card
              key={member.id}
              className="cursor-pointer hover:shadow-lg hover:scale-105 transition-all duration-200"
              onClick={() => handleStaffClick(member)}
            >
              <CardContent className="p-6 text-center">
                <Avatar className="w-24 h-24 mx-auto mb-4">
                  <AvatarImage src={member.photo_url || undefined} alt={member.name} />
                  <AvatarFallback className="text-2xl bg-primary/10">
                    <User className="h-12 w-12" />
                  </AvatarFallback>
                </Avatar>
                <h3 className="font-semibold text-lg mb-1">{member.name}</h3>
                <p className="text-sm text-muted-foreground">{member.role}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {staff.length === 0 && (
          <Card>
            <CardContent className="p-12 text-center text-muted-foreground">
              <User className="h-16 w-16 mx-auto mb-4 opacity-50" />
              <p>No hay personal configurado para esta ubicación</p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Face Unlock */}
      {selectedStaff && (
        <FaceUnlockModal
          open={showUnlock}
          staffName={selectedStaff.name}
          onSuccess={handleUnlockSuccess}
          onCancel={() => {
            setShowUnlock(false);
            setSelectedStaff(null);
          }}
        />
      )}
    </div>
  );
}
