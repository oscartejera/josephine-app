/**
 * KDS Styles Service
 * Evalúa reglas de estilo dinámicas según estado de items
 */

import type { KDSTicketLine, StyleRule } from './types';
import { differenceInMinutes } from 'date-fns';

export interface ComputedStyles {
  background?: string;
  border?: string;
  accent?: string;
  shouldBlink?: boolean;
  shouldUnderline?: boolean;
  shouldStrike?: boolean;
}

export class KDSStylesService {
  evaluateStyles(
    line: KDSTicketLine,
    rules: StyleRule[],
    isMarched: boolean
  ): ComputedStyles {
    const styles: ComputedStyles = {};
    const now = new Date();

    for (const rule of rules) {
      let triggered = false;

      switch (rule.trigger) {
        case 'is_rush':
          triggered = line.is_rush;
          break;

        case 'is_marched':
          triggered = isMarched;
          break;

        case 'idle_minutes':
          if (line.prep_started_at && rule.value) {
            const elapsed = differenceInMinutes(now, new Date(line.prep_started_at));
            triggered = elapsed > rule.value;
          }
          break;

        case 'overdue':
          if (line.prep_started_at && line.target_prep_time) {
            const elapsed = differenceInMinutes(now, new Date(line.prep_started_at));
            triggered = elapsed > line.target_prep_time;
          }
          break;

        case 'prewarn':
          if (line.prep_started_at && line.target_prep_time && rule.value) {
            const elapsed = differenceInMinutes(now, new Date(line.prep_started_at));
            const remaining = line.target_prep_time - elapsed;
            triggered = remaining <= rule.value && remaining > 0;
          }
          break;
      }

      if (triggered) {
        this.applyActions(styles, rule.actions);
      }
    }

    return styles;
  }

  private applyActions(styles: ComputedStyles, actions: any[]): void {
    actions.forEach(action => {
      switch (action.type) {
        case 'background':
          styles.background = action.color;
          break;
        case 'border':
          styles.border = action.color;
          break;
        case 'accent':
          styles.accent = action.color;
          break;
        case 'blink':
          styles.shouldBlink = true;
          break;
        case 'underline':
          styles.shouldUnderline = true;
          break;
        case 'strike':
          styles.shouldStrike = true;
          break;
      }
    });
  }
}
