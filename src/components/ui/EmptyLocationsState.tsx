import { MapPin } from 'lucide-react';
import { useTranslation } from 'react-i18next';

/**
 * Shown when the user has no accessible locations.
 * Prevents infinite loading skeletons.
 */
export function EmptyLocationsState() {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <MapPin className="h-12 w-12 text-muted-foreground/40 mb-4" />
      <h3 className="text-lg font-semibold text-foreground">{t("common.noAccessibleLocations")}</h3>
      <p className="text-sm text-muted-foreground mt-1 max-w-sm">
        {t('ui.EmptyLocationsState.noTienesAccesoANingun')}
      </p>
    </div>
  );
}
