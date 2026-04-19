// ============================================================
// VIZME V5 — Smoke test: businessSchemasRepo shape
// No tocamos Supabase real: validamos tipos y contratos del módulo.
// ============================================================

import { describe, it, expect } from 'vitest';
import { businessSchemasRepo } from '../businessSchemasRepo';
import type { BusinessSchema } from '../../v5types';

describe('businessSchemasRepo', () => {
  it('expone los métodos esperados', () => {
    expect(typeof businessSchemasRepo.getActive).toBe('function');
    expect(typeof businessSchemasRepo.listVersions).toBe('function');
    expect(typeof businessSchemasRepo.createNewVersion).toBe('function');
    expect(typeof businessSchemasRepo.setActive).toBe('function');
  });

  it('BusinessSchema type admite el contrato mínimo', () => {
    const sample: BusinessSchema = {
      id: 'uuid',
      project_id: 'uuid',
      version: 1,
      business_identity: {
        industry: 'restaurante',
        business_model: 'b2c',
        size: 'small',
        language: 'es-MX',
        currency: 'MXN',
      },
      entities: [],
      metrics: [],
      dimensions: [],
      extraction_rules: [],
      external_sources: [],
      created_at: new Date().toISOString(),
      is_active: true,
    };
    expect(sample.version).toBe(1);
    expect(sample.is_active).toBe(true);
  });
});
