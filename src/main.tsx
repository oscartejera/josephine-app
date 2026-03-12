// Initialize i18n BEFORE React imports
import "./i18n";

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// ── Error Monitoring: Sentry ──
import * as Sentry from "@sentry/react";
Sentry.init({
    dsn: "https://713095e2b78dd9cac1fc9e65c0080ee9@o4510991964176384.ingest.de.sentry.io/4510991966077008",
    integrations: [Sentry.browserTracingIntegration(), Sentry.replayIntegration()],
    tracesSampleRate: 0.3,
    replaysSessionSampleRate: 0.1,
    replaysOnErrorSampleRate: 1.0,
    environment: import.meta.env.MODE,
    beforeSend(event) {
        const msg = event.exception?.values?.[0]?.value || '';
        // Filter out non-actionable browser noise
        if (
            msg.includes('signal is aborted') ||
            msg.includes('AbortError') ||
            msg.includes('Failed to fetch dynamically imported module') ||
            msg.includes('ResizeObserver loop') ||
            msg.includes('ChunkLoadError')
        ) {
            return null; // Drop the event
        }
        return event;
    },
});

// ── Analytics: PostHog ──
import posthog from 'posthog-js';
posthog.init('phc_qPdcf6h6Ht3oW4H71gGQjxSIZEF6xRVAgekSda5kf23', {
    api_host: 'https://eu.i.posthog.com',
    person_profiles: 'identified_only',
    capture_pageview: true,
    capture_pageleave: true,
});

createRoot(document.getElementById("root")!).render(
    <StrictMode>
        <App />
    </StrictMode>
);
