---
description: Cargar contexto de una feature desde el vault de Obsidian antes de implementar
---

# Vault Context — Carga de Feature Spec

Ruta del vault: `C:\Users\oscar\josephine-vault`

// turbo-all

## Pasos

1. **Identificar la feature** que se va a trabajar (el usuario la menciona o se deduce del TODO)

2. **Leer el spec de la feature** desde el vault:
   - Ruta: `C:\Users\oscar\josephine-vault\features\<nombre-feature>.md`
   - Si no existe, avisar al usuario y ofrecer crearlo con el template

3. **Buscar business logic relacionada** en:
   - `C:\Users\oscar\josephine-vault\business\` — buscar por keywords de la feature
   - Usar grep_search para encontrar archivos relevantes

4. **Leer schema relevante** si aplica:
   - `C:\Users\oscar\josephine-vault\architecture\data-model.md`
   - `C:\Users\oscar\josephine-vault\architecture\supabase-rpcs.md`

5. **Presentar briefing**:

```
📋 **Feature Context Loaded**
- Feature: [nombre]
- Status: [draft/ready/implemented/needs_update]
- Reglas de negocio: [resumen de las reglas del spec]
- Fórmulas: [si hay]
- RPCs disponibles: [si hay]
- Dependencias: [si hay]
- Estado: [qué falta por implementar]
```

## Notas
- Si el spec dice `status: draft`, las reglas pueden cambiar — confirmar con el usuario
- Si el spec dice `status: ready`, implementar tal cual
- Si dice `needs_update`, preguntar qué ha cambiado antes de tocar código
