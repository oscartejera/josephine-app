/**
 * Vercel Cron — Refresh Materialized Views
 *
 * Calls the Supabase Edge Function `refresh_marts` every 15 minutes.
 * Auth: Vercel Cron sends `Authorization: Bearer <CRON_SECRET>`.
 *
 * Required Vercel env vars:
 *   CRON_SECRET
 *   VITE_SUPABASE_URL (or SUPABASE_URL)
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Vercel Cron sends Authorization: Bearer <CRON_SECRET>
  const authHeader = req.headers.authorization;
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const cronSecret = process.env.CRON_SECRET;

  if (!supabaseUrl || !cronSecret) {
    return res.status(500).json({ error: 'Missing environment variables' });
  }

  try {
    const response = await fetch(`${supabaseUrl}/functions/v1/refresh_marts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-cron-secret': cronSecret,
      },
      body: JSON.stringify({ triggered_by: 'vercel_cron_15m' }),
    });

    const data = await response.json();
    return res.status(response.status).json(data);
  } catch (error: any) {
    console.error('Error calling refresh_marts:', error);
    return res.status(500).json({ error: error.message });
  }
}
