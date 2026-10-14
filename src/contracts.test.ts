import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  ANDROID_ASSIGNMENT_CHANNEL_ID,
  ANDROID_TRIP_UPDATES_CHANNEL_ID,
  ASSIGNMENT_EVENTS,
  AssignmentCancelledByDriverEvent,
  AssignmentSearchExhaustedEvent,
  DriverAssignedEvent,
  DriverPushData,
  PASSENGER_PUSH_NOTIFICATION_TYPES,
  PUSH_ENTITY_ID_MAX,
  PUSH_NOTIFICATION_TYPES,
  PassengerPushData,
  PushNotificationData,
  TRIPS_EVENTS,
  TripRequestDriverArrivedEvent,
  TripRequestNoDriverEvent,
  AcceptAssignmentResult,
  ActivatableServiceType,
  ActiveServiceTypes,
  AdminErrorCode,
  AuthError,
  AuthErrorCode,
  OTP_LENGTH,
  OtpCode,
  VerifyOtpDTO,
  AffiliationErrorCode,
  AffiliationMunicipalityListResponse,
  ApproveCompanyDTO,
  AssignedDriverSummary,
  CommissionPct,
  DRIVER_LOCATION_SHARING_NOTICE_VERSIONS,
  DriverTrackingView,
  DriverTripView,
  LOCATION_NOTICE_VERSION,
  OpsQueueRow,
  OpsTripDetail,
  OpsTripTimeline,
  ReportDriverLocationResult,
  StartCode,
  StartTripDTO,
  TripError,
  canonicalLocationNoticeText,
  driverTrackingView,
  hasLegalPlaceholders,
  CompanyPublicName,
  CreateAffiliationApplicationDTO,
  CreateTripRequestDTO,
  OfficialReference,
  PlatformCompanyQuery,
  PlatformErrorCode,
  QuoteFareDTO,
  TripErrorCode,
  TripRequestStatus,
  TripServiceOptionsResponse,
  UpdateCompanyCommissionDTO,
  UpdateMunicipalityFareDTO,
  UpdateMunicipalityOperationalParamsDTO,
} from './index';

const place = { lat: 6.96, lng: -75.41, address: 'Parque principal' };

const baseTrip = {
  origin: place,
  destination: { ...place, address: 'Hospital' },
  municipality_id: 1,
  quote_token: 'token',
};

const baseApplication = {
  legal_name: 'Cootrayal Ltda',
  tax_id: '900123456-7',
  legal_form: 'cooperative',
  municipality_id: 1,
  vehicle_count: 20,
  contact_first_name: 'Ana',
  contact_last_name: 'Gómez',
  contact_email: 'ana@example.com',
  contact_phone: '+573001234567',
  documents: [{ type: 'tax_registry', storage_key: 'staging/2026/10/08/doc.pdf' }],
};

const validParams = {
  version: 3,
  search_radius_km: 2,
  expansion_radius_km: 4,
  acceptance_timeout_sec: 30,
  max_auto_retries: 3,
  tiebreak_window_hours: 4,
  location_stale_min: 5,
  avg_speed_kmh: 25,
  cancellation_window_min: 5,
  no_show_grace_min: 5,
};

describe('ActivatableServiceType', () => {
  it('accepts taxi, comfort and delivery', () => {
    for (const type of ['taxi', 'comfort', 'delivery']) {
      assert.equal(ActivatableServiceType.safeParse(type).success, true);
    }
  });

  it('rejects motorcycle', () => {
    assert.equal(ActivatableServiceType.safeParse('motorcycle').success, false);
  });

  it('rejects unknown values', () => {
    assert.equal(ActivatableServiceType.safeParse('bus').success, false);
  });

  it('makes a list of active service types impossible with motorcycle or empty', () => {
    assert.equal(ActiveServiceTypes.safeParse(['taxi', 'comfort']).success, true);
    assert.equal(ActiveServiceTypes.safeParse(['taxi', 'motorcycle']).success, false);
    assert.equal(ActiveServiceTypes.safeParse([]).success, false);
  });
});

