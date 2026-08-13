import { z } from "zod";

const scalarSchema = z.union([z.string(), z.number(), z.boolean(), z.null()]);

export const clusterEntitySchema = z.object({
  id: z.union([z.number(), z.string()]).optional().nullable(),
  clusterId: z.union([z.number(), z.string()]).optional().nullable(),
  organizationId: z.union([z.number(), z.string()]).optional().nullable(),
  name: z.string().optional().nullable(),
  version: z.string().optional().nullable(),
  clusterType: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  status: scalarSchema.optional(),
  deployStatusType: scalarSchema.optional(),
  createTime: z.string().optional().nullable(),
  startTimestamp: z.string().optional().nullable(),
  onlineTimestamp: z.string().optional().nullable(),
}).passthrough();

export const runtimeEntitySchema = z.object({
  id: z.union([z.number(), z.string()]).optional().nullable(),
  clusterId: z.union([z.number(), z.string()]).optional().nullable(),
  name: z.string().optional().nullable(),
  version: z.string().optional().nullable(),
  host: z.string().optional().nullable(),
  port: z.union([z.number(), z.string()]).optional().nullable(),
  status: scalarSchema.optional(),
  deployStatusType: scalarSchema.optional(),
  createTime: z.string().optional().nullable(),
  startTimestamp: z.string().optional().nullable(),
}).passthrough();

export const healthProportionSchema = z.object({
  abnormalNum: z.coerce.number().optional().nullable(),
  allNum: z.coerce.number().optional().nullable(),
}).passthrough();

export function unwrapPayload(payload) {
  let current = payload;
  const envelopeKeys = ["data", "result", "content", "records", "list"];
  for (let depth = 0; depth < 5; depth += 1) {
    if (Array.isArray(current) || current == null || typeof current !== "object") return current;
    const key = envelopeKeys.find((candidate) => Object.prototype.hasOwnProperty.call(current, candidate));
    if (!key) return current;
    current = current[key];
  }
  return current;
}

export function parseArray(schema, payload, label) {
  const unwrapped = unwrapPayload(payload);
  const parsed = schema.array().safeParse(unwrapped == null ? [] : unwrapped);
  if (!parsed.success) throw new Error(`${label} response does not match the backend contract`);
  return parsed.data;
}

export function parseObject(schema, payload, label) {
  const parsed = schema.safeParse(unwrapPayload(payload));
  if (!parsed.success) throw new Error(`${label} response does not match the backend contract`);
  return parsed.data;
}
