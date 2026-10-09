# Changelog — voyya-shared

Formato basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.0.0/). Fechas en AAAA-MM-DD.

Versionado: antes de 1.0, la **minor** señala una ruptura de contrato (ADR-012 §8, criterio aplicado desde 0.3.0)
y la **patch**, un endurecimiento o un valor nuevo que no rompe a nadie. Cada versión se propaga por el
guardarraíl 5: copia literal a `voyya-backend/packages/shared` y `voyya-mobile/packages/shared`, y el pin de
`voyya-admin` sube cuando la etiqueta `vX.Y.Z` está publicada en GitHub Packages (ADR-016).

> Las entradas 0.2.0 a 0.7.0 se **reconstruyeron el 2026-10-08** a partir de los ADRs dueños de cada contrato,
> porque este archivo se quedó en el ciclo del viaje en curso. Donde el ADR no detalla el cambio, se dice.

## [0.9.1] — 2026-10-09 · Hotfix F-02: detalle de PostgreSQL fuera de los logs y de Sentry (sin etiquetar todavía)

Origen: ADR-033 §1.5 (C-2) y §8.0, paso 0. Patch: no cambia ningún tipo ni esquema; endurece el comportamiento de
`redactPii` y `redactPiiDeep` en `domain/pii.ts`.

### Cambia
- `redactPii` quita el detalle de PostgreSQL que Prisma copia en los errores de restricción: `Failing row contains (…)` pasa a
  `Failing row contains ([redacted])`, `Key (…)=(…)` pasa a `Key ([redacted])=([redacted])` y las líneas `DETAIL: …` pasan a
  `DETAIL: [redacted]`. Se detienen en el fin de línea o en un `
` escapado de un JSON, para no comerse el `stack`.
- `redactPiiDeep` ahora recorre también las instancias de `Error` (`name`, `message`, `stack` y propiedades propias, como
  `meta`) y deja intactos los objetos que no son planos (`Date`, `Buffer`…), que antes se convertían en `{}`.

## [0.9.0] — 2026-10-08 · Varias empresas por municipio, tipo de servicio y catálogo DANE (sin etiquetar todavía)

Origen: ADR-032 §7 (dueño del archivo nuevo `service-config.ts` y de los símbolos de `trips.ts` que cambia) y ADR-031 §6
(integrado). Minor: hay dos rupturas de contrato (abajo). Orden de despliegue: **primero la API, después la consola y el
móvil**; no se publica una consola 0.8.1 contra la API 0.9.0 ni una 0.9.0 contra la API anterior. `POST
/assignments/:id/accept` conserva la respuesta 200 `{ result: 'already_taken' }` (MD-19).

### Rompe

- `contracts/affiliation.ts`: `ApproveCompanyDTO.commission_pct` pasa a **obligatorio** (`CommissionPct`, 0 a 50) y
  `initial_fare` a opcional. Una consola 0.8.1 que aprueba recibe 400.
- `contracts/affiliation.ts`: `CompanyProvisioningResult.fare_config_id` pasa a `nullable` (siempre `null`). Una consola
  0.8.1 falla al validar la respuesta de aprobar.
- Los productores (backend) deben rellenar los campos nuevos y obligatorios de las respuestas: `TripRequestStatus`
  (`service_type`, `requested_company`), `AssignedDriverSummary.company`, `ConsoleSettings`, `CompanyProfile`,
  `PlatformCompanyRow`, `PlatformCompanyDetail`, `AffiliationMunicipality` y `AffiliationMunicipalityListResponse`.

### Agregado

- `contracts/trips.ts`: `ActivatableServiceType` (`taxi`, `comfort`, `delivery`; `motorcycle` imposible),
  `ActiveServiceTypes`, `CompanyPublicName` (2 a 60), `CompanyRef`, `TripServiceOptionsQuery`, `TripCompanyOption`,
  `TripServiceOption`, `TripServiceMunicipality`, `TripServiceOptionsResponse`, `CreateTripRequestDTO.requested_company_id`
  (opcional o `null` = "Cualquiera"), `TripRequestStatus.service_type` y `requested_company`, `AssignedDriverSummary.company`,
  y `TripErrorCode` += `SERVICE_NOT_AVAILABLE`, `COMPANY_NOT_AVAILABLE`.
