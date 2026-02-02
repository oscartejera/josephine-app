/**
 * Token Service  
 * Gestiona tokens QR seguros con expiración
 */

import type { ScanPayDataLayer } from './in-memory-repository';
import type { QRCodeData } from '@/types/scanpay';

export class TokenService {
  constructor(private dataLayer: ScanPayDataLayer) {}

  async generateQRForBill(billId: string, expiryHours: number = 24): Promise<QRCodeData> {
    const bill = await this.dataLayer.bills.findById(billId);
    if (!bill) {
      throw new Error('Bill not found');
    }

    const scanToken = await this.dataLayer.tokens.create(billId, expiryHours);

    // Generate URL (en producción sería el dominio real)
    const baseUrl = typeof window !== 'undefined' 
      ? window.location.origin 
      : 'https://app.josephine.com';

    const url = `${baseUrl}/scan-pay/${scanToken.token}`;

    return {
      url,
      token: scanToken.token,
      expires_at: scanToken.expires_at,
    };
  }

  async validateToken(token: string): Promise<{
    valid: boolean;
    reason?: string;
    bill_id?: string;
  }> {
    const scanToken = await this.dataLayer.tokens.findByToken(token);

    if (!scanToken) {
      return { valid: false, reason: 'Token no encontrado' };
    }

    if (!scanToken.is_active) {
      return { valid: false, reason: 'Token inactivo' };
    }

    if (new Date(scanToken.expires_at) < new Date()) {
      return { valid: false, reason: 'Token expirado' };
    }

    return {
      valid: true,
      bill_id: scanToken.bill_id,
    };
  }
}
