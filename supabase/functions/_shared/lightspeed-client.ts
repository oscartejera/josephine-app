/**
 * Lightspeed API Client
 * Wrapper for Lightspeed Restaurant K-Series API
 * Base URL: https://api.lightspeedrestaurant.com
 */

export class LightspeedClient {
    private baseUrl: string;
    private accessToken: string;

    constructor(accessToken: string) {
        this.baseUrl = 'https://api.lightspeedrestaurant.com';
        this.accessToken = accessToken;
    }

    private async request(path: string, options: RequestInit = {}): Promise<any> {
        const url = `${this.baseUrl}${path}`;
        const response = await fetch(url, {
            ...options,
            headers: {
                'Authorization': `Bearer ${this.accessToken}`,
                'Content-Type': 'application/json',
                ...options.headers,
            },
        });

        if (!response.ok) {
            const errorBody = await response.text();
            throw new Error(`Lightspeed API error (${response.status}): ${errorBody}`);
        }

        return response.json();
    }

    /** Get sales data for a business location */
    async getSales(businessId: string, startDate: string, endDate: string, page = 1, pageSize = 100): Promise<any> {
        return this.request(
            `/financialV2/sales?businessId=${businessId}&startDate=${startDate}&endDate=${endDate}&details=staff,payments&page=${page}&pageSize=${pageSize}`
        );
    }

    /** Get catalog items (products) */
    async getItems(businessId: string, page = 1, pageSize = 100): Promise<any> {
        return this.request(
            `/richItem?businessId=${businessId}&page=${page}&pageSize=${pageSize}`
        );
    }

    /** Get employees/staff */
    async getStaff(businessId: string): Promise<any> {
        return this.request(`/staff-api/users?businessId=${businessId}`);
    }

    /** Get business locations */
    async getBusinesses(): Promise<any> {
        return this.request('/businesses');
    }

    /** Refresh access token using refresh token */
    static async refreshToken(
        clientId: string,
        clientSecret: string,
        refreshToken: string,
    ): Promise<{ access_token: string; refresh_token: string; expires_in: number }> {
        const response = await fetch('https://cloud.lightspeedapp.com/oauth/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                grant_type: 'refresh_token',
                client_id: clientId,
                client_secret: clientSecret,
                refresh_token: refreshToken,
            }),
        });

        if (!response.ok) {
            throw new Error(`Token refresh failed: ${response.status}`);
        }

        return response.json();
    }
}
