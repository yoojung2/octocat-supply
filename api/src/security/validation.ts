import type { RequestHandler } from 'express';
import { ValidationError } from '../utils/errors';

type FieldRule = {
  type: 'string' | 'integer' | 'number' | 'boolean';
  required?: boolean;
  maxLength?: number;
  min?: number;
  max?: number;
  enum?: string[];
};

type BodySchema = Record<string, FieldRule>;

const text = (required = true, maxLength = 255): FieldRule => ({ type: 'string', required, maxLength });
const positiveInt = (required = true): FieldRule => ({ type: 'integer', required, min: 1 });

const schemas: Record<string, BodySchema> = {
  branches: {
    headquartersId: positiveInt(),
    name: text(),
    description: text(false, 1000),
    address: text(false, 500),
    contactPerson: text(false),
    email: text(false, 320),
    phone: text(false, 50),
  },
  headquarters: {
    name: text(),
    description: text(false, 1000),
    address: text(false, 500),
    contactPerson: text(false),
    email: text(false, 320),
    phone: text(false, 50),
    city: text(false),
    country: text(false),
    floorCount: { type: 'integer', required: false, min: 0, max: 1000 },
    capacity: { type: 'integer', required: false, min: 0, max: 1000000 },
  },
  suppliers: {
    name: text(),
    description: text(false, 1000),
    contactPerson: text(false),
    email: text(false, 320),
    phone: text(false, 50),
    active: { type: 'boolean', required: false },
    verified: { type: 'boolean', required: false },
  },
  products: {
    supplierId: positiveInt(),
    name: text(),
    description: text(false, 1000),
    price: { type: 'number', required: true, min: 0, max: 100000000 },
    sku: text(false, 100),
    unit: text(false, 50),
    imgName: text(false, 255),
    discount: { type: 'number', required: false, min: 0, max: 1 },
  },
  orders: {
    branchId: positiveInt(),
    orderDate: text(),
    name: text(false),
    description: text(false, 1000),
    status: { type: 'string', required: true, enum: ['pending', 'processing', 'shipped', 'delivered', 'cancelled'], maxLength: 50 },
  },
  'order-details': {
    orderId: positiveInt(),
    productId: positiveInt(),
    quantity: { type: 'integer', required: true, min: 1, max: 1000000 },
    unitPrice: { type: 'number', required: true, min: 0, max: 100000000 },
    notes: text(false, 1000),
  },
  deliveries: {
    supplierId: positiveInt(),
    deliveryDate: text(),
    name: text(false),
    description: text(false, 1000),
    status: { type: 'string', required: true, enum: ['pending', 'in-transit', 'delivered', 'failed'], maxLength: 50 },
  },
  'order-detail-deliveries': {
    orderDetailId: positiveInt(),
    deliveryId: positiveInt(),
    quantity: { type: 'integer', required: true, min: 1, max: 1000000 },
    notes: text(false, 1000),
  },
};

const deliveryStatusSchema: BodySchema = {
  status: { type: 'string', required: true, enum: ['pending', 'in-transit', 'delivered', 'failed'], maxLength: 50 },
};

function resourceFromPath(path: string): string | undefined {
  const parts = path.split('/').filter(Boolean);
  return parts[0] === 'api' ? parts[1] : parts[0];
}

function schemaFor(reqPath: string): BodySchema | undefined {
  if (/^(\/api)?\/deliveries\/\d+\/status$/.test(reqPath)) {
    return deliveryStatusSchema;
  }

  const resource = resourceFromPath(reqPath);
  return resource ? schemas[resource] : undefined;
}

function validateField(name: string, value: unknown, rule: FieldRule): void {
  if (value === undefined || value === null || value === '') {
    if (rule.required) {
      throw new ValidationError(`${name} is required`);
    }
    return;
  }

  if (rule.type === 'integer' && (!Number.isInteger(value) || typeof value !== 'number')) {
    throw new ValidationError(`${name} must be an integer`);
  }

  if (rule.type === 'number' && typeof value !== 'number') {
    throw new ValidationError(`${name} must be a number`);
  }

  if (rule.type === 'string' && typeof value !== 'string') {
    throw new ValidationError(`${name} must be a string`);
  }

  if (rule.type === 'boolean' && typeof value !== 'boolean') {
    throw new ValidationError(`${name} must be a boolean`);
  }

  if (typeof value === 'string' && rule.maxLength !== undefined && value.length > rule.maxLength) {
    throw new ValidationError(`${name} is too long`);
  }

  if (typeof value === 'number' && rule.min !== undefined && value < rule.min) {
    throw new ValidationError(`${name} is below the minimum value`);
  }

  if (typeof value === 'number' && rule.max !== undefined && value > rule.max) {
    throw new ValidationError(`${name} is above the maximum value`);
  }

  if (typeof value === 'string' && rule.enum && !rule.enum.includes(value)) {
    throw new ValidationError(`${name} is not an allowed value`);
  }
}

export const validateRequestBody: RequestHandler = (req, _res, next) => {
  if (!['POST', 'PUT'].includes(req.method)) {
    next();
    return;
  }

  const schema = schemaFor(req.path);
  if (!schema) {
    next();
    return;
  }

  if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) {
    next(new ValidationError('Request body must be a JSON object'));
    return;
  }

  try {
    for (const key of Object.keys(req.body)) {
      if (!schema[key]) {
        throw new ValidationError(`${key} is not writable`);
      }
    }

    for (const [key, rule] of Object.entries(schema)) {
      validateField(key, req.body[key], rule);
    }

    next();
  } catch (error) {
    next(error);
  }
};