- `contracts/service-config.ts` (archivo nuevo, exportado en `index.ts`): tarifa del municipio versionada
  (`MunicipalityFare`, `MunicipalityFareHistory`, `UpdateMunicipalityFareDTO`, `OfficialReference`), parámetros del municipio
  (`OperationalParamsValues`, `MunicipalityOperationalParams`, su historial y `UpdateMunicipalityOperationalParamsDTO`),
  comisión por empresa (`CompanyCommission`, su historial, `UpdateCompanyCommissionDTO`, `PlatformCommissionRow` y su lista),
  `PlatformServiceConfigRow` y su lista, `ServiceConfigErrorCode` y `ServiceConfigError`.
- `contracts/admin.ts`: `CommissionPct` (0 a 50, paso 0,01), `ConsoleSettings` ampliado y de solo lectura
  (`read_only: true`, `service_type`, marca oficial, los nueve parámetros) y `AdminErrorCode` += `SETTINGS_MANAGED_BY_PLATFORM`.
- `contracts/affiliation.ts`: `DaneCode`, `MunicipalityCatalogSource`, `AffiliationMunicipality` (`dane_code`,
  `department_code`, `has_active_companies`, `coverage_active`), `AffiliationMunicipalityListResponse` (`source`,
  `active_service_types`), `CreateAffiliationApplicationDTO` (`public_name`, `service_types` por defecto `['taxi']`, sin
  repetidos), `CompanyProfile` y `PlatformCompanyRow` (`display_name`, `service_types`, cobertura, `coverage_pending_since`),
  `PlatformCompanyDetail` (`public_name`, empresas activas del municipio, tarifas, comisión), `PlatformCompanyQuery.municipality_id`,
  `CompanyProvisioningResult` (`municipality_fares`, `company_commission_id`), `CompanyDecisionResponse.municipality_coverage_active`,
  `AffiliationErrorCode` += `SERVICE_NOT_AVAILABLE` y `PlatformErrorCode` += `MUNICIPALITY_FARE_REQUIRED`, `SERVICE_NOT_AVAILABLE`.

### Cambiado

- `QuoteFareDTO.service_type` y `CreateTripRequestDTO.service_type` pasan a `ActivatableServiceType`: `motorcycle` responde 400
  en la validación (MD-17). Ningún cliente lo enviaba.
- `ApproveCompanyInitialFare` pierde `commission_pct` y `ApproveCompanyDTO` pierde `acknowledge_routing_limitation`
  (no rompe: el pipe de validación no es estricto).

### Obsoleto (se retira en 1.0)

- `FareBreakdown.commission` vale 0 en las respuestas al pasajero; `AffiliationMunicipality.already_covered`;
  `PlatformCompanyRow.municipality_already_covered`; `PlatformCompanyDetail.municipality_active_company_name`;
  `CompanyDecisionResponse.acknowledged_routing_limitation` (siempre `false`); `PlatformErrorCode.MUNICIPALITY_ALREADY_COVERED`
  (ya no se emite); `UpdateConsoleSettingsDTO` (el endpoint responde 403).

### Pruebas

- Primeras pruebas de contrato del paquete: `src/contracts.test.ts` con el ejecutor nativo de Node (`pnpm test`).

## [0.8.1] — 2026-10-08 · Remediación de la Verificación del "Cierre del MVP" (sin etiquetar todavía)

Origen: prueba integrada (BUG-1, BUG-4) y `docs/security/reporte-cierre-mvp.md` (CM-10, CM-11). Dueños: ADR-030
(enmienda), ADR-027 (enmienda), ADR-029 (enmienda 2), ADR-023 (`pii.ts`). Patch: ningún consumidor pierde un
campo ni un valor; los productores (backend) **deben** rellenar los dos campos nuevos de `TripRequestStatus`
(el tipo no compila sin ellos). Orden de despliegue: backend antes que las apps, que parsean la respuesta.

### Agregado

- `contracts/trips.ts`: `TripRequestStatus.free_cancellation_until` (`string | null`, ISO-8601 UTC) y
  `TripRequestStatus.server_time` (ISO-8601 UTC). También los recibe `ActiveTripResponse.active_trip`. Regla en
  ADR-030, enmienda 2026-10-08 (BUG-1).
- `contracts/admin.ts`: `AdminErrorCode` += `SETTLEMENT_WEEK_IN_PROGRESS` (`409` al marcar como remitida una
  semana que no ha terminado; ADR-027, enmienda 2026-10-08, BUG-4).
- `contracts/auth.ts`: `AuthErrorCode` += `INVALID_DATA` (lo emitía ya `ZodValidationPipe`); `ValidationIssue`
  (`{ field, error }`, `field` puede ser `''` en un refine de raíz) y `AuthError.details` (opcional, solo en
  `INVALID_DATA`). Sustituye el esquema local que la app del conductor usaba para leer el 400.