describe('trip inputs', () => {
  it('rejects motorcycle in quote and create', () => {
    const quote = QuoteFareDTO.safeParse({ ...baseTrip, service_type: 'motorcycle' });
    const create = CreateTripRequestDTO.safeParse({ ...baseTrip, service_type: 'motorcycle' });
    assert.equal(quote.success, false);
    assert.equal(create.success, false);
  });

  it('defaults service_type to taxi', () => {
    assert.equal(CreateTripRequestDTO.parse(baseTrip).service_type, 'taxi');
    assert.equal(QuoteFareDTO.parse(baseTrip).service_type, 'taxi');
  });

  it('treats requested_company_id as optional or null (any company)', () => {
    assert.equal(CreateTripRequestDTO.parse(baseTrip).requested_company_id, undefined);
    assert.equal(
      CreateTripRequestDTO.parse({ ...baseTrip, requested_company_id: null }).requested_company_id,
      null,
    );
    assert.equal(
      CreateTripRequestDTO.parse({ ...baseTrip, requested_company_id: 7 }).requested_company_id,
      7,
    );
  });

  it('rejects a non positive, fractional or textual requested_company_id', () => {
    for (const value of [0, -1, 1.5, '7']) {
      assert.equal(
        CreateTripRequestDTO.safeParse({ ...baseTrip, requested_company_id: value }).success,
        false,
      );
    }
  });
});

describe('trip outputs', () => {
  const company = { company_id: 2, display_name: 'Cootrayal' };
  const driver = { name: 'Luis', plate: 'ABC123', model: null, contact_phone: null, eta: null };
  const status = {
    trip_request_id: 10,
    status: 'pending_assignment',
    ui: 'searching',
    service_type: 'taxi',
    requested_company: null,
    fare: {
      base_fare: 8000,
      night_surcharge: 0,
      holiday_surcharge: 0,
      total: 8000,
      commission: 0,
      currency: 'COP',
    },
    driver: null,
    arrived_at: null,
    free_cancellation_until: null,
    updated_at: '2026-10-08T10:00:00.000Z',
    server_time: '2026-10-08T10:00:00.000Z',
  };

  it('allows a null requested_company and a driver with company', () => {
    assert.equal(TripRequestStatus.safeParse(status).success, true);
    const assigned = { ...status, requested_company: company, driver: { ...driver, company } };
    assert.equal(TripRequestStatus.safeParse(assigned).success, true);
  });

  it('requires company in the assigned driver summary', () => {
    assert.equal(AssignedDriverSummary.safeParse(driver).success, false);
  });

  it('declares the error codes of the multi-company cycle', () => {
    assert.equal(TripErrorCode.safeParse('COMPANY_NOT_AVAILABLE').success, true);
    assert.equal(TripErrorCode.safeParse('SERVICE_NOT_AVAILABLE').success, true);
    assert.equal(PlatformErrorCode.safeParse('MUNICIPALITY_FARE_REQUIRED').success, true);
    assert.equal(AffiliationErrorCode.safeParse('SERVICE_NOT_AVAILABLE').success, true);
    assert.equal(AdminErrorCode.safeParse('SETTINGS_MANAGED_BY_PLATFORM').success, true);
  });

  it('describes service options with company, display name and availability', () => {
    const response = {
      municipality: { municipality_id: 1, name: 'Yarumal' },
      services: [
        {
          service_type: 'taxi',
          selection_required: true,
          companies: [
            { ...company, has_available_drivers: true },
            { company_id: 3, display_name: 'Otra', has_available_drivers: false },
          ],
        },
      ],
    };
    assert.equal(TripServiceOptionsResponse.safeParse(response).success, true);
    assert.equal(
      TripServiceOptionsResponse.safeParse({ municipality: null, services: [] }).success,
      true,
    );
    const withoutAvailability = {
      municipality: response.municipality,
      services: [{ ...response.services[0], companies: [company] }],
    };
    assert.equal(TripServiceOptionsResponse.safeParse(withoutAvailability).success, false);
  });

  it('rejects motorcycle as a service option', () => {
    const response = {
      municipality: { municipality_id: 1, name: 'Yarumal' },
      services: [
        {
          service_type: 'motorcycle',
          selection_required: false,
          companies: [{ company_id: 2, display_name: 'X', has_available_drivers: true }],
        },
      ],
    };
    assert.equal(TripServiceOptionsResponse.safeParse(response).success, false);
  });
});

