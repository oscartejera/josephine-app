/**
 * MegaMenuPanel — Dropdown panel for mega-menu items
 * 
 * Renders columns of navigation items + a success story card on the right.
 * Animates with CSS transition (opacity + translateY).
 */
import { Link } from 'react-router-dom';
import { ArrowRight, Layers, Link2, RefreshCw, BarChart3, Package, Users, Banknote, Store, Globe, MapPin, Building2, Sparkles, Handshake, Rocket, FileText, TrendingUp, Calculator, BookOpen } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { LandingMegaMenuItem } from '@/data/landing/landingRoutes';

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  Layers, Link2, RefreshCw, BarChart3, Package, Users, Banknote,
  Store, Globe, MapPin, Building2, Sparkles, Handshake, Rocket,
  FileText, TrendingUp, Calculator, BookOpen,
};

interface MegaMenuPanelProps {
  item: LandingMegaMenuItem;
  isOpen: boolean;
  isEs: boolean;
  successStory: {
    imageUrl: string;
    titleEn: string;
    titleEs: string;
    linkText: string;
    linkTextEs: string;
    href: string;
  };
  onClose: () => void;
}

export function MegaMenuPanel({ item, isOpen, isEs, successStory, onClose }: MegaMenuPanelProps) {
  if (!item.sections) return null;

  const colClass = item.columns === 3 ? 'cols-3' : 'cols-2';

  return (
    <div
      className={cn('l-mega-panel', isOpen && 'open')}
      role="menu"
      aria-label={`${isEs ? item.labelEs : item.label} submenu`}
    >
      <div className={cn('l-mega-panel-inner', colClass)}>
        {/* Navigation Columns */}
        {item.sections.map((section, i) => (
          <div key={i}>
            <div className="l-mega-column-title">
              {isEs ? section.labelEs : section.label}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {section.items.map((navItem) => (
                <Link
                  key={navItem.href}
                  to={navItem.href}
                  className="l-mega-item"
                  onClick={onClose}
                  role="menuitem"
                >
                  <div className="l-mega-item-icon">
                    {(() => { const Icon = navItem.icon ? iconMap[navItem.icon] : null; return Icon ? <Icon className="w-5 h-5" /> : null; })()}
                  </div>
                  <div>
                    <div className="l-mega-item-title">
                      {isEs ? navItem.titleEs : navItem.title}
                      <ArrowRight className="w-3.5 h-3.5" style={{ opacity: 0.4 }} />
                    </div>
                    <div className="l-mega-item-desc">
                      {isEs ? navItem.descriptionEs : navItem.description}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        ))}

        {/* Success Story Card */}
        <div className="l-mega-story">
          <img
            src={successStory.imageUrl}
            alt="Success story restaurant"
            loading="lazy"
          />
          <div className="l-mega-story-body">
            <div className="l-mega-story-title">
              {isEs ? successStory.titleEs : successStory.titleEn}
            </div>
            <Link
              to={successStory.href}
              className="l-mega-story-link"
              onClick={onClose}
            >
              {isEs ? successStory.linkTextEs : successStory.linkText}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
