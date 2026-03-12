/**
 * sync-google-reviews — Supabase Edge Function
 *
 * Fetches reviews from Google Business Profile API using stored OAuth tokens.
 * Upserts them into the `reviews` table.
 *
 * Flow:
 *   1. Load access_token from integration_tokens
 *   2. If expired, refresh using refresh_token
 *   3. List accounts → locations → reviews
 *   4. Upsert into reviews table
 *
 * Request body:
 *   { org_id: string, location_id: string }
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers":
        "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const GOOGLE_CLIENT_ID = Deno.env.get("GOOGLE_CLIENT_ID")!;
const GOOGLE_CLIENT_SECRET = Deno.env.get("GOOGLE_CLIENT_SECRET")!;

serve(async (req) => {
    if (req.method === "OPTIONS") {
        return new Response(null, { headers: corsHeaders });
    }

    try {
        const { org_id, location_id } = await req.json();
        const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

        // ── Step 1: Load tokens ─────────────────────────────────────────────
        const { data: tokenRow, error: tokenError } = await supabase
            .from("integration_tokens")
            .select("*")
            .eq("org_id", org_id)
            .eq("provider", "google_business")
            .single();

        if (tokenError || !tokenRow) {
            return new Response(
                JSON.stringify({
                    success: false,
                    error: "Google Business not connected. Go to Settings → Integrations to connect.",
                    needs_auth: true,
                }),
                { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        let accessToken = tokenRow.access_token;

        // ── Step 2: Refresh if expired ──────────────────────────────────────
        if (tokenRow.expires_at && new Date(tokenRow.expires_at) < new Date()) {
            if (!tokenRow.refresh_token) {
                return new Response(
                    JSON.stringify({ success: false, error: "Token expired, no refresh token. Re-authorize." }),
                    { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
                );
            }

            const refreshResp = await fetch("https://oauth2.googleapis.com/token", {
                method: "POST",
                headers: { "Content-Type": "application/x-www-form-urlencoded" },
                body: new URLSearchParams({
                    client_id: GOOGLE_CLIENT_ID,
                    client_secret: GOOGLE_CLIENT_SECRET,
                    refresh_token: tokenRow.refresh_token,
                    grant_type: "refresh_token",
                }),
            });

            if (!refreshResp.ok) {
                return new Response(
                    JSON.stringify({ success: false, error: "Token refresh failed. Re-authorize." }),
                    { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
                );
            }

            const newTokens = await refreshResp.json();
            accessToken = newTokens.access_token;

            // Save updated token
            await supabase
                .from("integration_tokens")
                .update({
                    access_token: accessToken,
                    expires_at: new Date(Date.now() + (newTokens.expires_in || 3600) * 1000).toISOString(),
                    updated_at: new Date().toISOString(),
                })
                .eq("org_id", org_id)
                .eq("provider", "google_business");
        }

        // ── Step 3: List Google Business accounts ───────────────────────────
        const accountsResp = await fetch(
            "https://mybusinessaccountmanagement.googleapis.com/v1/accounts",
            { headers: { Authorization: `Bearer ${accessToken}` } }
        );

        if (!accountsResp.ok) {
            const err = await accountsResp.text();
            throw new Error(`Failed to list accounts: ${err}`);
        }

        const accountsData = await accountsResp.json();
        const accounts = accountsData.accounts || [];

        if (accounts.length === 0) {
            return new Response(
                JSON.stringify({ success: false, error: "No Google Business accounts found" }),
                { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        // ── Step 4: Fetch reviews for each account/location ─────────────────
        let totalSynced = 0;
        const allReviews: any[] = [];

        for (const account of accounts) {
            const accountName = account.name; // "accounts/123456"

            // List locations
            const locResp = await fetch(
                `https://mybusinessbusinessinformation.googleapis.com/v1/${accountName}/locations?readMask=name,title`,
                { headers: { Authorization: `Bearer ${accessToken}` } }
            );

            if (!locResp.ok) continue;

            const locData = await locResp.json();
            const locations = locData.locations || [];

            for (const loc of locations) {
                const locationName = loc.name; // "locations/789"

                // Fetch reviews
                const reviewsResp = await fetch(
                    `https://mybusiness.googleapis.com/v4/${accountName}/${locationName}/reviews`,
                    { headers: { Authorization: `Bearer ${accessToken}` } }
                );

                if (!reviewsResp.ok) continue;

                const reviewsData = await reviewsResp.json();
                const reviews = reviewsData.reviews || [];

                for (const r of reviews) {
                    allReviews.push({
                        id: `google-${r.reviewId}`,
                        org_id,
                        location_id,
                        platform: "Google",
                        author_name: r.reviewer?.displayName || "Anonymous",
                        rating: starRatingToNumber(r.starRating),
                        review_date: r.createTime || new Date().toISOString(),
                        review_text: r.comment || "",
                        google_review_id: r.reviewId,
                    });
                }
            }
        }

        // ── Step 5: Upsert reviews ──────────────────────────────────────────
        if (allReviews.length > 0) {
            const { error: upsertError } = await supabase
                .from("reviews")
                .upsert(allReviews, { onConflict: "id", ignoreDuplicates: false });

            if (upsertError) {
                console.error("[sync-google] Upsert error:", upsertError);
                throw new Error(`DB upsert failed: ${upsertError.message}`);
            }
            totalSynced = allReviews.length;
        }

        return new Response(
            JSON.stringify({
                success: true,
                synced: totalSynced,
                accounts_found: accounts.length,
            }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    } catch (error) {
        console.error("[sync-google-reviews] Error:", error);
        return new Response(
            JSON.stringify({
                success: false,
                error: error instanceof Error ? error.message : "Unknown error",
            }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }
});

function starRatingToNumber(rating: string): number {
    const map: Record<string, number> = {
        ONE: 1,
        TWO: 2,
        THREE: 3,
        FOUR: 4,
        FIVE: 5,
    };
    return map[rating] || 3;
}
