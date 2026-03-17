import { Link } from 'react-router-dom';
import { AlertTriangle, CheckCircle2, ChevronRight, Package, ChefHat, ShoppingCart, BarChart3 } from 'lucide-react';
import { useSetupCompleteness } from '@/hooks/useSetupCompleteness';

const STEPS = [
  {
    key: 'inventory',
    label: 'Materias primas',
    description: 'Ingredientes y proveedores',
    icon: Package,
    path: '/inventory-setup/items',
    check: (d: any) => d.inventory_items_count > 0,
  },
  {
    key: 'recipes',
    label: 'Escandallos',
    description: 'Recetas con ingredientes',
    icon: ChefHat,
    path: '/inventory-setup/recipes',
    check: (d: any) => d.recipes_with_ingredients_count > 0,
  },
  {
    key: 'pos',
    label: 'Datos de ventas',
    description: 'POS conectado o datos importados',
    icon: ShoppingCart,
    path: '/inventory-setup/integrations',
    check: (d: any) => d.has_pos_data,
  },
  {
    key: 'analysis',
    label: 'Análisis de menú',
    description: 'Menu Engineering activo',
    icon: BarChart3,
    path: '/insights/menu-engineering',
    check: (d: any) => d.completeness_pct >= 75,
  },
];

export function SetupBanner() {
  const { data, isLoading } = useSetupCompleteness();

  if (isLoading || !data) return null;
  if (data.completeness_pct >= 100) return null;

  const completedSteps = STEPS.filter(s => s.check(data)).length;
  const totalSteps = STEPS.length;

  return (
    <div className="mb-6 rounded-xl border border-amber-200 bg-gradient-to-r from-amber-50 to-orange-50 p-5">
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-600" />
        <div className="flex-1">
          <h3 className="text-sm font-semibold text-amber-900">
            Configuración al {data.completeness_pct}%
          </h3>
          <p className="mt-1 text-sm text-amber-700">
            Completa estos pasos para que el análisis de menú sea preciso.
            {data.menu_items_count > data.menu_items_with_recipe && (
              <span className="ml-1 font-medium">
                {data.menu_items_count - data.menu_items_with_recipe} platos sin escandallo.
              </span>
            )}
          </p>

          {/* Progress bar */}
          <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-amber-200">
            <div
              className="h-full rounded-full bg-gradient-to-r from-amber-500 to-orange-500 transition-all duration-500"
              style={{ width: `${data.completeness_pct}%` }}
            />
          </div>

          {/* Steps */}
          <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((step) => {
              const done = step.check(data);
              const Icon = step.icon;
              return (
                <Link
                  key={step.key}
                  to={step.path}
                  className={`flex items-center gap-2.5 rounded-lg border p-3 transition-all hover:shadow-sm ${
                    done
                      ? 'border-emerald-200 bg-emerald-50/50'
                      : 'border-amber-200 bg-white hover:border-amber-300'
                  }`}
                >
                  <div className={`rounded-lg p-1.5 ${done ? 'bg-emerald-100' : 'bg-amber-100'}`}>
                    <Icon className={`h-4 w-4 ${done ? 'text-emerald-600' : 'text-amber-600'}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-xs font-medium truncate ${done ? 'text-emerald-700' : 'text-amber-900'}`}>
                      {step.label}
                    </p>
                    <p className="text-[10px] text-muted-foreground truncate">
                      {step.description}
                    </p>
                  </div>
                  {done ? (
                    <CheckCircle2 className="h-4 w-4 flex-shrink-0 text-emerald-500" />
                  ) : (
                    <ChevronRight className="h-4 w-4 flex-shrink-0 text-amber-400" />
                  )}
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
