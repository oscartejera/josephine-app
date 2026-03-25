# Smoke Test Checklist — Josephine Team iOS

> Checklist manual pre-release. Ejecutar en dispositivo real o simulador antes de cada envío a TestFlight/App Store.

---

## 🔐 Auth

- [ ] Login con email + contraseña válidos → entra a Home
- [ ] Login con credenciales inválidas → muestra error inline
- [ ] Sesión persiste tras cerrar y reabrir app
- [ ] Sign Out desde Profile → vuelve a LoginView
- [ ] Campo contraseña toggle visibilidad funciona
- [ ] Teclado se descarta al pulsar fuera

---

## 🏠 Home

- [ ] Greeting dinámico según hora (Buenos días/tardes/noches)
- [ ] Banner fichaje muestra estado actual (activo/inactivo)
- [ ] Turno de hoy muestra datos correctos
- [ ] Próximos turnos lista los siguientes 3
- [ ] Noticias fijadas aparecen con badge "Fijada"
- [ ] Pull-to-refresh recarga datos

---

## ⏱️ Clock

- [ ] "Fichar Entrada" crea registro y arranca timer
- [ ] Timer muestra HH:MM:SS en tiempo real
- [ ] "Iniciar Descanso" abre picker de tipo
- [ ] Descanso activo muestra tipo + timer
- [ ] "Fin Descanso" cierra el break
- [ ] "Fichar Salida" cierra el registro
- [ ] Historial muestra registros del día

---

## 📅 Schedule

- [ ] Semana actual cargada por defecto
- [ ] Flechas ◀ ▶ navegan semanas correctamente
- [ ] Día seleccionado muestra detalle de turno
- [ ] Día libre muestra "Día libre"
- [ ] Botón "Solicitar Cambio" abre SwapRequestSheet
- [ ] SwapRequestSheet envía solicitud con razón
- [ ] SwapRequestSheet muestra ✓ success tras envío
- [ ] Botón "Disponibilidad" abre AvailabilityView
- [ ] AvailabilityView muestra grid 7 días
- [ ] Toggle disponibilidad + horarios funciona

---

## 💰 Pay

- [ ] Lista períodos de nómina con fechas
- [ ] Detalle muestra desglose correcto
- [ ] Pull-to-refresh recarga

---

## 👤 Profile

- [ ] Nombre y ubicación correctos
- [ ] Filas de información (email, rol, departamento)
- [ ] "Notificaciones" navega a settings
- [ ] "Cerrar Sesión" pide confirmación y cierra sesión

---

## 📰 News

- [ ] Lista de anuncios cargada
- [ ] Icono de tipo correcto (📰 noticia, 📅 evento, 📋 política)
- [ ] Anuncios fijados tienen badge
- [ ] Tap en anuncio muestra detalle completo

---

## 🔔 Push Notifications

- [ ] Permiso de notificaciones solicitado en primer login
- [ ] Push de cambio de turno llega y navega a Schedule
- [ ] Push de nuevo anuncio llega y navega a News
- [ ] Token se registra en `device_tokens` de Supabase

---

## ⚡ Realtime

- [ ] Cambio de turno en web → Schedule se actualiza en iOS
- [ ] Nuevo anuncio en web → News se actualiza en iOS
- [ ] Clock in/out en otro dispositivo → ClockView refleja cambio

---

## 📶 Offline / Cache

- [ ] App abre sin conexión con datos cacheados
- [ ] Turnos, nóminas y noticias visibles offline
- [ ] Acciones de escritura muestran error graceful sin red

---

## ♿ Accessibility

- [ ] VoiceOver navega todos los tabs
- [ ] Botones tienen labels descriptivos en español
- [ ] Iconos decorativos están ocultos para VoiceOver
- [ ] Elementos combinados se leen como una unidad

---

## 📱 Device Compatibility

- [ ] iPhone SE (pantalla pequeña) — layout no se rompe
- [ ] iPhone 16 Pro Max (pantalla grande) — layout aprovecha espacio
- [ ] Dynamic Type (texto grande) — UI escala correctamente
- [ ] Dark Mode (único tema) — colores correctos

---

## ✅ Result

| Área | Pass/Fail | Notas |
|------|-----------|-------|
| Auth | | |
| Home | | |
| Clock | | |
| Schedule | | |
| Pay | | |
| Profile | | |
| News | | |
| Push | | |
| Realtime | | |
| Offline | | |
| Accessibility | | |
| Devices | | |

**Tester**: _______________  
**Fecha**: _______________  
**Build**: _______________  
**Resultado**: ⬜ PASS / ⬜ FAIL
