import { useState, useEffect } from 'react';
import { useApp } from '@/contexts/AppContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { ChefHat, Printer, Calendar, Search, ChevronRight, Package, AlertTriangle, CheckCircle2, Loader2 } from 'lucide-react';
import { format, addDays } from 'date-fns';
import { es } from 'date-fns/locale';
import { useTranslation } from 'react-i18next';

interface PrepIngredient {
    name: string;
    quantity: number;
    unit: string;
    current_stock: number | null;
}

interface PrepItem {
    recipe_id: string;
    recipe_name: string;
    category: string;
    predicted_portions: number;
    ingredients: PrepIngredient[];
}

export default function PrepListPage() {
  const { t } = useTranslation();
    const { selectedLocationId, selectedLocation, loading: appLoading } = useApp();
    const [prepItems, setPrepItems] = useState<PrepItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
    const [searchQuery, setSearchQuery] = useState('');
    const [checkedItems, setCheckedItems] = useState<Set<string>>(new Set());

    useEffect(() => {
        async function fetchPrepList() {
            if (!selectedLocationId || selectedLocationId === 'all') {
                setLoading(false);
                return;
            }

            setLoading(true);
            try {
                const { data, error } = await (supabase.rpc as any)('get_daily_prep_list', {
                    _location_id: selectedLocationId,
                    _date: selectedDate,
                });

                if (data && !error) {
                    setPrepItems(data as PrepItem[]);
                } else {
                    console.error('Error fetching prep list:', error?.message);
                    setPrepItems([]);
                }
            } catch (err) {
                console.error('Prep list fetch error:', err);
            } finally {
                setLoading(false);
            }
        }

        if (!appLoading) fetchPrepList();
    }, [selectedLocationId, selectedDate, appLoading]);

    const filteredItems = prepItems.filter(item =>
        item.recipe_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.category.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const categories = [...new Set(filteredItems.map(item => item.category))];

    const toggleCheck = (id: string) => {
        setCheckedItems(prev => {
            const next = new Set(prev);
            next.has(id) ? next.delete(id) : next.add(id);
            return next;
        });
    };

    const progress = prepItems.length > 0
        ? Math.round((checkedItems.size / prepItems.length) * 100)
        : 0;

    const lowStockCount = prepItems.reduce((count, item) => {
        const hasLow = item.ingredients.some(
            ing => ing.current_stock !== null && ing.current_stock < ing.quantity
        );
        return count + (hasLow ? 1 : 0);
    }, 0);

    const handlePrint = () => window.print();

    return (
        <div className="max-w-[1200px] mx-auto space-y-6 animate-fade-in">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <div className="flex items-center gap-3">
                        <h1 className="text-2xl font-display font-bold">{t('prepList.title')}</h1>
                        <Badge variant="outline" className="gap-1.5">
                            <Calendar className="h-3 w-3" />
                            {format(new Date(selectedDate), "EEEE d 'de' MMMM", { locale: es })}
                        </Badge>
                    </div>
                    <div className="flex items-center gap-1 text-sm text-muted-foreground mt-1">
                        <span>{t('nav.operations')}</span>
                        <ChevronRight className="h-3 w-3" />
                        <span className="text-foreground">{t('prepList.title')}</span>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <Input
                        type="date"
                        value={selectedDate}
                        onChange={e => setSelectedDate(e.target.value)}
                        className="w-[160px]"
                    />
                    <Button variant="outline" onClick={() => setSelectedDate(format(addDays(new Date(), 1), 'yyyy-MM-dd'))}>
                        {t('prepList.tomorrow')}
                    </Button>
                    <Button variant="outline" onClick={handlePrint}>
                        <Printer className="h-4 w-4 mr-2" />
                        {t('common.print')}
                    </Button>
                </div>
            </div>

            {/* Progress + Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card>
                    <CardContent className="pt-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-muted-foreground">{t('prepList.progress')}</p>
                                <p className="text-2xl font-bold">{progress}%</p>
                            </div>
                            <div className="h-12 w-12 rounded-full border-4 border-primary flex items-center justify-center">
                                <span className="text-xs font-bold">{checkedItems.size}/{prepItems.length}</span>
                            </div>
                        </div>
                        <div className="mt-3 h-2 bg-muted rounded-full overflow-hidden">
                            <div
                                className="h-full bg-primary transition-all duration-500"
                                style={{ width: `${progress}%` }}
                            />
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardContent className="pt-6">
                        <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                                <ChefHat className="h-5 w-5 text-primary" />
                            </div>
                            <div>
                                <p className="text-sm text-muted-foreground">{t('prepList.recipesToPrepare')}</p>
                                <p className="text-2xl font-bold">{prepItems.length}</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardContent className="pt-6">
                        <div className="flex items-center gap-3">
                            <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${lowStockCount > 0 ? 'bg-warning/10' : 'bg-success/10'
                                }`}>
                                {lowStockCount > 0 ? (
                                    <AlertTriangle className="h-5 w-5 text-warning" />
                                ) : (
                                    <CheckCircle2 className="h-5 w-5 text-success" />
                                )}
                            </div>
                            <div>
                                <p className="text-sm text-muted-foreground">{t('prepList.lowStock')}</p>
                                <p className="text-2xl font-bold">{lowStockCount}</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Search */}
            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                    placeholder={t('prepList.searchRecipe')}
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="pl-10"
                />
            </div>

            {/* Prep List by Category */}
            {loading ? (
                <div className="space-y-4">
                    <Skeleton className="h-32 w-full rounded-xl" />
                    <Skeleton className="h-32 w-full rounded-xl" />
                    <Skeleton className="h-32 w-full rounded-xl" />
                </div>
            ) : filteredItems.length === 0 ? (
                <Card>
                    <CardContent className="py-12 text-center">
                        <ChefHat className="h-12 w-12 mx-auto text-muted-foreground/40 mb-4" />
                        <p className="font-medium text-muted-foreground">{t('prepList.noItems')}</p>
                        <p className="text-sm text-muted-foreground mt-1">
                            {t('prepList.addRecipesHint')}
                        </p>
                    </CardContent>
                </Card>
            ) : (
                categories.map(category => (
                    <Card key={category} className="print:break-inside-avoid">
                        <CardHeader className="pb-3">
                            <CardTitle className="text-base flex items-center gap-2">
                                <Package className="h-4 w-4" />
                                {category}
                            </CardTitle>
                            <CardDescription>
                                {filteredItems.filter(i => i.category === category).length} {t('prepList.recipes')}
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="divide-y">
                                {filteredItems
                                    .filter(i => i.category === category)
                                    .map(item => {
                                        const isChecked = checkedItems.has(item.recipe_id);
                                        const hasLowStock = item.ingredients.some(
                                            ing => ing.current_stock !== null && ing.current_stock < ing.quantity
                                        );

                                        return (
                                            <div
                                                key={item.recipe_id}
                                                className={`py-3 flex items-start gap-3 cursor-pointer transition-opacity ${isChecked ? 'opacity-50' : ''
                                                    }`}
                                                onClick={() => toggleCheck(item.recipe_id)}
                                            >
                                                {/* Checkbox */}
                                                <div className={`mt-1 h-5 w-5 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${isChecked
                                                    ? 'bg-primary border-primary text-primary-foreground'
                                                    : 'border-muted-foreground/30'
                                                    }`}>
                                                    {isChecked && <CheckCircle2 className="h-3 w-3" />}
                                                </div>

                                                {/* Recipe info */}
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2">
                                                        <span className={`font-medium ${isChecked ? 'line-through' : ''}`}>
                                                            {item.recipe_name}
                                                        </span>
                                                        <Badge variant="secondary" className="text-xs">
                                                            ×{item.predicted_portions}
                                                        </Badge>
                                                        {hasLowStock && (
                                                            <Badge variant="outline" className="text-xs text-warning border-warning/30">
                                                                <AlertTriangle className="h-3 w-3 mr-1" />
                                                                {t('prepList.lowStock')}
                                                            </Badge>
                                                        )}
                                                    </div>

                                                    {/* Ingredients */}
                                                    {item.ingredients.length > 0 && (
                                                        <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                                                            {item.ingredients.map((ing, idx) => (
                                                                <span key={idx} className={
                                                                    ing.current_stock !== null && ing.current_stock < ing.quantity
                                                                        ? 'text-warning font-medium'
                                                                        : ''
                                                                }>
                                                                    {ing.name}: {ing.quantity.toFixed(1)} {ing.unit}
                                                                    {ing.current_stock !== null && (
                                                                        <span className="text-muted-foreground/60">
                                                                            {' '}(stock: {ing.current_stock.toFixed(1)})
                                                                        </span>
                                                                    )}
                                                                </span>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                            </div>
                        </CardContent>
                    </Card>
                ))
            )}

            {/* Print styles */}
            <style>{`
        @media print {
          .no-print, [data-tour], aside, header { display: none !important; }
          body { padding: 0; }
          .print\\:break-inside-avoid { break-inside: avoid; }
        }
      `}</style>
        </div>
    );
}
