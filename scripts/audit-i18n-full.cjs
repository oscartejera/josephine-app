/**
 * Full i18n audit: finds ALL remaining hardcoded Spanish strings in src/
 * Usage: node scripts/audit-i18n-full.cjs
 */
const fs = require('fs');
const path = require('path');

const SPANISH_ACCENTED = /[ñáéíóúüÑÁÉÍÓÚÜ¡¿]/;
const SPANISH_WORDS = /\b(?:Aquí|aquí|Añadir|añadir|Seleccionar?|seleccionar?|Confirmar|confirmar|Guardar|guardar|Cancelar|cancelar|Eliminar|eliminar|Buscar|buscar|Crear|crear|Editar|editar|Configurar|configurar|Exportar|exportar|Importar|importar|Descargar|descargar|Subir|subir|Enviar|enviar|Siguiente|siguiente|Anterior|anterior|Aceptar|aceptar|Rechazar|rechazar|Actualizar|actualizar|Cerrar|cerrar|Volver|volver|Ventas|Gastos|Empleados?|Turno|Horario|Recetas?|Inventario|Pedidos?|Proveedores?|Facturas?|Reservas?|Reseñas?|Cocina|Restaurante|Integración|Notificación|Rendimiento|Presupuesto|Resumen|Total|Detalle|Opciones|Acciones|Filtrar|Ordenar|Resultados|Periodo|Información|Categoría|Cantidad|Precio|Nombre|Descripción|Estado|Fecha|Hora|Dirección|Teléfono|Correo|Contraseña|Usuario|Perfil|Cuenta|Pago|Tarjeta|Método|Ubicación|Sucursal|Datos|Informe|Reporte|Análisis|Comparar|Comparación|Porcentaje|Promedio|Máximo|Mínimo|Periodo|Semana|Quincena|Mensual|Anual|Diario|Semanal|Trimestral|No hay|Sin datos|Sin resultados|Cargando|Procesando|Error al|Éxito|Completado|Pendiente|Aprobado|Rechazado|Activo|Inactivo|Disponible|Ocupado|Conectado|Desconectado)\b/;

// Patterns to SKIP
const SKIP_LINE = line => {
  const t = line.trim();
  return (
    t.startsWith('//') ||
    t.startsWith('*') ||
    t.startsWith('/*') ||
    t.startsWith('import ') ||
    t.startsWith('from ') ||
    /^\s*\/\//.test(t)
  );
};

const SKIP_STRING = str => {
  // CSS classes
  if (/^(?:text-|bg-|flex|grid|rounded|border|shadow|font-|hover:|focus:|p-|m-|w-|h-|gap-|space-|items-|justify-|overflow-|min-|max-)/.test(str)) return true;
  // data/aria attributes
  if (/^(?:data-|aria-)/.test(str)) return true;
  // i18n key patterns (dot-separated, no spaces)
  if (/^[a-zA-Z]+\.[a-zA-Z]/.test(str) && !/\s/.test(str)) return true;
  // URLs
  if (/^https?:\/\//.test(str)) return true;
  // Very short (1-2 chars)
  if (str.length < 3) return true;
  return false;
};

function walkDir(dir) {
  let results = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory() && !['node_modules', '.git', 'dist', '__tests__'].includes(entry.name)) {
      results = results.concat(walkDir(full));
    } else if (entry.isFile() && /\.(tsx|ts)$/.test(entry.name) && !entry.name.includes('.d.ts')) {
      results.push(full);
    }
  }
  return results;
}

const files = walkDir(path.join(process.cwd(), 'src'));
const report = {};
let totalCount = 0;

for (const file of files) {
  const content = fs.readFileSync(file, 'utf8');
  const lines = content.split('\n');
  const hits = [];

  lines.forEach((line, idx) => {
    if (SKIP_LINE(line)) return;
    // Already uses t() — skip
    if (/\bt\(\s*['"]/.test(line)) {
      // But check if there's ALSO a hardcoded string on the same line outside t()
      // For simplicity, skip the whole line
      return;
    }

    // Extract all string literals and JSX text
    const stringMatches = [];

    // Single/double quoted strings
    const re1 = /['"]((?:[^'"\\\n]|\\.){3,})['"]/g;
    let m;
    while ((m = re1.exec(line)) !== null) {
      stringMatches.push(m[1]);
    }

    // Template literals
    const re2 = /`([^`]{3,})`/g;
    while ((m = re2.exec(line)) !== null) {
      stringMatches.push(m[1]);
    }

    // JSX text content: >text<
    const re3 = />\s*([^<>{}\n\r]{3,}?)\s*</g;
    while ((m = re3.exec(line)) !== null) {
      const txt = m[1].trim();
      if (txt.length >= 3) stringMatches.push(txt);
    }

    for (const str of stringMatches) {
      if (SKIP_STRING(str)) continue;
      if (SPANISH_ACCENTED.test(str) || SPANISH_WORDS.test(str)) {
        hits.push({ line: idx + 1, text: str.substring(0, 90) });
      }
    }
  });

  if (hits.length > 0) {
    const relPath = path.relative(path.join(process.cwd(), 'src'), file).replace(/\\/g, '/');
    report[relPath] = hits;
    totalCount += hits.length;
  }
}

// Output
console.log(`\n=== i18n AUDIT REPORT ===`);
console.log(`Total remaining hardcoded Spanish strings: ${totalCount}`);
console.log(`Files with issues: ${Object.keys(report).length}`);
console.log(`========================\n`);

const sorted = Object.entries(report).sort((a, b) => b[1].length - a[1].length);
for (const [f, hits] of sorted) {
  console.log(`${f} (${hits.length} strings):`);
  for (const h of hits) {
    console.log(`  L${h.line}: ${h.text}`);
  }
  console.log();
}

// Machine-readable JSON for batch-3
const jsonOut = {};
for (const [f, hits] of sorted) {
  jsonOut[f] = hits.map(h => ({ line: h.line, text: h.text }));
}
fs.writeFileSync(
  path.join(process.cwd(), 'scripts', 'audit-results.json'),
  JSON.stringify(jsonOut, null, 2)
);
console.log('Results saved to scripts/audit-results.json');
