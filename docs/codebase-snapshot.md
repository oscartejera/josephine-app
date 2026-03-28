# Josephine Codebase Snapshot
> Auto-generated 2026-03-28 | agent context injection

## Pages (62)

- `pages/AdminTools.tsx` → **AdminTools**
- `pages/Availability.tsx` → **Availability** | hooks: useAvailabilityData
- `pages/BookingWidget.tsx` → **BookingWidget** | hooks: useParams, useNavigate, usePublicBooking
- `pages/Budgets.tsx` → **Budgets** | hooks: usePermissions, useBudgetsData
- `pages/CashManagement.tsx` → **CashManagement** | hooks: usePermissions, useCashManagementData
- `pages/Dashboard.tsx` → **Dashboard** | hooks: useTranslation, useApp, useAuth, useKpiSummary, useAINarratives
- `pages/DataHealth.tsx` → **DataHealth** | hooks: useQuery, useAuth | rpcs: rpc_data_health, refresh_all_mvs
- `pages/DataImport.tsx` → **DataImport** | hooks: useApp, useAuth
- `pages/DebugDataCoherence.tsx` → **DebugDataCoherence** | hooks: useQuery, useAuth, useApp | rpcs: audit_data_coherence
- `pages/Insights.tsx` → **Insights** | hooks: useNavigate, useControlTowerData
- `pages/InstantPL.tsx` → **InstantPL** | hooks: useApp, useInstantPLData
- `pages/Integrations.tsx` → **Integrations** | hooks: useNavigate
- `pages/Inventory.tsx` → **Inventory** | hooks: useNavigate, useSearchParams, useInventoryData
- `pages/InventoryLocation.tsx` → **InventoryLocation** | hooks: useParams, useSearchParams, useNavigate, useInventoryData, useApp
- `pages/InventoryLocationReconciliation.tsx` → **InventoryLocationReconciliation** | hooks: useParams, useSearchParams, useNavigate, useReconciliationData, useApp
- `pages/InventoryReconciliation.tsx` → **InventoryReconciliation** | hooks: useReconciliationData, useInventoryData
- `pages/KioskMode.tsx` → **KioskMode** | hooks: useParams, useNavigate
- `pages/Labour.tsx` → **Labour** | hooks: useParams, useTranslation, useApp, useLabourData
- `pages/Login.tsx` → **Login** | hooks: useNavigate, useAuth, useToast
- `pages/MenuEngineering.tsx` → **MenuEngineering** | hooks: useMenuEngineeringData, usePricingOmnesData
- `pages/NotFound.tsx` → **NotFound** | hooks: useLocation
- `pages/OnboardingChecklist.tsx` → **OnboardingChecklist** | hooks: useNavigate, useApp
- `pages/OnboardingWizardV2.tsx` → **OnboardingWizardV2** | hooks: useNavigate, useApp, useAuth | rpcs: setup_new_owner
- `pages/POS.tsx` → **POS** | hooks: useNavigate, useApp
- `pages/Payroll.tsx` → **Payroll** | hooks: useNavigate, useLocation, useApp, useAuth, useToast
- `pages/Pricing.tsx` → **Pricing** | hooks: useApp, useAuth
- `pages/PrivacyPolicy.tsx` → **PrivacyPolicy** | hooks: useNavigate
- `pages/Procurement.tsx` → **Procurement** | hooks: useProcurementData, useAIPredictiveOrdering, useApp
- `pages/ProcurementCart.tsx` → **ProcurementCart** | hooks: useNavigate, useProcurementData
- `pages/ProcurementOrders.tsx` → **ProcurementOrders** | hooks: useLocation, useAuth
- `pages/ResetPassword.tsx` → **ResetPassword** | hooks: useNavigate, useToast
- `pages/Reviews.tsx` → **Reviews** | hooks: useSearchParams, useReviewsData, useSalesTimeseries, useApp
- `pages/ReviewsAll.tsx` → **ReviewsAll** | hooks: useSearchParams, useNavigate, useReviewsData, useApp
- `pages/Sales.tsx` → **Sales** | hooks: useBISalesData, useTranslation, useTopProducts, useApp
- `pages/Scheduling.tsx` → **Scheduling** | hooks: useWeatherForecast, useSearchParams, useSchedulingSupabase, useAuth, useScheduleEfficiency
- `pages/SettingsPage.tsx` → **SettingsPage** | hooks: useTranslation
- `pages/Settings/DataPrivacySection.tsx` → **DataPrivacySection** | hooks: useToast, useAuth
- `pages/Signup.tsx` → **Signup** | hooks: useNavigate, useAuth, useToast
- `pages/StaffClock.tsx` → **StaffClock** | hooks: useParams, useApp
- `pages/StaffFloor.tsx` → **StaffFloor** | hooks: useParams, useApp, usePOSData
- `pages/Support.tsx` → **Support** | hooks: useNavigate
- `pages/Waste.tsx` → **Waste** | hooks: useSearchParams, useWasteData
- `pages/WorkforceOnboarding.tsx` → **WorkforceOnboarding** | hooks: useApp
- `pages/WorkforceTeam.tsx` → **WorkforceTeam** | hooks: useApp
- `pages/WorkforceTimesheet.tsx` → **WorkforceTimesheet** | hooks: useApp
- `pages/integrations/LightspeedIntegration.tsx` → **LightspeedIntegration** | hooks: useSearchParams, useNavigate, useApp
- `pages/integrations/SquareIntegration.tsx` → **SquareIntegration** | hooks: useSearchParams, useNavigate, useQueryClient, useAuth, useApp
- `pages/integrations/SquareOAuthCallback.tsx` → **SquareOAuthCallback** | hooks: useSearchParams, useNavigate
- `pages/inventory-setup/InventoryItems.tsx` → **InventoryItems** | hooks: useApp
- `pages/inventory-setup/MenuItemsPage.tsx` → **MenuItemsPage** | hooks: useQuery, useAuth, useSetupCompleteness | rpcs: get_recipe_ingredient_count, get_recipe_food_cost
- `pages/inventory-setup/RecipeDetailPage.tsx` → **RecipeDetailPage** | hooks: useParams, useNavigate, useRecipeDetail, useRecipes, useToast
- `pages/inventory-setup/RecipesPage.tsx` → **RecipesPage** | hooks: useNavigate, useRecipes, useToast
- `pages/operations/PrepListPage.tsx` → **PrepListPage** | hooks: useApp
- `pages/operations/StockAuditPage.tsx` → **StockAuditPage** | hooks: useToast, useStockAudit, useQuery, useApp, useLocations
- `pages/operations/WasteEntryPage.tsx` → **WasteEntryPage** | hooks: useToast, useWasteEntry, useQuery, useApp, useLocations
- `pages/team/TeamClock.tsx` → **TeamClock** | hooks: useAuth
- `pages/team/TeamDirectory.tsx` → **TeamDirectory** | hooks: useAuth
- `pages/team/TeamHome.tsx` → **TeamHome** | hooks: useNavigate, useAuth, useQuery
- `pages/team/TeamNews.tsx` → **TeamNews** | hooks: useQuery, useAuth
- `pages/team/TeamPay.tsx` → **TeamPay** | hooks: useAuth
- `pages/team/TeamProfile.tsx` → **TeamProfile** | hooks: useNavigate, useAuth
- `pages/team/TeamSchedule.tsx` → **TeamSchedule** | hooks: useAuth

