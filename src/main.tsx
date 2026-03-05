// Initialize i18n BEFORE React imports
import "./i18n";

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// ── Error Monitoring: Sentry ──
// Install: npm install @sentry/react
// Uncomment below after installing:
// import * as Sentry from "@sentry/react";
// Sentry.init({
//   dsn: "YOUR_SENTRY_DSN_HERE",
//   integrations: [Sentry.browserTracingIntegration(), Sentry.replayIntegration()],
//   tracesSampleRate: 0.3,
//   replaysSessionSampleRate: 0.1,
//   replaysOnErrorSampleRate: 1.0,
//   environment: import.meta.env.MODE,
// });

// ── Analytics: PostHog ──
// Install: npm install posthog-js
// Uncomment below after installing:
// import posthog from 'posthog-js';
// posthog.init('YOUR_POSTHOG_API_KEY', {
//   api_host: 'https://eu.i.posthog.com',
//   person_profiles: 'identified_only',
//   capture_pageview: true,
//   capture_pageleave: true,
// });

createRoot(document.getElementById("root")!).render(
    <StrictMode>
        <App />
    </StrictMode>
);
