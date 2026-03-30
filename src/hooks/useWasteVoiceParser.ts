/**
 * useWasteVoiceParser — Parses Spanish voice input into waste log data
 *
 * Extracts from natural language:
 * - Quantity: "dos" → 2, "medio" → 0.5, "2.5 kilos" → 2.5
 * - Unit: "kilos" → kg, "litros" → L
 * - Product: fuzzy match against inventory items
 * - Reason: "caducidad" → expiry, "sobró" → end_of_day
 */

import { useMemo, useCallback } from 'react';
import type { QuickLogItem } from '@/hooks/useWasteQuickLog';
import type { WasteReasonCode } from '@/hooks/useWasteEntry';

// ── Types ──

export interface VoiceParseResult {
  matchedItem: QuickLogItem | null;
  quantity: number | null;
  unit: string | null;
  reason: WasteReasonCode | null;
  confidence: 'high' | 'medium' | 'low';
  debugInfo: string; // human-readable explanation
}

// ── Number parsing (Spanish) ──

const SPANISH_NUMBERS: Record<string, number> = {
  'cero': 0, 'medio': 0.5, 'media': 0.5,
  'un': 1, 'uno': 1, 'una': 1,
  'dos': 2, 'tres': 3, 'cuatro': 4,
  'cinco': 5, 'seis': 6, 'siete': 7,
  'ocho': 8, 'nueve': 9, 'diez': 10,
  'once': 11, 'doce': 12, 'quince': 15,
  'veinte': 20, 'veinticinco': 25,
  'treinta': 30, 'cincuenta': 50, 'cien': 100,
};

function parseQuantity(text: string): number | null {
  // Try decimal/integer first: "2.5", "3", "0.5"
  const numMatch = text.match(/(\d+[.,]?\d*)/);
  if (numMatch) {
    return parseFloat(numMatch[1].replace(',', '.'));
  }

  // Try Spanish words
  const words = text.toLowerCase().split(/\s+/);
  for (const word of words) {
    if (SPANISH_NUMBERS[word] !== undefined) {
      return SPANISH_NUMBERS[word];
    }
  }

  return null;
}

// ── Unit parsing ──

const UNIT_MAP: Record<string, string> = {
  'kilo': 'kg', 'kilos': 'kg', 'kilogramo': 'kg', 'kilogramos': 'kg', 'kg': 'kg',
  'gramo': 'g', 'gramos': 'g', 'g': 'g',
  'litro': 'L', 'litros': 'L', 'l': 'L',
  'unidad': 'ud', 'unidades': 'ud', 'ud': 'ud',
  'pieza': 'ud', 'piezas': 'ud',
  'ración': 'ud', 'raciones': 'ud', 'porción': 'ud', 'porciones': 'ud',
  'caja': 'caja', 'cajas': 'caja',
  'botella': 'ud', 'botellas': 'ud',
  'lata': 'ud', 'latas': 'ud',
};

function parseUnit(text: string): string | null {
  const words = text.toLowerCase().split(/\s+/);
  for (const word of words) {
    if (UNIT_MAP[word]) return UNIT_MAP[word];
  }
  return null;
}

// ── Reason parsing ──

const REASON_KEYWORDS: Record<string, WasteReasonCode> = {
  // Caducidad / expiry
  'caducidad': 'expiry', 'caducado': 'expiry', 'caducada': 'expiry',
  'expirado': 'expiry', 'expirada': 'expiry', 'vencido': 'expiry', 'vencida': 'expiry',
  'caduca': 'expiry', 'pasado': 'expiry', 'pasada': 'expiry',
  // End of day
  'sobró': 'end_of_day', 'sobra': 'end_of_day', 'sobras': 'end_of_day',
  'fin de día': 'end_of_day', 'cierre': 'end_of_day', 'sobrante': 'end_of_day',
  'final del día': 'end_of_day',
  // Kitchen error
  'error': 'kitchen_error', 'quemado': 'kitchen_error', 'quemada': 'kitchen_error',
  'mal': 'kitchen_error', 'equivocación': 'kitchen_error', 'equivocado': 'kitchen_error',
  // Plate waste
  'plato': 'plate_waste', 'resto': 'plate_waste', 'restos': 'plate_waste',
  'devuelto': 'plate_waste', 'devuelta': 'plate_waste',
  // Damaged / broken
  'roto': 'broken', 'rota': 'broken', 'dañado': 'broken', 'dañada': 'broken',
  'estropeado': 'broken', 'estropeada': 'broken', 'golpe': 'broken',
  // Over production
  'sobreproducción': 'over_production', 'demasiado': 'over_production',
  'exceso': 'over_production',
  // Spillage
  'derrame': 'spillage', 'derramado': 'spillage', 'tirado': 'spillage',
  'caído': 'spillage', 'caída': 'spillage',
};