### Cambiado

- `contracts/location-notice.ts` (CM-11): en la fila «Qué usamos» de **ambas** audiencias, "La ubicación
  aproximada de tu teléfono (unos 100 metros)" pasa a "La ubicación de tu teléfono, con una precisión de hasta
  100 metros". Nada más cambia en el texto. **`LOCATION_NOTICE_VERSION` sigue en `location-notice-v2`**:
  ninguna base de producción ha registrado v2 (ADR-029, enmienda 2). Consecuencia: toda base de desarrollo o
  prueba que ya arrancó la API con 0.8.0 tiene la huella vieja de v2 y **el arranque fallará** hasta
  recrearla (`docs/VoyYa/16-deploy.md`, Paso 1, nota CM-11).
- `contracts/location-notice.ts`: Datos del Responsable (D-4) completados; NIT en trámite. `DATA_CONTROLLER`
  pasa a `tax_id: 'en trámite'`, `address: 'Calle 38B Sur # 45B-31'`, `privacy_email:
  'jhonnier98t@gmail.com'`, `privacy_policy_url: 'https://www.voyya.website/privacy-policy'`;
  `hasLegalPlaceholders` es falso en ambas audiencias. Sigue en `location-notice-v2`; el primer arranque en
  producción con 0.8.1 la fija, y el NIT definitivo exigirá `location-notice-v3` (ADR-029, enmienda 2).

### Corregido

- `domain/pii.ts` (CM-10): `LABELLED_ID` amplía etiquetas (`national_id`/`nationalId`, `current_pin`/
  `currentPin`, `new_pin`/`newPin`, `CC`, `C.C.`) y acepta valores en grupos de dígitos separados por un
  espacio (`71 000 001`, `48 29 13`). Se conservan las reglas de 0.8.0: separador explícito, valor con al menos
  un dígito, nunca detrás de `/` o `.`, y un valor aislado de menos de 3 caracteres no se tacha. El fin de la
  etiqueta pasa de `\b` a `(?![A-Za-z0-9_])` para que `C.C.` funcione; un grupo de dígitos solo se suma al valor
  si termina limpio (no se come el año de `2026-10-08`).

#### Casos de `redactPii` (0.8.1) — `pruebas` los convierte en aserciones exactas

| Entrada | Salida | Por qué |
|---|---|---|
| `national_id=71000001` | `national_id=[redacted]` | etiqueta nueva |
| `{"national_id":"71000001"}` | `{"national_id":"[redacted]"}` | separador con comillas |
| `nationalId: 71000001` | `nationalId: [redacted]` | variante camelCase |
| `current_pin=482913&new_pin=591027` | `current_pin=[redacted]&new_pin=[redacted]` | etiquetas nuevas; `&` corta el valor |
| `{"current_pin":"482913","new_pin":"591027"}` | `{"current_pin":"[redacted]","new_pin":"[redacted]"}` | |
| `new_pin 482913` | `new_pin [redacted]` | separador espacio |
| `CC 71000001` | `CC [redacted]` | etiqueta nueva |
| `C.C. 71.000.001` | `C.C. [redacted]` | etiqueta con puntos |
| `cédula 71 000 001` | `cédula [redacted]` | grupos de dígitos con espacio |
| `pin: 48 29 13` | `pin: [redacted]` | grupos de dígitos con espacio |
| `Cédula: 71 000 001 registrada` | `Cédula: [redacted] registrada` | la palabra siguiente no se come |
| `pin=482913 2026-10-08` | `pin=[redacted] 2026-10-08` | el grupo `2026` no termina limpio |
| `VoyYa · PIN 482913. Ingresa con tu número de cédula y este PIN.` | `VoyYa · PIN [redacted] Ingresa con tu número de cédula y este PIN.` | sin cambio respecto de 0.8.0 |
| `{route: /pin POST}` | sin cambios | detrás de `/`; `POST` sin dígitos (corrección de 0.8.0) |
| `POST /auth/driver/pin} 403` | sin cambios | detrás de `/` |
| `/admin/drivers/5/pin/resend` | sin cambios | detrás de `/` y sin separador |
| `{"field":"new_pin","error":"El PIN debe tener 6 dígitos"}` | sin cambios | sin separador tras `new_pin`; "debe" sin dígitos |
| `pin_delivered_at=2026-10-08` | sin cambios | `pin_` no termina la etiqueta |
| `pin_must_change=true` | sin cambios | ídem |
| `access 2026` | sin cambios | `cc` dentro de palabra |
| `pin 12` | sin cambios | valor aislado de 2 caracteres |
| `pin 12 veces` | sin cambios | `veces` no es grupo de dígitos |
| `licencia vencida 2026` | sin cambios | el valor que sigue (`vencida`) no tiene dígitos |
| `PIN [redacted]` | sin cambios | idempotente |
| `assignment=412 fare=8000` | sin cambios | sin etiqueta (ADR-023) |
| `driver.national_id=71000001` | **sin cambios** | límite conocido: detrás de `.` no se dispara (regla de 0.8.0). Ese caso es un objeto, y lo cubre `REDACT_KEYS` de pino, no esta regla |

