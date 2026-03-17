/**
 * useErrorReporter — Centralized error capture and reporting hook.
 *
 * Captures context (page, user, location, connectivity) with every error.
 * Currently logs to console; can be connected to Sentry/equivalent later.
 */

import { useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useApp } from '@/contexts/AppContext';

import { useTranslation } from 'react-i18next';
interface ErrorReport {
  error: Error;
  context?: string;
  metadata?: Record<string, unknown>;
}

interface ErrorPayload {
  message: string;
  stack?: string;
  context: string;
  userId: string | undefined;
  locationId: string | null;
  page: string;
  online: boolean;
  timestamp: string;
  metadata?: Record<string, unknown>;
}

export function useErrorReporter() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { selectedLocationId } = useApp();

  const reportError = useCallback(
    ({ error, context = 'unknown', metadata }: ErrorReport) => {
      const payload: ErrorPayload = {
        message: error.message,
        stack: error.stack,
        context,
        userId: user?.id,
        locationId: selectedLocationId,
        page: window.location.pathname,
        online: navigator.onLine,
        timestamp: new Date().toISOString(),
        metadata,
      };

      // Log locally (always)
      console.error('[ErrorReporter]', payload);

      // Future: send to external service
      // fetch('/api/errors', { method: 'POST', body: JSON.stringify(payload) });
    },
    [user?.id, selectedLocationId]
  );

  const wrapAsync = useCallback(
    <T,>(fn: () => {t('hooks.useErrorReporter.promise')}<T>{t('hooks.useErrorReporter.contextStringPromise')}<T | undefined> => {
      return fn().catch((error: Error) => {
        reportError({ error, context });
        return undefined;
      });
    },
    [reportError]
  );

  return { reportError, wrapAsync };
}
