/**
 * SQL helper utilities
 */

export interface QueryBuilder {
  select: string[];
  from: string;
  joins: string[];
  where: string[];
  orderBy: string[];
  limit?: number;
  offset?: number;
}

const allowedColumns: Record<string, Set<string>> = {
  branches: new Set(['branch_id', 'headquarters_id', 'name', 'description', 'address', 'contact_person', 'email', 'phone']),
  deliveries: new Set(['delivery_id', 'supplier_id', 'delivery_date', 'name', 'description', 'status']),
  headquarters: new Set(['headquarters_id', 'name', 'description', 'address', 'contact_person', 'email', 'phone', 'city', 'country', 'floor_count', 'capacity']),
  order_detail_deliveries: new Set(['order_detail_delivery_id', 'order_detail_id', 'delivery_id', 'quantity', 'notes']),
  order_details: new Set(['order_detail_id', 'order_id', 'product_id', 'quantity', 'unit_price', 'notes']),
  orders: new Set(['order_id', 'branch_id', 'order_date', 'name', 'description', 'status']),
  products: new Set(['product_id', 'supplier_id', 'name', 'description', 'price', 'sku', 'unit', 'img_name', 'discount']),
  suppliers: new Set(['supplier_id', 'name', 'description', 'contact_person', 'email', 'phone', 'active', 'verified']),
};

const allowedWhereClauses = new Set([
  'branch_id = ?',
  'delivery_id = ?',
  'headquarters_id = ?',
  'order_detail_delivery_id = ?',
  'order_detail_id = ?',
  'order_id = ?',
  'product_id = ?',
  'supplier_id = ?',
]);

function assertAllowedTable(table: string): void {
  if (!allowedColumns[table]) {
    throw new Error(`SQL table is not allowed: ${table}`);
  }
}

function assertAllowedColumn(table: string, column: string): void {
  if (column !== '*' && !allowedColumns[table]?.has(column)) {
    throw new Error(`SQL column is not allowed: ${column}`);
  }
}

function assertAllowedWhereClause(whereClause: string): void {
  if (!allowedWhereClauses.has(whereClause)) {
    throw new Error(`SQL where clause is not allowed: ${whereClause}`);
  }
}

/**
 * Simple query builder for SELECT statements
 */
export class SelectQueryBuilder {
  private query: QueryBuilder;

  constructor(table: string) {
    assertAllowedTable(table);
    this.query = {
      select: ['*'],
      from: table,
      joins: [],
      where: [],
      orderBy: [],
    };
  }

  /**
   * Specify columns to select
   */
  public select(columns: string[]): this {
    columns.forEach((column) => assertAllowedColumn(this.query.from, column));
    this.query.select = columns;
    return this;
  }

  /**
   * Add JOIN clause
   */
  public join(table: string, condition: string, type: 'INNER' | 'LEFT' | 'RIGHT' = 'INNER'): this {
    assertAllowedTable(table);
    if (!/^[a-z_]+\.[a-z_]+ = [a-z_]+\.[a-z_]+$/.test(condition)) {
      throw new Error(`SQL join condition is not allowed: ${condition}`);
    }
    this.query.joins.push(`${type} JOIN ${table} ON ${condition}`);
    return this;
  }

  /**
   * Add WHERE condition
   */
  public where(condition: string): this {
    assertAllowedWhereClause(condition);
    this.query.where.push(condition);
    return this;
  }

  /**
   * Add ORDER BY clause
   */
  public orderBy(column: string, direction: 'ASC' | 'DESC' = 'ASC'): this {
    assertAllowedColumn(this.query.from, column);
    this.query.orderBy.push(`${column} ${direction}`);
    return this;
  }

  /**
   * Set LIMIT
   */
  public limit(count: number): this {
    this.query.limit = count;
    return this;
  }

  /**
   * Set OFFSET
   */
  public offset(count: number): this {
    this.query.offset = count;
    return this;
  }

  /**
   * Build the final SQL query
   */
  public build(): string {
    let sql = `SELECT ${this.query.select.join(', ')} FROM ${this.query.from}`;

    if (this.query.joins.length > 0) {
      sql += ` ${  this.query.joins.join(' ')}`;
    }

    if (this.query.where.length > 0) {
      sql += ` WHERE ${  this.query.where.join(' AND ')}`;
    }

    if (this.query.orderBy.length > 0) {
      sql += ` ORDER BY ${  this.query.orderBy.join(', ')}`;
    }

    if (this.query.limit !== undefined) {
      sql += ` LIMIT ${this.query.limit}`;
    }

    if (this.query.offset !== undefined) {
      sql += ` OFFSET ${this.query.offset}`;
    }

    return sql;
  }
}

/**
 * Convert camelCase to snake_case for database columns
 */
export function toSnakeCase(str: string): string {
  return str.replace(/([A-Z])/g, '_$1').toLowerCase();
}

/**
 * Convert snake_case to camelCase for JavaScript objects
 */
export function toCamelCase(str: string): string {
  return str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
}

/**
 * Convert object keys from camelCase to snake_case
 */
export function objectToSnakeCase<T extends Record<string, unknown>>(obj: T): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(obj)) {
    result[toSnakeCase(key)] = value;
  }

  return result;
}

/**
 * Type for database row that can be converted to a model
 */
export type DatabaseRow = Record<string, unknown>;

/**
 * Convert object keys from snake_case to camelCase with typed output
 */
export function objectToCamelCase<T>(obj: DatabaseRow): T {
  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(obj)) {
    result[toCamelCase(key)] = value;
  }

  return result as T;
}

/**
 * Convert multiple database rows to typed models
 */
export function mapDatabaseRows<T>(rows: DatabaseRow[]): T[] {
  return rows.map((row) => objectToCamelCase<T>(row));
}

/**
 * Generate placeholders for parameterized queries
 * @param count Number of placeholders needed
 * @returns String of comma-separated placeholders like "?, ?, ?"
 */
export function generatePlaceholders(count: number): string {
  return Array(count).fill('?').join(', ');
}

/**
 * Build INSERT SQL with placeholders
 */
export function buildInsertSQL<T extends Record<string, unknown>>(
  table: string,
  data: T,
): { sql: string; values: unknown[] } {
  assertAllowedTable(table);
  const snakeCaseData = objectToSnakeCase(data);
  const columns = Object.keys(snakeCaseData);
  columns.forEach((column) => assertAllowedColumn(table, column));
  const values = Object.values(snakeCaseData);
  const placeholders = generatePlaceholders(columns.length);

  const sql = `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${placeholders})`;

  return { sql, values };
}

/**
 * Build UPDATE SQL with placeholders
 */
export function buildUpdateSQL<T extends Record<string, unknown>>(
  table: string,
  data: Partial<T>,
  whereClause: string,
): { sql: string; values: unknown[] } {
  assertAllowedTable(table);
  assertAllowedWhereClause(whereClause);
  const snakeCaseData = objectToSnakeCase(data as Record<string, unknown>);
  const columns = Object.keys(snakeCaseData);
  columns.forEach((column) => assertAllowedColumn(table, column));
  const values = Object.values(snakeCaseData);

  const setClause = columns.map((col) => `${col} = ?`).join(', ');
  const sql = `UPDATE ${table} SET ${setClause} WHERE ${whereClause}`;

  return { sql, values };
}

/**
 * Validate required fields in an object
 */
export function validateRequiredFields<T extends Record<string, unknown>>(obj: T, requiredFields: string[]): void {
  for (const field of requiredFields) {
    if (obj[field] === undefined || obj[field] === null || obj[field] === '') {
      throw new Error(`Required field '${field}' is missing or empty`);
    }
  }
}