describe('accept assignment result', () => {
  it('keeps the already_taken body, served with 409 (ADR-032 D-1)', () => {
    const parsed = AcceptAssignmentResult.parse({
      result: 'already_taken',
      message: 'Otro conductor tomó el viaje',
    });
    assert.equal(parsed.result, 'already_taken');
  });

  it('keeps the expired and accepted variants', () => {
    assert.equal(
      AcceptAssignmentResult.safeParse({ result: 'expired', message: 'Venció' }).success,
      true,
    );
    assert.equal(
      AcceptAssignmentResult.safeParse({
        result: 'accepted',
        assignment_id: 1,
        trip_request_id: 2,
        trip_request_status: 'assigned',
        passenger: { name: 'Ana', contact_phone: null, pickup_address: 'Parque' },
      }).success,
      true,
    );
  });

  it('does not add an already taken error code to trips', () => {
    assert.equal(TripErrorCode.safeParse('ASSIGNMENT_ALREADY_TAKEN').success, false);
  });
});

describe('commission', () => {
  it('accepts the 0 to 50 range with two decimals', () => {
    for (const value of [0, 0.01, 12.5, 50]) {
      assert.equal(CommissionPct.safeParse(value).success, true);
    }
  });

  it('rejects values outside the range and finer than 0.01', () => {
    for (const value of [-0.01, 50.01, 100, 10.005]) {
      assert.equal(CommissionPct.safeParse(value).success, false);
    }
  });

  it('applies the range to the update DTO', () => {
    const update = (commission_pct: number) =>
      UpdateCompanyCommissionDTO.safeParse({ version: null, commission_pct }).success;
    assert.equal(update(50), true);
    assert.equal(update(51), false);
  });

  it('makes commission_pct mandatory on approval and the initial fare optional', () => {
    const initial_fare = { base_fare: 8000 };
    assert.equal(ApproveCompanyDTO.safeParse({}).success, false);
    assert.equal(ApproveCompanyDTO.safeParse({ commission_pct: 0 }).success, true);
    assert.equal(ApproveCompanyDTO.safeParse({ commission_pct: 51 }).success, false);
    assert.equal(ApproveCompanyDTO.safeParse({ commission_pct: 10, initial_fare }).success, true);
    assert.equal(ApproveCompanyDTO.safeParse({ initial_fare }).success, false);
  });

  it('keeps the minimum base fare of the initial fare', () => {
    const initial_fare = { base_fare: 999 };
    assert.equal(ApproveCompanyDTO.safeParse({ commission_pct: 10, initial_fare }).success, false);
  });
});

