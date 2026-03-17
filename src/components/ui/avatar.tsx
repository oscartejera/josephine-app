import * as React from "react";
import * as AvatarPrimitive from "@radix-ui/react-avatar";

import { cn } from "@/lib/utils";

import { useTranslation } from 'react-i18next';
const Avatar = React.forwardRef<
  React.ElementRef<typeof AvatarPrimitive.Root>{t('ui.avatar.reactcomponentpropswithoutref')}<typeof AvatarPrimitive.Root>
>(({ className, ...props }, ref) => (
  <AvatarPrimitive.Root
    ref={ref}
    className={cn("relative flex h-10 w-10 shrink-0 overflow-hidden rounded-full", className)}
    {...props}
  />
{t('ui.avatar.avatardisplaynameAvatarprimitiverootdisp')}<
  React.ElementRef<typeof AvatarPrimitive.Image>{t('ui.avatar.reactcomponentpropswithoutref1')}<typeof AvatarPrimitive.Image>
>(({ className, ...props }, ref) => (
  <AvatarPrimitive.Image ref={ref} className={cn("aspect-square h-full w-full", className)} {...props} />
{t('ui.avatar.avatarimagedisplaynameAvatarprimitiveima')}<
  React.ElementRef<typeof AvatarPrimitive.Fallback>{t('ui.avatar.reactcomponentpropswithoutref2')}<typeof AvatarPrimitive.Fallback>
>(({ className, ...props }, ref) => (
  <AvatarPrimitive.Fallback
    ref={ref}
    className={cn("flex h-full w-full items-center justify-center rounded-full bg-muted", className)}
    {...props}
  />
));
AvatarFallback.displayName = AvatarPrimitive.Fallback.displayName;

export { Avatar, AvatarImage, AvatarFallback };
