/**
 * POS Staff Seed Data
 * 5 perfiles de personal con fotos
 */

export interface StaffProfile {
  id: string;
  location_id: string;
  name: string;
  role: string;
  photo_url: string;
  is_active: boolean;
}

export function getStaffProfiles(locationId: string): StaffProfile[] {
  return [
    {
      id: `staff-${locationId}-1`,
      location_id: locationId,
      name: 'María García',
      role: 'Camarera',
      photo_url: 'https://api.dicebear.com/7.x/avataaars/svg?seed=maria&backgroundColor=b6e3f4',
      is_active: true,
    },
    {
      id: `staff-${locationId}-2`,
      location_id: locationId,
      name: 'Carlos López',
      role: 'Camarero',
      photo_url: 'https://api.dicebear.com/7.x/avataaars/svg?seed=carlos&backgroundColor=c0aede',
      is_active: true,
    },
    {
      id: `staff-${locationId}-3`,
      location_id: locationId,
      name: 'Ana Rodríguez',
      role: 'Camarera',
      photo_url: 'https://api.dicebear.com/7.x/avataaars/svg?seed=ana&backgroundColor=ffd5dc',
      is_active: true,
    },
    {
      id: `staff-${locationId}-4`,
      location_id: locationId,
      name: 'Pedro Sánchez',
      role: 'Camarero',
      photo_url: 'https://api.dicebear.com/7.x/avataaars/svg?seed=pedro&backgroundColor=d1d4f9',
      is_active: true,
    },
    {
      id: `staff-${locationId}-5`,
      location_id: locationId,
      name: 'Laura Martín',
      role: 'Camarera',
      photo_url: 'https://api.dicebear.com/7.x/avataaars/svg?seed=laura&backgroundColor=ffdfbf',
      is_active: true,
    },
  ];
}
