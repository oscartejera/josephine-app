/**
 * Comprehensive i18n remediation script
 * 1. Adds missing keys to all locale files
 * 2. Does NOT auto-replace TSX strings (done manually)
 */
import { readFileSync, writeFileSync } from 'fs';

// ── Missing keys by language ──
const missingKeys = {
  waste: {
    en: { selectItem: 'Select the item', lossReason: 'Loss reason', lostQuantity: 'Lost quantity', confirmEntry: 'Confirm entry', optimizedWasteLog: 'Optimized waste log', wasteRegistered: 'Waste registered', registering: 'Registering...', confirmWaste: 'Confirm Waste' },
    es: { selectItem: 'Selecciona el producto', lossReason: 'Motivo de pérdida', lostQuantity: 'Cantidad perdida', confirmEntry: 'Confirmar registro', optimizedWasteLog: 'Registro optimizado de merma', wasteRegistered: 'Merma registrada', registering: 'Registrando...', confirmWaste: 'Confirmar Merma' },
    ca: { selectItem: 'Selecciona el producte', lossReason: 'Motiu de pèrdua', lostQuantity: 'Quantitat perduda', confirmEntry: 'Confirmar registre', optimizedWasteLog: 'Registre optimitzat de merma', wasteRegistered: 'Merma registrada', registering: 'Registrant...', confirmWaste: 'Confirmar Merma' },
    de: { selectItem: 'Produkt auswählen', lossReason: 'Verlustgrund', lostQuantity: 'Verlorene Menge', confirmEntry: 'Eintrag bestätigen', optimizedWasteLog: 'Optimiertes Abfallprotokoll', wasteRegistered: 'Abfall registriert', registering: 'Registrieren...', confirmWaste: 'Abfall bestätigen' },
    fr: { selectItem: 'Sélectionner le produit', lossReason: 'Raison de perte', lostQuantity: 'Quantité perdue', confirmEntry: 'Confirmer l\'entrée', optimizedWasteLog: 'Journal de déchets optimisé', wasteRegistered: 'Déchet enregistré', registering: 'Enregistrement...', confirmWaste: 'Confirmer Déchet' },
  },
  common: {
    en: { continue: 'Continue', product: 'Product', reason: 'Reason', notesOptional: 'Notes (optional)...', stock: 'Stock', units: 'units', role: 'Role', local: 'Local', selectLocal: 'Select location', writeMessage: 'Write your message...', searchTeammate: 'Search teammate...', selectEmployee: 'Select employee', category: 'Category', severity: 'Severity', whatHappened: 'What happened during the shift?', selectIngredient: 'Select ingredient', selectSubRecipe: 'Select sub-recipe', searchDishes: 'Search dishes...', searchRecipes: 'Search recipes...', yourName: 'Your name', yourEmail: 'your@email.com', specialRequests: 'Allergies, baby chair, special celebration...', allPlatforms: 'All Platforms', selectColumn: '— Select column —', addInstructions: 'Add any special instructions for this order...', actualQuantity: 'Actual quantity...', confirmWaste: 'Confirm Waste', searchCategory: 'Search recipe or category...' },
    es: { continue: 'Continuar', product: 'Producto', reason: 'Motivo', notesOptional: 'Notas (opcional)...', stock: 'Stock', units: 'unidades', role: 'Rol', local: 'Local', selectLocal: 'Seleccionar local', writeMessage: 'Escribe el mensaje para tu equipo...', searchTeammate: 'Buscar compañero/a...', selectEmployee: 'Seleccionar empleado', severity: 'Severidad', whatHappened: '¿Qué ha ocurrido durante el turno?', selectIngredient: 'Seleccionar ingrediente', selectSubRecipe: 'Seleccionar sub-receta', searchDishes: 'Buscar platos...', searchRecipes: 'Buscar recetas...', yourName: 'Tu nombre', yourEmail: 'tu@email.com', specialRequests: 'Alergias, silla para bebé, celebración especial...', allPlatforms: 'Todas las plataformas', selectColumn: '— Seleccionar columna —', addInstructions: 'Añade instrucciones especiales para este pedido...', actualQuantity: 'Cantidad real...', searchCategory: 'Buscar receta o categoría...' },
    ca: { continue: 'Continuar', product: 'Producte', reason: 'Motiu', notesOptional: 'Notes (opcional)...', stock: 'Stock', units: 'unitats', role: 'Rol', local: 'Local', selectLocal: 'Seleccionar local', writeMessage: 'Escriu el missatge per al teu equip...', searchTeammate: 'Buscar company/a...', selectEmployee: 'Seleccionar empleat', severity: 'Severitat', whatHappened: 'Què ha passat durant el torn?', selectIngredient: 'Seleccionar ingredient', selectSubRecipe: 'Seleccionar sub-recepta', searchDishes: 'Buscar plats...', searchRecipes: 'Buscar receptes...', yourName: 'El teu nom', yourEmail: 'el-teu@email.com', specialRequests: 'Al·lèrgies, cadira de bebè, celebració especial...', allPlatforms: 'Totes les plataformes', selectColumn: '— Seleccionar columna —', addInstructions: 'Afegeix instruccions especials per a aquesta comanda...', actualQuantity: 'Quantitat real...', searchCategory: 'Buscar recepta o categoria...' },
    de: { continue: 'Weiter', product: 'Produkt', reason: 'Grund', notesOptional: 'Notizen (optional)...', stock: 'Bestand', units: 'Einheiten', role: 'Rolle', local: 'Lokal', selectLocal: 'Standort auswählen', writeMessage: 'Schreibe eine Nachricht an dein Team...', searchTeammate: 'Kollege/in suchen...', selectEmployee: 'Mitarbeiter auswählen', severity: 'Schweregrad', whatHappened: 'Was ist während der Schicht passiert?', selectIngredient: 'Zutat auswählen', selectSubRecipe: 'Unterrezept auswählen', searchDishes: 'Gerichte suchen...', searchRecipes: 'Rezepte suchen...', yourName: 'Dein Name', yourEmail: 'deine@email.de', specialRequests: 'Allergien, Kinderstuhl, besonderer Anlass...', allPlatforms: 'Alle Plattformen', selectColumn: '— Spalte auswählen —', addInstructions: 'Besondere Anweisungen für diese Bestellung hinzufügen...', actualQuantity: 'Tatsächliche Menge...', searchCategory: 'Rezept oder Kategorie suchen...' },
    fr: { continue: 'Continuer', product: 'Produit', reason: 'Raison', notesOptional: 'Notes (optionnel)...', stock: 'Stock', units: 'unités', role: 'Rôle', local: 'Local', selectLocal: 'Sélectionner local', writeMessage: 'Écrivez le message pour votre équipe...', searchTeammate: 'Chercher collègue...', selectEmployee: 'Sélectionner employé', severity: 'Sévérité', whatHappened: 'Que s\'est-il passé pendant le service ?', selectIngredient: 'Sélectionner ingrédient', selectSubRecipe: 'Sélectionner sous-recette', searchDishes: 'Chercher des plats...', searchRecipes: 'Chercher des recettes...', yourName: 'Votre nom', yourEmail: 'votre@email.com', specialRequests: 'Allergies, chaise bébé, célébration spéciale...', allPlatforms: 'Toutes les plateformes', selectColumn: '— Sélectionner colonne —', addInstructions: 'Ajoutez des instructions spéciales pour cette commande...', actualQuantity: 'Quantité réelle...', searchCategory: 'Chercher recette ou catégorie...' },
  },
  workforce: {
    en: { announcements: 'Announcements', sendAnnouncement: 'Send announcement', announcementSent: 'Announcement sent', announcementSentDesc: 'The message has been sent to the team', pinned: 'Pinned', teamChat: 'Team chat', recipients: 'Recipients', addMember: 'Add team member', memberAdded: 'Team member added', memberAddedDesc: 'successfully added to the team', shiftLog: 'Shift Log', shiftLogDesc: 'What happened during the shift?' },
    es: { announcements: 'Comunicados', sendAnnouncement: 'Enviar comunicado', announcementSent: 'Comunicado enviado', announcementSentDesc: 'El mensaje ha sido enviado al equipo', pinned: 'Fijado', teamChat: 'Chat de equipo', recipients: 'Destinatarios', addMember: 'Añadir miembro', memberAdded: 'Miembro añadido', memberAddedDesc: 'añadido al equipo correctamente', shiftLog: 'Registro de turno', shiftLogDesc: '¿Qué ha ocurrido durante el turno?' },
    ca: { announcements: 'Comunicats', sendAnnouncement: 'Enviar comunicat', announcementSent: 'Comunicat enviat', announcementSentDesc: 'El missatge ha estat enviat a l\'equip', pinned: 'Fixat', teamChat: 'Xat d\'equip', recipients: 'Destinataris', addMember: 'Afegir membre', memberAdded: 'Membre afegit', memberAddedDesc: 'afegit a l\'equip correctament', shiftLog: 'Registre de torn', shiftLogDesc: 'Què ha passat durant el torn?' },
    de: { announcements: 'Ankündigungen', sendAnnouncement: 'Ankündigung senden', announcementSent: 'Ankündigung gesendet', announcementSentDesc: 'Die Nachricht wurde an das Team gesendet', pinned: 'Angeheftet', teamChat: 'Team-Chat', recipients: 'Empfänger', addMember: 'Teammitglied hinzufügen', memberAdded: 'Teammitglied hinzugefügt', memberAddedDesc: 'erfolgreich zum Team hinzugefügt', shiftLog: 'Schichtprotokoll', shiftLogDesc: 'Was ist während der Schicht passiert?' },
    fr: { announcements: 'Annonces', sendAnnouncement: 'Envoyer annonce', announcementSent: 'Annonce envoyée', announcementSentDesc: 'Le message a été envoyé à l\'équipe', pinned: 'Épinglé', teamChat: 'Chat d\'équipe', recipients: 'Destinataires', addMember: 'Ajouter membre', memberAdded: 'Membre ajouté', memberAddedDesc: 'ajouté à l\'équipe avec succès', shiftLog: 'Journal de service', shiftLogDesc: 'Que s\'est-il passé pendant le service ?' },
  },
  recipes: {
    en: { example: 'E.g.: Pasta Carbonara', selectIngredient: 'Select ingredient', selectSubRecipe: 'Select sub-recipe' },
    es: { example: 'Ej: Pasta Carbonara', selectIngredient: 'Seleccionar ingrediente', selectSubRecipe: 'Seleccionar sub-receta' },
    ca: { example: 'Ex: Pasta Carbonara', selectIngredient: 'Seleccionar ingredient', selectSubRecipe: 'Seleccionar sub-recepta' },
    de: { example: 'Z.B.: Pasta Carbonara', selectIngredient: 'Zutat auswählen', selectSubRecipe: 'Unterrezept auswählen' },
    fr: { example: 'Ex: Pâtes Carbonara', selectIngredient: 'Sélectionner ingrédient', selectSubRecipe: 'Sélectionner sous-recette' },
  },
  booking: {
    en: { yourName: 'Your name', phone: '+34 600 000 000', emailPlaceholder: 'your@email.com', specialRequests: 'Allergies, baby chair, special celebration...' },
    es: { yourName: 'Tu nombre', phone: '+34 600 000 000', emailPlaceholder: 'tu@email.com', specialRequests: 'Alergias, silla para bebé, celebración especial...' },
    ca: { yourName: 'El teu nom', phone: '+34 600 000 000', emailPlaceholder: 'el-teu@email.com', specialRequests: 'Al·lèrgies, cadira de bebè, celebració especial...' },
    de: { yourName: 'Dein Name', phone: '+49 170 000 000', emailPlaceholder: 'deine@email.de', specialRequests: 'Allergien, Kinderstuhl, besonderer Anlass...' },
    fr: { yourName: 'Votre nom', phone: '+33 6 00 00 00 00', emailPlaceholder: 'votre@email.com', specialRequests: 'Allergies, chaise bébé, célébration spéciale...' },
  },
  stockAudit: {
    en: { title: 'Stock Count', subtitle: 'Record and compare real stock', searchProduct: 'Search product...', selectProduct: 'Select product', actualQuantity: 'Actual quantity...', addToCount: 'Add to count', completeAudit: 'Complete audit', auditCompleted: 'Audit completed', variance: 'Variance', theoretical: 'Theoretical', counted: 'Counted' },
    es: { title: 'Conteo de Stock', subtitle: 'Registra y compara stock real', searchProduct: 'Buscar producto...', selectProduct: 'Seleccionar producto', actualQuantity: 'Cantidad real...', addToCount: 'Añadir al conteo', completeAudit: 'Completar auditoría', auditCompleted: 'Auditoría completada', variance: 'Desviación', theoretical: 'Teórico', counted: 'Contado' },
    ca: { title: 'Comptatge de Stock', subtitle: 'Registra i compara estoc real', searchProduct: 'Buscar producte...', selectProduct: 'Seleccionar producte', actualQuantity: 'Quantitat real...', addToCount: 'Afegir al comptatge', completeAudit: 'Completar auditoria', auditCompleted: 'Auditoria completada', variance: 'Desviació', theoretical: 'Teòric', counted: 'Comptat' },
    de: { title: 'Bestandsaufnahme', subtitle: 'Realen Bestand aufnehmen und vergleichen', searchProduct: 'Produkt suchen...', selectProduct: 'Produkt auswählen', actualQuantity: 'Tatsächliche Menge...', addToCount: 'Zur Zählung hinzufügen', completeAudit: 'Inventur abschließen', auditCompleted: 'Inventur abgeschlossen', variance: 'Abweichung', theoretical: 'Theoretisch', counted: 'Gezählt' },
    fr: { title: 'Inventaire', subtitle: 'Enregistrer et comparer le stock réel', searchProduct: 'Chercher produit...', selectProduct: 'Sélectionner produit', actualQuantity: 'Quantité réelle...', addToCount: 'Ajouter au comptage', completeAudit: 'Terminer l\'inventaire', auditCompleted: 'Inventaire terminé', variance: 'Écart', theoretical: 'Théorique', counted: 'Compté' },
  },
};

const LANGS = ['es','en','ca','de','fr'];
const DIR = 'src/i18n/locales';

for (const lang of LANGS) {
  const path = `${DIR}/${lang}.json`;
  const j = JSON.parse(readFileSync(path, 'utf-8'));
  let changed = false;
  
  for (const [sec, langMap] of Object.entries(missingKeys)) {
    const vals = langMap[lang];
    if (!vals) continue;
    if (!j[sec]) j[sec] = {};
    for (const [k,v] of Object.entries(vals)) {
      if (!j[sec][k]) {
        j[sec][k] = v;
        changed = true;
      }
    }
  }
  
  if (changed) {
    writeFileSync(path, JSON.stringify(j, null, 2) + '\n');
    console.log(`✅ Patched ${lang}.json`);
  } else {
    console.log(`⏭️ ${lang}.json already up to date`);
  }
}

console.log('\n🎉 All locale files updated!');
