import { readFileSync } from 'fs';
const env = readFileSync('.env.local', 'utf8');
const VERCEL_TOKEN = env.match(/VERCEL_TOKEN=(.+)/)[1].trim();
const PROJECT_ID = 'prj_TRsSpLrxQ78a2Tm0xX5ykXYjdCf4';
const headers = { 'Authorization': `Bearer ${VERCEL_TOKEN}` };

const r = await fetch(`https://api.vercel.com/v6/deployments?projectId=${PROJECT_ID}&limit=1`, { headers });
const d = await r.json();
const dep = d.deployments?.[0];
console.log(`State: ${dep?.readyState || dep?.state} | URL: ${dep?.url} | Commit: ${dep?.meta?.githubCommitMessage}`);