describe('public name and service types in affiliation', () => {
  it('accepts a public name from 2 to 60 characters', () => {
    assert.equal(CompanyPublicName.safeParse('ab').success, true);
    assert.equal(CompanyPublicName.safeParse('a'.repeat(60)).success, true);
  });

  it('rejects a public name under 2 or over 60 characters, after trimming', () => {
    assert.equal(CompanyPublicName.safeParse('a').success, false);
    assert.equal(CompanyPublicName.safeParse('  a  ').success, false);
    assert.equal(CompanyPublicName.safeParse('a'.repeat(61)).success, false);
  });

  it('rejects control, format, bidirectional and zero-width characters in a public name', () => {
    const codePoints = [0x202e, 0x200b, 0x200d, 0x2060, 0xfeff, 0x0000, 0x000a, 0x0009, 0x200f, 0x2066, 0x180e];
    for (const codePoint of codePoints) {
      const name = `Taxis${String.fromCodePoint(codePoint)}Yarumal`;
      assert.equal(CompanyPublicName.safeParse(name).success, false, codePoint.toString(16));
    }
  });

  it('normalizes a public name to NFC', () => {
    const decomposed = `Cafe${String.fromCodePoint(0x0301)} Taxis`;
    const parsed = CompanyPublicName.parse(decomposed);
    assert.equal(parsed, `Caf${String.fromCodePoint(0x00e9)} Taxis`);
    assert.equal(parsed.length, 10);
  });

  it('keeps accents, the enye and inner spaces in a public name', () => {
    assert.equal(CompanyPublicName.safeParse(`Taxis Ni${String.fromCodePoint(0x00f1)}o & Cia.`).success, true);
  });

  it('makes public_name optional and defaults service_types to taxi', () => {
    const parsed = CreateAffiliationApplicationDTO.parse(baseApplication);
    assert.deepEqual(parsed.service_types, ['taxi']);
    assert.equal(parsed.public_name, undefined);
  });

  it('validates the public name in the application', () => {
    const apply = (public_name: string) =>
      CreateAffiliationApplicationDTO.safeParse({ ...baseApplication, public_name }).success;
    assert.equal(apply('x'), false);
    assert.equal(apply('Coo'), true);
    assert.equal(apply('x'.repeat(61)), false);
  });

  it('rejects motorcycle, repeated, empty and too many service types', () => {
    const attempts = [
      ['motorcycle'],
      ['taxi', 'taxi'],
      [],
      ['taxi', 'comfort', 'delivery', 'taxi'],
    ];
    for (const service_types of attempts) {
      const result = CreateAffiliationApplicationDTO.safeParse({
        ...baseApplication,
        service_types,
      });
      assert.equal(result.success, false);
    }
    const valid = { ...baseApplication, service_types: ['taxi', 'comfort'] };
    assert.equal(CreateAffiliationApplicationDTO.safeParse(valid).success, true);
  });

  it('filters platform companies by municipality', () => {
    assert.equal(PlatformCompanyQuery.parse({ municipality_id: '4' }).municipality_id, 4);
    assert.equal(PlatformCompanyQuery.parse({}).municipality_id, undefined);
  });
});

describe('DANE catalog', () => {
  const row = {
    municipality_id: 1,
    dane_code: '05887',
    department_code: '05',
    name: 'Yarumal',
    department: 'Antioquia',
    already_covered: true,
    has_active_companies: true,
    coverage_active: true,
  };
  const source = {
    name: 'DIVIPOLA',
    cut_date: '2025-12-31',
    attribution: 'DANE',
    license: 'CC BY 4.0',
  };
  const parseCatalog = (rows: object[], services: string[] = ['taxi']) =>
    AffiliationMunicipalityListResponse.safeParse({
      rows,
      source,
      active_service_types: services,
    }).success;

  it('parses the catalog with the new fields and the active service types', () => {
    const parsed = AffiliationMunicipalityListResponse.parse({
      rows: [row],
      source,
      active_service_types: ['taxi'],
    });
    assert.equal(parsed.rows[0]?.has_active_companies, true);
    assert.equal(parsed.rows[0]?.already_covered, true);
  });

  it('requires the DANE fields and the coverage flags', () => {
    assert.equal(parseCatalog([row]), true);
    for (const key of ['dane_code', 'department_code', 'has_active_companies', 'coverage_active']) {
      const incomplete = Object.fromEntries(Object.entries(row).filter(([k]) => k !== key));
      assert.equal(parseCatalog([incomplete]), false, key);
    }
  });

  it('rejects malformed codes and motorcycle or no active services', () => {
    assert.equal(parseCatalog([{ ...row, dane_code: '5887' }]), false);
    assert.equal(parseCatalog([{ ...row, department_code: '5' }]), false);
    assert.equal(parseCatalog([row], ['motorcycle']), false);
    assert.equal(parseCatalog([row], []), false);
  });
});

