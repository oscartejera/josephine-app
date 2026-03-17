import { ShieldAlert, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

interface NoAccessProps {
  title?: string;
  message?: string;
  showBackButton?: boolean;
}

export function NoAccess({
  
  title = 'Acceso Denegado',
  message = t('common.no_tienes_permisos_para_ver_esta_pagina_contacta_a'),
  showBackButton = true,
}: NoAccessProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] p-8 text-center">
      <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mb-6">
        <ShieldAlert className="w-8 h-8 text-destructive" />
      </div>
      
      <h1 className="text-2xl font-semibold text-foreground mb-2">
        {title}
      </h1>
      
      <p className="text-muted-foreground max-w-md mb-6">
        {message}
      </p>
      
      {showBackButton && (
        <Button
          variant="outline"
          onClick={() => navigate(-1)}
          className="gap-2"
        >
          <ArrowLeft className="w-4 h-4" />
          {t('common.NoAccess.volver')}
        </Button>
      )}
    </div>
  );
}
