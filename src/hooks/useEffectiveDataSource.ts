/**
 * useEffectiveDataSource — Thin consumer hook for DataSourceContext.
 *
 * Returns the canonical, memoized data-source state that every feature
 * module should use.  Throws a clear dev-time error if the provider is
 * missing.
 */

import { useContext } from 'react';
import {
  DataSourceContext,
  type EffectiveDataSourceState,
} from '@/contexts/DataSourceContext';

export type { EffectiveDataSourceState };

export function useEffectiveDataSource(): EffectiveDataSourceState {
  const ctx = useContext(DataSourceContext);

  if (ctx === null) {
    throw new Error(
      'useEffectiveDataSource must be used within a <DataSourceProvider>. ' +
        'Wrap your app (or test) with DataSourceProvider.',
    );
  }

  return ctx;
}