## [0.8.0] — 2026-10-08 · Ciclo "Cierre del MVP" (sin etiquetar todavía)

Dueños: ADR-027 (conciliación), ADR-028 (PIN), ADR-029 (consentimiento y retención), ADR-030 (viaje activo).
Diseño consolidado en `docs/specs/diseno-cierre-mvp.md`. **Rompe** contratos: por eso es minor.

### Agregado

- `contracts/location-notice.ts` (archivo nuevo): texto canónico del aviso de ubicación por audiencia
  (`LOCATION_NOTICES`, `canonicalLocationNoticeText`), datos del Responsable con marcadores (`DATA_CONTROLLER`),
  `TRIP_COORDINATES_RETENTION_DAYS = 90`, `DRIVER_LOCATION_RETENTION_MAX_HOURS = 13`, `hasLegalPlaceholders`.
- `contracts/consent.ts`: `NoticeAudience`, `RevokeConsentDTO`, `ConsentState`, `ConsentStatus`,
  `ConsentStatusListResponse`, `ConsentErrorCode` (`NOTICE_VERSION_UNKNOWN`, `NOTICE_AUDIENCE_NOT_ALLOWED`),
  `ConsentError`, `CONSENT_EVENTS.CONSENT_REVOKED` y `ConsentRevokedEvent`.
- `contracts/auth.ts`: `DRIVER_PIN_LENGTH = 6`, `NewDriverPin`, `ChangeDriverPinDTO`, `isWeakDriverPin`,
  `isPinFromPersonalData`, `JwtAccessPayload.pin_change_required`, `SessionUser.pin_change_required`
  (por defecto `false`), `AuthErrorCode` += `PIN_CHANGE_REQUIRED`, `TEMPORARY_PIN_EXPIRED`, `PIN_TOO_WEAK`;
  `DRIVER_CREDENTIALS_RESET_EVENT` y `DriverCredentialsResetEvent`.
- `contracts/trips.ts`: `ActiveTripRef`, `ActiveTripResponse`, `TripError.active_trip` (opcional; lo lleva el
  409 `ACTIVE_TRIP_REQUEST_EXISTS`).
- `contracts/driver.ts`: `DriverErrorCode` += `LOCATION_CONSENT_REQUIRED`.
- `contracts/admin.ts`: `CalendarDate`, `isCalendarDate`, `addDays`, `daysBetween`, `isMonday`, `weekStartOf`,
  `SETTLEMENT_TIME_ZONE`, `SETTLEMENT_MAX_RANGE_DAYS = 31`, `settlementToday`, `settlementWeekOf`,
  `SettlementRemittanceSummary`, `SETTLEMENT_CSV_COLUMNS`, `SETTLEMENT_CSV_CONTENT_TYPE`, `RemittanceEntryKind`,
  `SettlementWeekStart`, `RecordRemittanceDTO`, `RemittanceActor`, `SettlementRemittanceEntry`,
  `RemittanceResult`, `RemittanceHistoryQuery`, `RemittanceHistoryResponse`, `DriverPinStatus`;
  `OpsDriverRow.pin_status` y `OpsDriverRow.temporary_pin_expires_at`; `CreatedDriver` y
  `ResendDriverPinResponse` ganan `temporary_pin_expires_at`; `AdminErrorCode` += `DRIVER_HAS_ACTIVE_TRIP`
  (el backend ya lo emitía; la consola lo detectaba por el 409), `NOTHING_TO_REMIT`,
  `SETTLEMENT_BALANCE_CHANGED`, `REMITTANCE_NOT_FOUND`, `REMITTANCE_NOT_REVERSIBLE`.
- `index.ts`: `export * from './contracts/location-notice';`.

### Cambiado (rompe)

