import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  AcceptAssignmentResult,
  ActivatableServiceType,
  ActiveServiceTypes,
  AdminErrorCode,
  AffiliationErrorCode,
  AffiliationMunicipalityListResponse,
  ApproveCompanyDTO,
  AssignedDriverSummary,
  CommissionPct,
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
  it('keeps the 200 already_taken shape the installed driver app understands', () => {
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