## Hooks (48)

- `hooks/bom/types.ts` → **types**
- `hooks/inventory/types.ts` → **defaultMetrics**
- `hooks/procurement/types.ts` → **types**
- `hooks/procurement/utils.ts` → **FALLBACK_SKUS**
- `hooks/scheduling/queries.ts` → **queries**
- `hooks/scheduling/types.ts` → **DEPARTMENTS**
- `hooks/scheduling/utils.ts` → **resolveLocationId**
- `hooks/use-toast.ts` → **reducer**
- `hooks/useAINarratives.ts` → **useAINarratives**
- `hooks/useAIPredictiveOrdering.ts` → **useAIPredictiveOrdering**
- `hooks/useAvailabilityData.ts` → **useAvailabilityData**
- `hooks/useBISalesData.ts` → **useBISalesData** | data: kpi
- `hooks/useBudgetsData.ts` → **useBudgetsData**
- `hooks/useCashManagementData.ts` → **useCashManagementData**
- `hooks/useCategorySales.ts` → **useCategorySales**
- `hooks/useControlTowerData.ts` → **useControlTowerData**
- `hooks/useDataSource.ts` → **useDataSource** | rpcs: resolve_data_source
- `hooks/useErrorReporter.ts` → **useErrorReporter**
- `hooks/useForecastAccuracy.ts` → **useForecastAccuracy** | data: cache-config
- `hooks/useGlobalRealtimeNotifications.ts` → **useGlobalRealtimeNotifications**
- `hooks/useHourlyForecast.ts` → **useHourlyForecast** | data: cache-config
- `hooks/useIdleTimeout.ts` → **useIdleTimeout**
- `hooks/useInstantPLData.ts` → **useInstantPLData**
- `hooks/useInventoryData.ts` → **useInventoryData**
- `hooks/useKpiSummary.ts` → **useKpiSummary** | data: kpi, types
- `hooks/useLabourData.ts` → **useLabourData** | data: rpc-contracts
- `hooks/useLoyaltyData.ts` → **useLoyaltyData** | rpcs: add_loyalty_points, redeem_loyalty_reward
- `hooks/useMenuEngineeringData.ts` → **useMenuEngineeringData**
- `hooks/useNotifications.ts` → **useNotifications**
- `hooks/usePOSData.ts` → **usePOSData**
- `hooks/usePermissions.ts` → **PERMISSIONS**
- `hooks/usePricingOmnesData.ts` → **usePricingOmnesData** | rpcs: pricing_omnes_summary
- `hooks/useProcurementData.ts` → **useProcurementData**
- `hooks/usePublicBooking.ts` → **usePublicBooking**
- `hooks/useRecipeDetail.ts` → **useRecipeDetail** | rpcs: get_recipe_ingredients, get_menu_item_id_for_recipe
- `hooks/useRecipes.ts` → **useRecipes** | rpcs: get_recipe_food_cost, get_recipe_ingredient_count | data: cache-config
- `hooks/useReconciliationData.ts` → **useReconciliationData** | data: client, reconciliation, reconciliation
- `hooks/useReviewsData.ts` → **useReviewsData**
- `hooks/useSalesTimeseries.ts` → **useSalesTimeseries**
- `hooks/useScheduleEfficiency.ts` → **useScheduleEfficiency**
- `hooks/useSchedulingSupabase.ts` → **useSchedulingSupabase**
- `hooks/useSetupCompleteness.ts` → **useSetupCompleteness** | rpcs: get_setup_completeness
- `hooks/useStockAudit.ts` → **useStockAudit** | rpcs: get_dead_stock, get_variance_summary
- `hooks/useTopProducts.ts` → **useTopProducts**
- `hooks/useWasteAlerts.ts` → **useWasteAlerts**
- `hooks/useWasteData.ts` → **REASON_LABELS**
- `hooks/useWasteEntry.ts` → **WASTE_REASONS**
- `hooks/useWeatherForecast.ts` → **useWeatherForecast**

## Data Modules (16)

- `data/budget`
- `data/cache-config`
- `data/client`
- `data/forecast`
- `data/guards`
- `data/health`
- `data/index`
- `data/inventory`
- `data/kpi`
- `data/labour`
- `data/payroll`
- `data/reconciliation` → rpcs: rpc_reconciliation_summary
- `data/rpc-contracts`
- `data/sales`
- `data/typed-rpc`
- `data/types`

## Contexts (3)

- `contexts/AppContext.tsx`
- `contexts/AuthContext.tsx`
- `contexts/DemoModeContext.tsx`

## RPCs Referenced (16)

- `add_loyalty_points`
- `audit_data_coherence`
- `get_dead_stock`
- `get_menu_item_id_for_recipe`
- `get_recipe_food_cost`
- `get_recipe_ingredient_count`
- `get_recipe_ingredients`
- `get_setup_completeness`
- `get_variance_summary`
- `pricing_omnes_summary`
- `redeem_loyalty_reward`
- `refresh_all_mvs`
- `resolve_data_source`
- `rpc_data_health`
- `rpc_reconciliation_summary`
- `setup_new_owner`

## Migrations: 81
