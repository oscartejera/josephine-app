/**
 * Insights Hub - Landing page for all insights modules
 */

import { useNavigate } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  TrendingUp, 
  Users, 
  DollarSign, 
  BarChart3,
  ArrowRight,
  Sparkles
} from 'lucide-react';

interface InsightModule {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  path: string;
  color: string;
  gradient: string;
  available: boolean;
}

export default function Insights() {
  const navigate = useNavigate();

  const modules: InsightModule[] = [
    {
      id: 'sales',
      title: 'Sales',
      description: 'Analiza ventas, canales, productos y forecast en tiempo real',
      icon: <TrendingUp className="h-8 w-8" />,
      path: '/sales',
      color: 'text-indigo-600',
      gradient: 'from-indigo-500 to-purple-600',
      available: true,
    },
    {
      id: 'labour',
      title: 'Labour',
      description: 'Optimiza COL%, SPLH, OPLH y costos de personal',
      icon: <Users className="h-8 w-8" />,
      path: '/insights/labour',
      color: 'text-emerald-600',
      gradient: 'from-emerald-500 to-teal-600',
      available: true,
    },
    {
      id: 'instant-pl',
      title: 'Instant P&L',
      description: 'P&L en tiempo real por ubicación con drill-down',
      icon: <DollarSign className="h-8 w-8" />,
      path: '/insights/instant-pl',
      color: 'text-blue-600',
      gradient: 'from-blue-500 to-cyan-600',
      available: true,
    },
    {
      id: 'forecasting',
      title: 'Forecasting',
      description: 'Modelos Prophet ML para predicción de ventas y demanda',
      icon: <BarChart3 className="h-8 w-8" />,
      path: '/insights/forecasting',
      color: 'text-amber-600',
      gradient: 'from-amber-500 to-orange-600',
      available: false,
    },
  ];

  return (
    <div className="p-6 space-y-6 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="space-y-2">
        <h1 className="text-3xl font-bold text-gray-900">Insights</h1>
        <p className="text-gray-600">
          Dashboard centralizado de Business Intelligence con AI-powered analytics
        </p>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="p-4 bg-gradient-to-br from-indigo-50 to-purple-50 border-indigo-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center">
              <Sparkles className="h-5 w-5 text-indigo-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Módulos activos</p>
              <p className="text-2xl font-bold text-gray-900">3</p>
            </div>
          </div>
        </Card>

        <Card className="p-4 bg-gradient-to-br from-emerald-50 to-teal-50 border-emerald-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center">
              <BarChart3 className="h-5 w-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Métricas tracked</p>
              <p className="text-2xl font-bold text-gray-900">40+</p>
            </div>
          </div>
        </Card>

        <Card className="p-4 bg-gradient-to-br from-amber-50 to-orange-50 border-amber-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center">
              <TrendingUp className="h-5 w-5 text-amber-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">AI Insights</p>
              <p className="text-2xl font-bold text-gray-900">24/7</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Modules Grid */}
      <div>
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Módulos disponibles</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {modules.map((module) => (
            <Card 
              key={module.id} 
              className={cn(
                "group relative overflow-hidden transition-all hover:shadow-lg",
                module.available ? "cursor-pointer" : "opacity-60"
              )}
              onClick={() => module.available && navigate(module.path)}
            >
              <div className="p-6 space-y-4">
                {/* Icon and badge */}
                <div className="flex items-start justify-between">
                  <div className={cn("p-3 rounded-xl bg-gradient-to-br", module.gradient, "text-white")}>
                    {module.icon}
                  </div>
                  {!module.available && (
                    <span className="text-xs px-2 py-1 bg-gray-100 text-gray-600 rounded-full">
                      Coming soon
                    </span>
                  )}
                </div>

                {/* Title and description */}
                <div className="space-y-2">
                  <h3 className="text-xl font-bold text-gray-900">{module.title}</h3>
                  <p className="text-sm text-gray-600">{module.description}</p>
                </div>

                {/* Action */}
                {module.available && (
                  <Button 
                    variant="ghost" 
                    className="w-full justify-between group-hover:bg-gray-50"
                  >
                    <span>Ver análisis</span>
                    <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                  </Button>
                )}
              </div>

              {/* Gradient overlay on hover */}
              {module.available && (
                <div className={cn(
                  "absolute inset-0 bg-gradient-to-br opacity-0 group-hover:opacity-5 transition-opacity pointer-events-none",
                  module.gradient
                )} />
              )}
            </Card>
          ))}
        </div>
      </div>

      {/* Help section */}
      <Card className="p-6 bg-gradient-to-br from-purple-50 to-pink-50 border-purple-100">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-full bg-purple-100 flex items-center justify-center shrink-0">
            <Sparkles className="h-6 w-6 text-purple-600" />
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              ¿Necesitas ayuda con tus métricas?
            </h3>
            <p className="text-sm text-gray-600 mb-4">
              Ask Josephine está disponible en cada módulo para darte insights personalizados 
              basados en tus datos en tiempo real.
            </p>
            <Button variant="outline" size="sm">
              Conocer más sobre Josephine AI
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
