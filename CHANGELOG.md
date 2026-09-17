# Changelog — voyya-shared

Formato basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.0.0/). Fechas en AAAA-MM-DD.

## [Sin publicar] — 2026-09-16 · Ciclo "Viaje en curso y cobro en efectivo"

Contrato consumido hoy como copia sincronizada por `voyya-backend`, `voyya-mobile` y `voyya-admin` (`workspace:*`
en los cuatro repos); todavía no se publica como paquete `@voyyaa/shared` en GitHub Packages.

### Agregado

- `contracts/driver.ts` (nuevo archivo): `DriverStatus` (movido desde `contracts/assignment.ts`),
  `UpdateDriverShiftDTO`, `ReportDriverLocationDTO`, `DriverShiftState`, `DriverTripView`, `DriverHomeState`,
  `TripTransitionResult`, `CompleteTripDTO`, `PendingCashTrip`, `PendingCashTripsResponse`,
  `DriverErrorCode`, `DriverError`.
- `contracts/trips.ts`: `AmountCop` exportado (antes era un `const` privado); `PassengerUiState` ampliado a
  12 valores (`driver_waiting`, `trip_in_progress`, `trip_completed`, `trip_no_show`, `trip_cancelled`,
  `out_of_coverage`, `offline`, entre otros); `TripRequestStatus.arrived_at`; `TripErrorCode` +=
  `INVALID_TRIP_TRANSITION`, `NOT_THE_DRIVER`, `NO_ACTIVE_ASSIGNMENT`, `ARRIVAL_NOT_MARKED`,
  `NO_SHOW_GRACE_PENDING`; `TripError.remaining_seconds` (opcional); `TRIPS_EVENTS` +=
  `TRIP_REQUEST_COMPLETED`, `TRIP_REQUEST_NO_SHOW` con sus esquemas de evento.
- `contracts/assignment.ts`: `AssignmentCancelledByDriverEvent.trip_request_status: TripStatus`.

### Cambiado

- `contracts/assignment.ts` deja de definir `DriverStatus`; lo reexporta desde `./driver` para no romper a
  quien lo importaba de ahí. Orden de dependencias entre contratos, ahora explícito y acíclico:
  `trips ← driver ← assignment`.
- `index.ts`: añade `export * from './contracts/driver'` antes de `assignment`.

### Sin cambios

- `TripStatus` y `TRIP_STATUS_TRANSITIONS` **no se tocan** — la máquina de estados del viaje seguía siendo
  correcta; lo que faltaba era quién ejecutaba cada transición (resuelto en `voyya-backend`, ver su
  changelog).
- `voyya-admin/src/contracts/auth.ts` no cambia: la consola todavía solo consume el dominio `auth`.