function parseReason(text: string): WasteReasonCode | null {
  const lower = text.toLowerCase();

  // Check multi-word phrases first
  for (const [phrase, reason] of Object.entries(REASON_KEYWORDS)) {
    if (phrase.includes(' ')) {
      if (lower.includes(phrase)) return reason;
    }
  }

  // Then single words
  const words = lower.split(/\s+/);
  for (const word of words) {
    // Strip common suffixes for flexible matching
    const clean = word.replace(/[.,;:!?]$/, '');
    if (REASON_KEYWORDS[clean]) return REASON_KEYWORDS[clean];
  }

  return null;
}

// ── Product matching ──

function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove accents
    .replace(/[^a-z0-9\s]/g, '')
    .trim();
}

function fuzzyMatch(input: string, target: string): number {
  const a = normalizeText(input);
  const b = normalizeText(target);

  // Exact inclusion
  if (b.includes(a) || a.includes(b)) return 1.0;

  // Word-level match
  const inputWords = a.split(/\s+/);
  const targetWords = b.split(/\s+/);

  let matchedWords = 0;
  for (const iw of inputWords) {
    if (iw.length < 3) continue; // skip short words
    for (const tw of targetWords) {
      if (tw.includes(iw) || iw.includes(tw)) {
        matchedWords++;
        break;
      }
    }
  }

  if (inputWords.filter(w => w.length >= 3).length === 0) return 0;
  return matchedWords / inputWords.filter(w => w.length >= 3).length;
}

function findBestMatch(text: string, items: QuickLogItem[]): QuickLogItem | null {
  const lower = text.toLowerCase();
  // Remove quantity, unit, and reason words to isolate the product name
  const filtered = lower
    .replace(/\d+[.,]?\d*/g, '') // remove numbers
    .replace(new RegExp(Object.keys(UNIT_MAP).join('|'), 'gi'), '') // remove units
    .replace(new RegExp(Object.keys(REASON_KEYWORDS).join('|'), 'gi'), '') // remove reasons
    .replace(new RegExp(Object.keys(SPANISH_NUMBERS).join('|'), 'gi'), '') // remove number words
    .replace(/\b(de|del|la|el|los|las|un|una|unos|unas|y|con|por|para)\b/gi, '') // stop words
    .replace(/\s+/g, ' ')
    .trim();

  if (!filtered || filtered.length < 2) return null;

  let bestItem: QuickLogItem | null = null;
  let bestScore = 0;

  for (const item of items) {
    const score = fuzzyMatch(filtered, item.name);
    if (score > bestScore && score >= 0.5) {
      bestScore = score;
      bestItem = item;
    }
  }

  return bestItem;
}

// ── Main parser hook ──

export function useWasteVoiceParser(items: QuickLogItem[]) {
  const parse = useCallback((transcript: string): VoiceParseResult => {
    if (!transcript.trim()) {
      return {
        matchedItem: null, quantity: null, unit: null, reason: null,
        confidence: 'low', debugInfo: 'Transcripción vacía',
      };
    }

    const quantity = parseQuantity(transcript);
    const unit = parseUnit(transcript);
    const reason = parseReason(transcript);
    const matchedItem = findBestMatch(transcript, items);

    // Calculate confidence
    let score = 0;
    const parts: string[] = [];

    if (matchedItem) { score += 2; parts.push(`Producto: ${matchedItem.name}`); }
    if (quantity !== null) { score += 1; parts.push(`Cantidad: ${quantity}`); }
    if (unit) { score += 0.5; parts.push(`Unidad: ${unit}`); }
    if (reason) { score += 0.5; parts.push(`Motivo: ${reason}`); }

    const confidence: 'high' | 'medium' | 'low' =
      score >= 3 ? 'high' :
      score >= 1.5 ? 'medium' : 'low';

    const debugInfo = parts.length > 0
      ? `Detectado: ${parts.join(' | ')}`
      : 'No se pudo interpretar el mensaje';

    return { matchedItem, quantity, unit, reason, confidence, debugInfo };
  }, [items]);

  return { parse };
}