describe('municipality fare and operational params', () => {
  const fare = {
    version: 4,
    base_fare: 8000,
    night_surcharge_pct: 20,
    holiday_surcharge_pct: 15,
    is_official: true,
    official_reference: 'Resolución 123 de 2026',
  };

  it('accepts an official fare with its reference', () => {
    assert.equal(UpdateMunicipalityFareDTO.safeParse(fare).success, true);
  });

  it('rejects a reference on a non official fare', () => {
    const notOfficial = { ...fare, is_official: false };
    assert.equal(UpdateMunicipalityFareDTO.safeParse(notOfficial).success, false);
    const withoutReference = { ...notOfficial, official_reference: null };
    assert.equal(UpdateMunicipalityFareDTO.safeParse(withoutReference).success, true);
  });

  it('limits the reference to 120 characters and the base fare to its range', () => {
    assert.equal(OfficialReference.safeParse('x'.repeat(120)).success, true);
    assert.equal(OfficialReference.safeParse('x'.repeat(121)).success, false);
    assert.equal(UpdateMunicipalityFareDTO.safeParse({ ...fare, base_fare: 999 }).success, false);
    const tooHigh = { ...fare, base_fare: 1_000_001 };
    assert.equal(UpdateMunicipalityFareDTO.safeParse(tooHigh).success, false);
  });

  it('requires a version', () => {
    const withoutVersion = Object.fromEntries(
      Object.entries(fare).filter(([k]) => k !== 'version'),
    );
    assert.equal(UpdateMunicipalityFareDTO.safeParse(withoutVersion).success, false);
  });

  it('validates the nine operational params and the radius order', () => {
    const update = (patch: object) =>
      UpdateMunicipalityOperationalParamsDTO.safeParse({ ...validParams, ...patch }).success;
    assert.equal(update({}), true);
    assert.equal(update({ version: null }), true);
    assert.equal(update({ search_radius_km: 5 }), false);
    assert.equal(update({ max_auto_retries: 11 }), false);
    assert.equal(update({ location_stale_min: 0 }), true);
  });
});

