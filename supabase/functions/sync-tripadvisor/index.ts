/**
 * sync-tripadvisor — Supabase Edge Function
 *
 * Fetches reviews from TripAdvisor Content API and upserts them into the
 * `reviews` table. Can be triggered manually from Settings or via cron.
 *
 * Required secrets:
 *   TRIPADVISOR_API_KEY — TripAdvisor Content API key
 *
 * Request body:
 *   { location_name: string, location_id: string, tripadvisor_location_id?: string }
 *
 * Flow:
 *   1. If tripadvisor_location_id not provided, search TripAdvisor by name
 *   2. Fetch reviews for that location
 *   3. Upsert into reviews table
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers":
        "authorization, x-client-info, apikey, content-type",
};

const TRIPADVISOR_BASE = "https://api.content.tripadvisor.com/api/v1";

interface SyncRequest {
    location_name: string;       // Restaurant name to search
    location_id: string;         // Our internal Supabase location_id
    org_id: string;              // Organization ID
    tripadvisor_location_id?: string; // If already known
}

serve(async (req) => {
    if (req.method === "OPTIONS") {
        return new Response(null, { headers: corsHeaders });
    }

    try {
        const TRIPADVISOR_API_KEY = Deno.env.get("TRIPADVISOR_API_KEY");
        if (!TRIPADVISOR_API_KEY) {
            throw new Error("TRIPADVISOR_API_KEY not configured");
        }

        const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
        const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
        const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

        const body = (await req.json()) as SyncRequest;
        const { location_name, location_id, org_id } = body;
        let ta_location_id = body.tripadvisor_location_id;

        // ── Step 1: Search TripAdvisor if we don't have location ID ─────────
        if (!ta_location_id) {
            const searchUrl = `${TRIPADVISOR_BASE}/location/search?key=${TRIPADVISOR_API_KEY}&searchQuery=${encodeURIComponent(location_name)}&language=es&category=restaurants`;
            const searchResp = await fetch(searchUrl);

            if (!searchResp.ok) {
                const err = await searchResp.text();
                throw new Error(`TripAdvisor search failed (${searchResp.status}): ${err}`);
            }

            const searchData = await searchResp.json();
            const locations = searchData.data || [];

            if (locations.length === 0) {
                return new Response(
                    JSON.stringify({
                        success: false,
                        error: `No TripAdvisor location found for "${location_name}"`,
                        suggestion: "Verify the restaurant name matches its TripAdvisor listing",
                    }),
                    { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
                );
            }

            // Take the first match
            ta_location_id = locations[0].location_id;
            console.log(`[sync-tripadvisor] Found TripAdvisor location: ${ta_location_id} for "${location_name}"`);
        }

        // ── Step 2: Fetch reviews ───────────────────────────────────────────
        const reviewsUrl = `${TRIPADVISOR_BASE}/location/${ta_location_id}/reviews?key=${TRIPADVISOR_API_KEY}&language=es`;
        const reviewsResp = await fetch(reviewsUrl);

        if (!reviewsResp.ok) {
            const err = await reviewsResp.text();
            throw new Error(`TripAdvisor reviews fetch failed (${reviewsResp.status}): ${err}`);
        }

        const reviewsData = await reviewsResp.json();
        const taReviews = reviewsData.data || [];

        if (taReviews.length === 0) {
            return new Response(
                JSON.stringify({
                    success: true,
                    synced: 0,
                    tripadvisor_location_id: ta_location_id,
                    message: "No reviews found on TripAdvisor for this location",
                }),
                { headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        // ── Step 3: Map to our reviews table schema and upsert ──────────────
        const mapped = taReviews.map((r: any) => ({
            // Use TripAdvisor review ID as stable external ID for deduplication
            id: `ta-${r.id}`,
            org_id,
            location_id,
            platform: "TripAdvisor",
            author_name: r.user?.username || "Anonymous",
            rating: r.rating || 3,
            review_date: r.published_date || new Date().toISOString(),
            review_text: r.text || r.title || "",
            tripadvisor_review_id: String(r.id),
            // Don't overwrite existing responses
        }));

        // Upsert using the custom ID (ta-{tripadvisor_review_id})
        const { data: upserted, error: upsertError } = await supabase
            .from("reviews")
            .upsert(mapped, {
                onConflict: "id",
                ignoreDuplicates: false,
            })
            .select("id");

        if (upsertError) {
            console.error("[sync-tripadvisor] Upsert error:", upsertError);
            throw new Error(`DB upsert failed: ${upsertError.message}`);
        }

        // ── Step 4: Also fetch location details for metadata ────────────────
        let locationDetails: any = null;
        try {
            const detailsUrl = `${TRIPADVISOR_BASE}/location/${ta_location_id}/details?key=${TRIPADVISOR_API_KEY}&language=es`;
            const detailsResp = await fetch(detailsUrl);
            if (detailsResp.ok) {
                locationDetails = await detailsResp.json();
            }
        } catch {
            // Non-critical, continue
        }

        return new Response(
            JSON.stringify({
                success: true,
                synced: upserted?.length || mapped.length,
                tripadvisor_location_id: ta_location_id,
                location_details: locationDetails
                    ? {
                        name: locationDetails.name,
                        rating: locationDetails.rating,
                        num_reviews: locationDetails.num_reviews,
                        ranking_string: locationDetails.ranking_data?.ranking_string,
                        web_url: locationDetails.web_url,
                    }
                    : null,
            }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    } catch (error) {
        console.error("[sync-tripadvisor] Error:", error);
        return new Response(
            JSON.stringify({
                success: false,
                error: error instanceof Error ? error.message : "Unknown error",
            }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }
});
