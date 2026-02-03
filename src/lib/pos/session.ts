/**
 * POS Session Management
 * Maneja sesión de staff en localStorage
 */

export interface POSStaffSession {
  staff_id: string;
  staff_name: string;
  staff_photo_url: string | null;
  location_id: string;
  started_at: string;
}

const SESSION_KEY = 'pos_staff_session';

export const POSSession = {
  start(session: POSStaffSession): void {
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  },

  get(): POSStaffSession | null {
    const data = localStorage.getItem(SESSION_KEY);
    if (!data) return null;
    
    try {
      return JSON.parse(data);
    } catch {
      return null;
    }
  },

  end(): void {
    localStorage.removeItem(SESSION_KEY);
  },

  isActive(): boolean {
    return !!this.get();
  },

  requiresLocation(locationId: string): boolean {
    const session = this.get();
    return session?.location_id !== locationId;
  },
};