describe('start code and driver tracking', () => {
  it('accepts only four digits as a start code', () => {
    for (const valid of ['0042', '1234', '0000'])
      assert.equal(StartCode.safeParse(valid).success, true);
    for (const invalid of ['12a4', '12345', '123', ''])
      assert.equal(StartCode.safeParse(invalid).success, false);
    assert.equal(StartTripDTO.safeParse({}).success, true);
    assert.equal(StartTripDTO.safeParse({ start_code: '0042' }).success, true);
    assert.equal(StartTripDTO.safeParse({ start_code: 'abcd' }).success, false);
  });

  it('knows the three start code errors and their details', () => {
    for (const code of ['START_CODE_REQUIRED', 'START_CODE_INVALID', 'START_CODE_BLOCKED'])
      assert.equal(TripErrorCode.safeParse(code).success, true);
    const invalid = {
      code: 'START_CODE_INVALID',
      message: 'x',
      attempts_remaining: 4,
    };
    assert.equal(TripError.parse(invalid).attempts_remaining, 4);
    const blocked = {
      code: 'START_CODE_BLOCKED',
      message: 'x',
      blocked_at: '2026-10-09T10:00:00Z',
    };
    assert.equal(TripError.parse(blocked).blocked_at, '2026-10-09T10:00:00Z');
    assert.equal(TripError.safeParse({ ...invalid, attempts_remaining: 0 }).success, false);
    assert.equal(TripError.safeParse({ ...invalid, attempts_remaining: 5 }).success, false);
  });

  const tracking = (windowAge: number, age: number | null) => ({
    window_age_sec: windowAge,
    stale_after_sec: 45,
    hide_after_sec: 300,
    position: age === null ? null : { lat: 6.96, lng: -75.41, age_sec: age },
  });
  const view = (windowAge: number, age: number | null, elapsed: number): DriverTrackingView =>
    driverTrackingView(tracking(windowAge, age), elapsed);

  it('classifies a present position with the exact 45 s and 300 s edges', () => {
    assert.equal(view(100, 0, 0), 'live');
    assert.equal(view(100, 44, 0), 'live');
    assert.equal(view(100, 45, 0), 'stale');
    assert.equal(view(100, 299, 0), 'stale');
    assert.equal(view(100, 300, 0), 'hidden');
    assert.equal(view(100, 30, 14), 'live');
    assert.equal(view(100, 30, 15), 'stale');
    assert.equal(view(100, 30, 269), 'stale');
    assert.equal(view(100, 30, 270), 'hidden');
  });

  it('gives the grace period only while the position is null', () => {
    assert.equal(view(0, null, 0), 'locating');
    assert.equal(view(44, null, 0), 'locating');
    assert.equal(view(45, null, 0), 'hidden');
    assert.equal(view(10, null, 34), 'locating');
    assert.equal(view(10, null, 35), 'hidden');
    assert.equal(view(1000, null, 0), 'hidden');
  });

  it('parses an old server response with the defaults', () => {
    const old = {
      trip_request_id: 10,
      status: 'assigned',
      ui: 'driver_assigned',
      service_type: 'taxi',
      requested_company: null,
      fare: {
        base_fare: 8000,
        night_surcharge: 0,
        holiday_surcharge: 0,
        total: 8000,
        commission: 0,
        currency: 'COP',
      },
      driver: null,
      arrived_at: null,
      free_cancellation_until: null,
      updated_at: '2026-10-09T10:00:00Z',
      server_time: '2026-10-09T10:00:00Z',
    };
    const parsed = TripRequestStatus.parse(old);
    assert.equal(parsed.start_code, null);
    assert.equal(parsed.start_code_state, 'not_applicable');
    assert.equal(parsed.driver_tracking, null);
  });

  it('defaults the driver fields, the report result and the console fields', () => {
    assert.deepEqual(ReportDriverLocationResult.parse({ ok: true }), {
      ok: true,
      location_sharing: null,
    });
    const view = DriverTripView.parse({
      trip_request_id: 1,
      assignment_id: 1,
      status: 'assigned',
      passenger: { name: 'Ana', contact_phone: null },
      pickup_address: 'a',
      dropoff_address: 'b',
      fare: {
        base_fare: 8000,
        night_surcharge: 0,
        holiday_surcharge: 0,
        total: 8000,
        commission: 0,
        currency: 'COP',
      },
      arrived_at: null,
      no_show_available_at: null,
      cash_collected_at: null,
    });
    assert.equal(view.start_code_required, false);
    assert.equal(view.start_attempts_remaining, null);
    assert.equal(view.start_blocked, false);
    assert.equal(view.pickup_location, null);
    assert.equal(view.dropoff_location, null);
    assert.equal(view.location_sharing, null);
    assert.equal(OpsTripTimeline.shape.started_at.parse(undefined), null);
    assert.equal(OpsQueueRow.shape.start_failed_attempts.parse(undefined), 0);
    assert.equal(OpsTripDetail.shape.start_blocked_at.parse(undefined), null);
  });
});

describe('location notice v3', () => {
  it('is the current version and allows sharing', () => {
    assert.equal(LOCATION_NOTICE_VERSION, 'location-notice-v3');
    assert.equal(
      (DRIVER_LOCATION_SHARING_NOTICE_VERSIONS as readonly string[]).includes(
        LOCATION_NOTICE_VERSION,
      ),
      true,
    );
  });

  it('carries no legal placeholders for either audience', () => {
    assert.equal(hasLegalPlaceholders(canonicalLocationNoticeText('driver')), false);
    assert.equal(hasLegalPlaceholders(canonicalLocationNoticeText('passenger')), false);
  });
});

