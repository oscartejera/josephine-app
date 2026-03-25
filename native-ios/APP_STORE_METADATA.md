# App Store Metadata — Josephine Team

> Copy listo para App Store Connect. Rellenar campos marcados con `[TBD]`.

---

## Identidad

| Campo | Valor |
|-------|-------|
| **App Name** | Josephine Team |
| **Subtitle** | Gestión de turnos y fichajes |
| **Bundle ID** | `com.josephine.team-staff` |
| **SKU** | `josephine-team-staff-ios` |
| **Primary Language** | Spanish (Spain) |
| **Category** | Business |
| **Secondary Category** | Productivity |

---

## Keywords (100 caracteres max)

```
turnos,fichaje,horarios,empleados,hostelería,restaurante,equipo,planificación,nómina,descansos
```

---

## Description (ES — 4000 char max)

```
Josephine Team es la app oficial para el equipo de Josephine. Gestiona tus turnos, ficha entrada y salida, solicita cambios de turno y consulta tus nóminas — todo desde tu iPhone.

FICHAJE RÁPIDO
• Ficha entrada y salida con un toque
• Registra descansos con tipo (comida, café, personal)
• Timer en tiempo real de tu jornada activa

TURNOS Y PLANIFICACIÓN
• Consulta tu calendario semanal de turnos
• Visualiza turnos pasados, actuales y futuros
• Solicita intercambio de turno con compañeros
• Configura tu disponibilidad semanal

NÓMINAS
• Consulta tus períodos de nómina
• Revisa detalles de pagos anteriores

NOTICIAS DEL EQUIPO
• Recibe anuncios importantes del restaurante
• Diferencia entre noticias, eventos y políticas
• Las noticias fijadas aparecen primero

NOTIFICACIONES PUSH
• Recibe alertas de cambios de turno en tiempo real
• Notificaciones de nuevos anuncios
• Actualización instantánea cuando se aprueba un cambio

DISEÑADO PARA HOSTELERÍA
• Interfaz oscura optimizada para uso rápido
• Tipografía clara y accesible (Plus Jakarta Sans)
• Soporte completo VoiceOver
• Funciona offline con datos en caché
```

---

## Promotional Text (170 char — editable sin review)

```
Gestiona turnos, ficha y consulta nóminas desde tu iPhone. Diseñada para equipos de hostelería.
```

---

## What's New (versión 1.0.0)

```
Primera versión de Josephine Team:
• Fichaje de entrada/salida con descansos
• Calendario de turnos semanal
• Solicitud de intercambio de turno
• Gestión de disponibilidad
• Consulta de nóminas
• Noticias del equipo con push notifications
• Soporte VoiceOver completo
```

---

## URLs

| Campo | Valor |
|-------|-------|
| **Support URL** | `[TBD]` — e.g. `https://josephine.app/support` |
| **Marketing URL** | `[TBD]` — e.g. `https://josephine.app` |
| **Privacy Policy URL** | `[TBD]` — **obligatorio** para App Store |

---

## Content Rating Questionnaire

| Pregunta | Respuesta |
|----------|-----------|
| Cartoon or Fantasy Violence | None |
| Realistic Violence | None |
| Prolonged Graphic or Sadistic Realistic Violence | None |
| Profanity or Crude Humor | None |
| Mature/Suggestive Themes | None |
| Horror/Fear Themes | None |
| Medical/Treatment Information | None |
| Alcohol, Tobacco, or Drug Use or References | None |
| Simulated Gambling | None |
| Sexual Content or Nudity | None |
| Contests | None |
| Unrestricted Web Access | None |

**Rating resultante esperado**: 4+ (All Ages)

---

## Screenshots (requeridos)

| Device | Resolución | Cantidad mínima |
|--------|-----------|-----------------|
| iPhone 6.7" (15 Pro Max) | 1290 × 2796 | 3 |
| iPhone 6.5" (11 Pro Max) | 1242 × 2688 | 3 |
| iPhone 5.5" (8 Plus) | 1242 × 2208 | 3 (si soportas <iPhone X) |

**Screens sugeridas**:
1. HomeView — greeting + turno de hoy + banner fichaje
2. ClockView — timer activo + botón fichar
3. ScheduleView — calendario semanal con turnos
4. ProfileView — datos del empleado
5. NewsView — lista de anuncios

> [!IMPORTANT]
> Los screenshots se generan desde el simulador o dispositivo real. Usar `⌘+S` en el simulador.

---

## App Icon

- Ya existe en `Resources/Assets.xcassets/AppIcon.appiconset/`
- 1024×1024 PNG sin transparencia ni esquinas redondeadas
- Codemagic ya lo incluye en el build (`ASSETCATALOG_COMPILER_APPICON_NAME = AppIcon`)

---

## Review Notes (para el reviewer de Apple)

```
Esta app es para uso interno del equipo de Josephine (restaurante).
Los empleados reciben credenciales del manager.
Demo account: [TBD — crear cuenta demo si Apple lo requiere]
```
