/**
 * Square API Client
 * Helper para interactuar con Square API v2
 */

export interface SquareConfig {
  accessToken: string;
  environment: 'sandbox' | 'production';
}

export class SquareClient {
  private baseUrl: string;
  private accessToken: string;

  constructor(config: SquareConfig) {
    this.accessToken = config.accessToken;
    this.baseUrl = config.environment === 'production'
      ? 'https://connect.squareup.com/v2'
      : 'https://connect.squareupsandbox.com/v2';
  }

  private async request(endpoint: string, options: RequestInit = {}, retries = 3): Promise<any> {
    for (let attempt = 0; attempt <= retries; attempt++) {
      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        ...options,
        headers: {
          'Square-Version': '2025-01-23',
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json',
          ...options.headers,
        },
      });

      // Handle rate limiting with exponential backoff (Fix #7)
      if (response.status === 429 && attempt < retries) {
        const retryAfter = response.headers.get('retry-after');
        const waitMs = retryAfter ? parseInt(retryAfter, 10) * 1000 : Math.pow(2, attempt + 1) * 1000;
        console.warn(`[SquareClient] Rate limited, retrying in ${waitMs}ms (attempt ${attempt + 1}/${retries})`);
        await new Promise(resolve => setTimeout(resolve, waitMs));
        continue;
      }

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Square API error (${response.status}): ${error}`);
      }

      return response.json();
    }

    throw new Error('Square API: max retries exceeded after rate limiting');
  }

  // ===== LOCATIONS =====
  async listLocations() {
    return this.request('/locations');
  }

  // ===== CATALOG =====
  async listCatalog(cursor?: string) {
    const params = new URLSearchParams({ types: 'ITEM,CATEGORY' });
    if (cursor) params.append('cursor', cursor);
    
    return this.request(`/catalog/list?${params}`);
  }

  // ===== ORDERS =====
  async searchOrders(locationIds: string[], cursor?: string, beginTime?: string) {
    const body: any = {
      location_ids: locationIds,
      limit: 100,
      query: {
        sort: { sort_field: 'CREATED_AT', sort_order: 'ASC' },
      },
    };

    if (beginTime) {
      body.query.filter = {
        date_time_filter: {
          created_at: { start_at: beginTime },
        },
      };
    }

    if (cursor) {
      body.cursor = cursor;
    }

    return this.request('/orders/search', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }

  async retrieveOrder(orderId: string) {
    return this.request(`/orders/${orderId}`);
  }

  // ===== PAYMENTS =====
  async listPayments(locationId: string, beginTime?: string, cursor?: string) {
    const params = new URLSearchParams({ location_id: locationId, limit: '100' });
    if (beginTime) params.append('begin_time', beginTime);
    if (cursor) params.append('cursor', cursor);
    
    return this.request(`/payments?${params}`);
  }
}
