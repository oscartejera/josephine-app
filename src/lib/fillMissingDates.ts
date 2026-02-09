import { format, addDays, isBefore, isEqual } from 'date-fns';

/**
 * Fill missing dates in a timeseries array.
 * Ensures ALL dates between `from` and `to` have a row.
 * Missing dates get a row with all numeric fields set to 0.
 *
 * @param data - Array of objects with a `date` field (string 'yyyy-MM-dd' or Date-parseable)
 * @param from - Start date of the range
 * @param to - End date of the range
 * @param template - Optional template object for the default values of new rows
 * @returns Array with all dates filled in, sorted by date
 */
export function fillMissingDates<T extends Record<string, unknown>>(
  data: T[],
  from: Date,
  to: Date,
  template?: Partial<T>
): T[] {
  // Build a map of existing dates -> rows
  const dateMap = new Map<string, T>();
  for (const row of data) {
    const dateStr = String(row.date);
    // Normalize: take just the date part if it's a full ISO string
    const normalized = dateStr.length > 10 ? dateStr.slice(0, 10) : dateStr;
    dateMap.set(normalized, row);
  }

  // Generate all dates in range and fill gaps
  const result: T[] = [];
  let current = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  const end = new Date(to.getFullYear(), to.getMonth(), to.getDate());

  while (isBefore(current, end) || isEqual(current, end)) {
    const dateStr = format(current, 'yyyy-MM-dd');
    const existing = dateMap.get(dateStr);

    if (existing) {
      result.push(existing);
    } else {
      // Create a zero-filled row from the template or from the first data row
      const baseTemplate = template || (data.length > 0 ? data[0] : ({} as T));
      const zeroRow: Record<string, unknown> = {};

      for (const [key, value] of Object.entries(baseTemplate)) {
        if (key === 'date') {
          zeroRow[key] = dateStr;
        } else if (typeof value === 'number') {
          zeroRow[key] = 0;
        } else if (typeof value === 'string') {
          zeroRow[key] = key === 'date' ? dateStr : '';
        } else {
          zeroRow[key] = value;
        }
      }

      // Always ensure date is set
      zeroRow.date = dateStr;
      result.push(zeroRow as T);
    }

    current = addDays(current, 1);
  }

  return result;
}
