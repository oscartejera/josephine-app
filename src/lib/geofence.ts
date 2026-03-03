/**
 * Geofence utility — Haversine distance + validation
 */

/**
 * Calculate distance in meters between two lat/lng points using Haversine formula
 */
export function haversineDistance(
    lat1: number, lng1: number,
    lat2: number, lng2: number
): number {
    const R = 6371000; // Earth radius in meters
    const toRad = (deg: number) => (deg * Math.PI) / 180;

    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
        Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

/**
 * Validate if a point is within geofence radius
 * Returns { valid, distance, maxRadius }
 */
export function validateGeofence(
    employeeLat: number, employeeLng: number,
    locationLat: number | null, locationLng: number | null,
    radiusM: number = 200
): { valid: boolean; distance: number | null; maxRadius: number } {
    if (locationLat == null || locationLng == null) {
        // No geofence configured — allow
        return { valid: true, distance: null, maxRadius: radiusM };
    }

    const distance = haversineDistance(employeeLat, employeeLng, locationLat, locationLng);
    return {
        valid: distance <= radiusM,
        distance: Math.round(distance),
        maxRadius: radiusM,
    };
}

/**
 * Format distance for display
 */
export function formatDistance(meters: number): string {
    if (meters < 1000) return `${meters}m`;
    return `${(meters / 1000).toFixed(1)}km`;
}
