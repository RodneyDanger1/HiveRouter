import { createContext, useContext } from 'react';
import type { ApiError } from './api';
import type { HealthResponse, MetaResponse } from './api-types';

export interface UiContextValue {
  meta: MetaResponse | null;
  metaError: ApiError | null;
  health: HealthResponse | null;
  healthError: ApiError | null;
  reloadMeta: () => void;
  reloadHealth: () => void;
}

export const UiContext = createContext<UiContextValue | null>(null);

export function useUi(): UiContextValue {
  const value = useContext(UiContext);
  if (!value) throw new Error('useUi must be used inside UiContext.Provider');
  return value;
}