describe('passenger push data', () => {
  it('accepts every passenger type with a trip request id', () => {
    for (const type of PASSENGER_PUSH_NOTIFICATION_TYPES) {
      const parsed = PassengerPushData.parse({ type, trip_request_id: '42' });
      assert.deepEqual(parsed, { type, trip_request_id: 42 });
    }
  });

  it('keeps only the type and the trip request id', () => {
    const parsed = PassengerPushData.parse({
      type: PUSH_NOTIFICATION_TYPES.TRIP_DRIVER_ARRIVED,
      trip_request_id: 7,
      start_code: '4821',
      start_code_state: 'active',
      driver_name: 'Juan Pérez',
      plate: 'ABC123',
      phone: '3001234567',
      pickup_address: 'Calle 20 con carrera 15',
      position: { lat: 6.96, lng: -75.41 },
    });
    assert.deepEqual(Object.keys(parsed).sort(), ['trip_request_id', 'type']);
  });

  it('rejects a payload without trip request id or with an unknown type', () => {
    assert.equal(
      PassengerPushData.safeParse({ type: PUSH_NOTIFICATION_TYPES.TRIP_NO_DRIVER }).success,
      false,
    );
    assert.equal(
      PassengerPushData.safeParse({ type: 'trip_marketing', trip_request_id: 1 }).success,
      false,
    );
    assert.equal(
      PassengerPushData.safeParse({
        type: PUSH_NOTIFICATION_TYPES.ASSIGNMENT_OFFER,
        trip_request_id: 1,
      }).success,
      false,
    );
  });

  it('bounds the trip request id to int4 and refuses booleans', () => {
    const type = PUSH_NOTIFICATION_TYPES.TRIP_NO_DRIVER;
    assert.equal(PUSH_ENTITY_ID_MAX, 2_147_483_647);
    const highest = PassengerPushData.parse({ type, trip_request_id: '2147483647' });
    assert.deepEqual(highest, { type, trip_request_id: PUSH_ENTITY_ID_MAX });
    for (const trip_request_id of [
      true,
      false,
      null,
      '',
      '-1',
      '1.5',
      '1e3',
      ' 7',
      '2147483648',
      2_147_483_648,
      0,
      -3,
      1.5,
      Number.POSITIVE_INFINITY,
    ]) {
      assert.equal(PassengerPushData.safeParse({ type, trip_request_id }).success, false);
    }
  });

  it('applies the same id bounds to the driver offer', () => {
    const offer = {
      type: PUSH_NOTIFICATION_TYPES.ASSIGNMENT_OFFER,
      assignment_id: '9',
      trip_request_id: '3',
      expires_at: '2026-10-13T15:00:00.000Z',
    };
    assert.equal(DriverPushData.safeParse(offer).success, true);
    assert.equal(DriverPushData.safeParse({ ...offer, assignment_id: true }).success, false);
    assert.equal(
      DriverPushData.safeParse({ ...offer, trip_request_id: '2147483648' }).success,
      false,
    );
  });

  it('keeps each audience out of the other union', () => {
    const passenger = { type: PUSH_NOTIFICATION_TYPES.TRIP_DRIVER_ASSIGNED, trip_request_id: 3 };
    const driver = {
      type: PUSH_NOTIFICATION_TYPES.ASSIGNMENT_OFFER,
      assignment_id: 9,
      trip_request_id: 3,
      expires_at: '2026-10-13T15:00:00.000Z',
    };
    assert.equal(DriverPushData.safeParse(passenger).success, false);
    assert.equal(DriverPushData.safeParse(driver).success, true);
    assert.equal(PushNotificationData.safeParse(passenger).success, true);
    assert.equal(PushNotificationData.safeParse(driver).success, true);
  });

  it('declares unique types and distinct android channels', () => {
    const all = Object.values(PUSH_NOTIFICATION_TYPES);
    assert.equal(new Set(all).size, all.length);
    assert.equal(
      (PASSENGER_PUSH_NOTIFICATION_TYPES as readonly string[]).includes(
        PUSH_NOTIFICATION_TYPES.ASSIGNMENT_OFFER,
      ),
      false,
    );
    assert.equal(PASSENGER_PUSH_NOTIFICATION_TYPES.length, all.length - 1);
    assert.notEqual(ANDROID_TRIP_UPDATES_CHANNEL_ID, ANDROID_ASSIGNMENT_CHANNEL_ID);
  });
});