- `contracts/admin.ts`: `SettlementReportQuery` pierde `status` y valida rango (desde ≤ hasta, máximo 31 días,
  fechas existentes). `SettlementReportRow` pierde `total_cash_income` y `membership_fee_due` (D-1: no hay cuota
  fija) y gana `cash_collected`, `commission`, `driver_net`, `amount_to_remit`, `pending_cash_trip_count`,
  `pending_cash_amount`, `remittance`. `SettlementReportTotals` igual, más `remitted_amount` y
  `remittance_balance`. `SettlementReportResponse` gana `time_zone`, `week_start` e `in_progress`.
- `contracts/admin.ts`: `OpsTripDetail.pickup_address` y `dropoff_address` pasan a `nullable` (purga a 90 días).
- `contracts/driver.ts`: `PendingCashTrip.dropoff_address` pasa a `nullable` (misma razón).
- `contracts/consent.ts`: `LOCATION_NOTICE_VERSION` sube a `location-notice-v2`; `ConsentRecord` y
  `ConsentListResponse` se sustituyen por `ConsentStatus` y `ConsentStatusListResponse` (`GET /consents`
  devuelve estado, no asientos).

### Corregido

- `domain/pii.ts`: `LABELLED_ID` tachaba rutas y palabras (`/pin POST}` → `pin [redacted]`). Ahora exige un
  separador explícito (`:`, `=`, `#`, con comillas opcionales, o espacio), un valor que **contenga un dígito**, y
  no se dispara si la etiqueta viene detrás de `/` o `.`. Casos en ADR-023 (nota de 2026-10-08) y en
  `docs/specs/diseno-cierre-mvp.md` §3.

## [0.7.0] — 2026-09-25 · Observabilidad (ADR-023)

### Agregado

- `domain/pii.ts` (archivo nuevo): `redactPii` y `redactPiiDeep`, únicos responsables de tachar PII en logs y
  en eventos de Sentry. Minor aditivo.

## [0.6.0] — 2026-09-25 · Notificación push al conductor (ADR-022)

### Agregado

- `contracts/push.ts` (archivo nuevo): registro y revocación del token de dispositivo, payload de la
  notificación de oferta (`PushNotificationData`, unión discriminada) y `ANDROID_ASSIGNMENT_CHANNEL_ID`.
  Minor aditivo.

## [0.5.1] · [0.5.2] — 2026-09 · Remediación del ciclo de afiliación

Parches sin ADR propio (remediaciones de Verificar del ciclo de afiliación). Ningún ADR lista su contenido
símbolo a símbolo; lo que consta en `docs/security/reporte-afiliacion-empresas.md` es el código
`DOCUMENT_STORAGE_UNAVAILABLE` (503 de almacenamiento de documentos) en `admin.ts` y `affiliation.ts`. El
detalle exacto vive en el historial git de este repositorio.

## [0.5.0] — 2026-09-18 · Afiliación de empresas (ADR-021)

### Agregado

- `contracts/documents.ts` y `contracts/affiliation.ts` (archivos nuevos): carga de documentos, solicitud de
  afiliación, revisión de la plataforma y `CompanyDecision` (incluye `credentials_reissued`).
- `contracts/auth.ts`: `Role` gana `platform_admin` (fuera de `TENANT_SCOPED_ROLES`).
- `contracts/admin.ts`: documentos del conductor en el alta, `FleetQuota` y sus códigos de error.

### Cambiado (rompe)

- `CreateDriverDTO` exige `documents`.

## [0.4.0] — 2026-09-18 · Geolocalización de las apps (ADR-019)

### Agregado

- `contracts/consent.ts` (archivo nuevo): `ConsentPurpose`, `NoticeVersion`, `LOCATION_NOTICE_VERSION`,
  `GrantConsentDTO`, `ConsentRecord`, `ConsentListResponse`.

## [0.3.1] — 2026-09-18 · Tarifa de la empresa (ADR-018)

### Cambiado

- `BaseFareCop` gana el suelo `min(1_000)`; endurecimiento sin ruptura.

## [0.3.0] — 2026-09-17 · Consola de administración (ADR-012)

### Agregado

- `contracts/admin.ts` completo (alta de conductor, PIN, configuración, cola en vivo, flota, conciliación
  especificada y diferida) y el fragmento de sesión de `auth.ts` (`SessionTenant`).

### Cambiado (rompe)

- `SessionUser` lleva el tenant de la sesión.

## [0.2.0] — 2026-09-16 · Fin de la cuarta copia (ADR-016)

### Cambiado

- Primer paquete publicable: `voyya-admin` deja de vendorizar los contratos y consume `@voyyaa/shared` con
  versión fijada.

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
