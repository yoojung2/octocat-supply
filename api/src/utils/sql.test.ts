import { describe, expect, it } from 'vitest';
import { mapDatabaseRows, objectToCamelCase, objectToSnakeCase } from './sql';

describe('sql utils', () => {
  it('converts object keys from camelCase to snake_case', () => {
    const result = objectToSnakeCase({
      supplierName: 'Octo Supplier',
      contactPerson: 'Jane',
      active: true,
    });

    expect(result).toEqual({
      supplier_name: 'Octo Supplier',
      contact_person: 'Jane',
      active: true,
    });
  });

  it('converts object keys from snake_case to camelCase', () => {
    type SupplierRow = {
      supplierId: number;
      contactPerson: string;
      verified: boolean;
    };

    const result = objectToCamelCase<SupplierRow>({
      supplier_id: 7,
      contact_person: 'Jane',
      verified: true,
    });

    expect(result).toEqual({
      supplierId: 7,
      contactPerson: 'Jane',
      verified: true,
    });
  });

  it('maps multiple rows to camelCase models', () => {
    const result = mapDatabaseRows<{ orderId: number; orderDate: string }>([
      { order_id: 1, order_date: '2026-08-01' },
      { order_id: 2, order_date: '2026-08-02' },
    ]);

    expect(result).toEqual([
      { orderId: 1, orderDate: '2026-08-01' },
      { orderId: 2, orderDate: '2026-08-02' },
    ]);
  });
});