describe('passenger push events', () => {
  const occurredAt = '2026-10-13T15:00:00.000Z';

  it('carries the passenger in every applied fact that notifies', () => {
    const assigned = {
      trip_request_id: 1,
      assignment_id: 2,
      driver_id: 3,
      vehicle_id: 4,
      company_id: 5,
      occurred_at: occurredAt,
    };
    assert.equal(DriverAssignedEvent.safeParse(assigned).success, false);
    assert.equal(DriverAssignedEvent.safeParse({ ...assigned, passenger_id: 6 }).success, true);

    const cancelled = {
      assignment_id: 2,
      trip_request_id: 1,
      driver_id: 3,
      reason: 'Se pinchó una llanta',
      trip_request_status: 'pending_assignment',
      occurred_at: occurredAt,
    };
    assert.equal(AssignmentCancelledByDriverEvent.safeParse(cancelled).success, false);
    assert.equal(
      AssignmentCancelledByDriverEvent.safeParse({ ...cancelled, passenger_id: 6 }).success,
      true,
    );

    const arrived = {
      trip_request_id: 1,
      driver_id: 3,
      company_id: 5,
      arrived_at: occurredAt,
      occurred_at: occurredAt,
    };
    assert.equal(TripRequestDriverArrivedEvent.safeParse(arrived).success, false);
    assert.equal(
      TripRequestDriverArrivedEvent.safeParse({ ...arrived, passenger_id: 6 }).success,
      true,
    );

    const noDriver = {
      trip_request_id: 1,
      attempts_made: 3,
      final_radius_km: 4,
      occurred_at: occurredAt,
    };
    assert.equal(TripRequestNoDriverEvent.safeParse(noDriver).success, false);
    assert.equal(
      TripRequestNoDriverEvent.safeParse({ ...noDriver, passenger_id: 6 }).success,
      true,
    );
    assert.equal(AssignmentSearchExhaustedEvent.safeParse(noDriver).success, true);
  });

  it('names the new events without colliding with existing ones', () => {
    const names = [...Object.values(TRIPS_EVENTS), ...Object.values(ASSIGNMENT_EVENTS)];
    assert.equal(new Set(names).size, names.length);
    assert.equal(TRIPS_EVENTS.TRIP_REQUEST_DRIVER_ARRIVED, 'trip_request.driver_arrived');
    assert.equal(ASSIGNMENT_EVENTS.SEARCH_EXHAUSTED, 'assignment.search_exhausted');
  });
});

describe('OTP code', () => {
  it('fixes the code length at six digits', () => {
    assert.equal(OTP_LENGTH, 6);
  });

  it('accepts exactly OTP_LENGTH ASCII digits, leading zeros included', () => {
    for (const code of ['000000', '012345', '999999']) {
      assert.equal(OtpCode.safeParse(code).success, true, code);
    }
  });

  it('rejects any other length, letters, spaces and non-ASCII digits', () => {
    const invalid = ['', '1234', '12345', '1234567', '12345678', '12345a', ' 12345', '١٢٣٤٥٦'];
    for (const code of invalid) {
      assert.equal(OtpCode.safeParse(code).success, false, code);
    }
  });

  it('makes a four-digit code an invalid verification body', () => {
    const phone = '3001234567';
    assert.equal(VerifyOtpDTO.safeParse({ phone, code: '1234' }).success, false);
    assert.equal(VerifyOtpDTO.safeParse({ phone, code: '012345' }).success, true);
  });

  it('adds no error code: every issuance cap answers OTP_RATE_LIMIT with an exact wait', () => {
    assert.deepEqual(
      AuthErrorCode.options.filter((code) => code.startsWith('OTP_')),
      ['OTP_INVALID', 'OTP_EXPIRED', 'OTP_MAX_ATTEMPTS', 'OTP_RATE_LIMIT'],
    );
    const dailyWait = {
      code: 'OTP_RATE_LIMIT',
      message: 'Demasiadas solicitudes de código, intenta más tarde',
      retry_in_sec: 86_400,
    };
    assert.equal(AuthError.safeParse(dailyWait).success, true);
    assert.equal(AuthError.safeParse({ ...dailyWait, retry_in_sec: 0 }).success, false);
  });
});
