/**
 * Debug: dump raw Square catalog data to see category associations
 */
import { corsHeaders } from '../_shared/cors.ts';

const SQUARE_BASE = 'https://connect.squareup.com/v2';

async function sq(endpoint: string, token: string, method = 'GET', body?: unknown) {
  const res = await fetch(`${SQUARE_BASE}${endpoint}`, {
    method,
    headers: {
      'Square-Version': '2024-01-18',
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  return res.json();
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const token = Deno.env.get('SQUARE_PRODUCTION_ACCESS_TOKEN');
    if (!token) throw new Error('No token');

    // 1) List categories
    const catResp = await sq('/catalog/list?types=CATEGORY', token);
    const categories = (catResp.objects || []).map((c: any) => ({
      id: c.id,
      name: c.category_data?.name,
    }));

    // 2) search-catalog-items (the item-specific endpoint)
    const searchResp = await sq('/catalog/search-catalog-items', token, 'POST', { limit: 5 });

    // 3) Also try general catalog/search with include_related_objects
    const generalResp = await sq('/catalog/search', token, 'POST', {
      object_types: ['ITEM'],
      include_related_objects: true,
      limit: 3,
    });

    // 4) Also try catalog/list?types=ITEM
    const listResp = await sq('/catalog/list?types=ITEM&limit=3', token);

    // 5) Try retrieving a single item with include_related_objects
    const firstItemId = (searchResp.items?.[0]?.id) || (generalResp.objects?.[0]?.id);
    let singleResp = null;
    if (firstItemId) {
      singleResp = await sq(`/catalog/object/${firstItemId}?include_related_objects=true`, token);
    }

    return new Response(JSON.stringify({
      categories,
      search_catalog_items_sample: searchResp.items?.slice(0, 2),
      general_search_sample: generalResp.objects?.slice(0, 2),
      general_search_related: generalResp.related_objects?.slice(0, 5),
      list_sample: listResp.objects?.slice(0, 2),
      single_item: singleResp,
    }, null, 2), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
