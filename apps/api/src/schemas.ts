import { z } from 'zod';
const title = z.string().trim().min(2).max(120);
const description = z.string().max(5000).default('');
const id = z.string().min(1).max(100);
const nullableId = id.nullable().optional();
const safeUrl = z
  .string()
  .url()
  .max(2048)
  .refine((s) => new URL(s).protocol === 'https:', 'Use an HTTPS URL');
export const schemas = {
  leads: z.object({
    name: title,
    email: z.string().trim().toLowerCase().email().max(254),
    phone: z.string().max(30).nullable().optional(),
    instagram: z.string().max(80).nullable().optional(),
    source: z.string().max(100).default('Manual'),
    tags: z.array(z.string().trim().min(1).max(30)).max(20).default([]),
    status: z.enum(['NEW', 'CONTACTED', 'QUALIFIED', 'CONVERTED', 'LOST']).default('NEW'),
  }),
  forms: z.object({
    name: title,
    slug: z
      .string()
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
      .min(3)
      .max(80),
    description,
    consentText: z.string().min(10).max(1000),
    fields: z
      .array(
        z.object({
          key: z.string().regex(/^[a-z][a-z0-9_]{0,29}$/),
          label: title,
          required: z.boolean(),
          type: z.enum(['text', 'number']),
        }),
      )
      .max(10)
      .default([]),
    published: z.boolean().default(false),
  }),
  magnets: z.object({
    name: title,
    description,
    resourceUrl: safeUrl.nullable().optional(),
    fileId: nullableId,
    formId: nullableId,
    published: z.boolean().default(false),
  }),
  products: z.object({
    name: title,
    description,
    kind: z.enum(['DOWNLOAD', 'COURSE']).default('DOWNLOAD'),
    priceMinor: z.number().int().min(50).max(100000000),
    currency: z.enum(['INR', 'USD', 'EUR', 'GBP']).default('INR'),
    published: z.boolean().default(false),
    fileId: nullableId,
    courseId: nullableId,
  }),
  courses: z.object({
    name: title,
    description,
    published: z.boolean().default(false),
    free: z.boolean().default(false),
  }),
  automations: z.object({
    name: title,
    accountId: nullableId,
    trigger: z.literal('COMMENT').default('COMMENT'),
    mediaId: z.string().regex(/^\d+$/).nullable().optional(),
    keywords: z.array(z.string().trim().min(1).max(80)).min(1).max(20),
    matchMode: z.enum(['EXACT', 'CONTAINS']).default('CONTAINS'),
    message: z.string().min(1).max(1000),
    status: z.enum(['DRAFT', 'ACTIVE', 'PAUSED', 'ARCHIVED']).default('DRAFT'),
  }),
  support: z.object({ subject: title, body: z.string().min(10).max(10000) }),
};
export const models: Record<string, string> = {
  leads: 'lead',
  forms: 'leadForm',
  magnets: 'leadMagnet',
  products: 'product',
  courses: 'course',
  automations: 'automation',
  support: 'supportTicket',
};
export type Resource = keyof typeof schemas;
export const graphSchema = z.object({
  nodes: z
    .array(
      z.object({
        id: z.string().min(1).max(60),
        type: z.enum([
          'leadCreated',
          'formSubmitted',
          'hasTag',
          'hasConsent',
          'addTag',
          'updateStatus',
          'notification',
          'end',
        ]),
        position: z.object({ x: z.number(), y: z.number() }),
        data: z.object({ label: z.string().max(100), value: z.string().max(300).optional() }),
      }),
    )
    .min(2)
    .max(40),
  edges: z
    .array(
      z.object({
        id: z.string().max(100),
        source: z.string(),
        target: z.string(),
        sourceHandle: z.enum(['yes', 'no']).nullable().optional(),
      }),
    )
    .max(80),
});
export type Graph = z.infer<typeof graphSchema>;
export function validateGraph(graph: Graph) {
  const errors: string[] = [];
  const ids = new Set(graph.nodes.map((n) => n.id));
  if (ids.size !== graph.nodes.length) errors.push('Node IDs must be unique');
  const triggers = graph.nodes.filter((n) => ['leadCreated', 'formSubmitted'].includes(n.type));
  if (triggers.length !== 1) errors.push('Use exactly one trigger');
  const visited = new Set<string>(),
    stack = new Set<string>();
  const walk = (id: string) => {
    if (stack.has(id)) {
      errors.push('Workflow contains a loop');
      return;
    }
    if (visited.has(id)) return;
    visited.add(id);
    stack.add(id);
    for (const e of graph.edges.filter((e) => e.source === id)) walk(e.target);
    stack.delete(id);
  };
  for (const e of graph.edges) {
    if (!ids.has(e.source) || !ids.has(e.target))
      errors.push('Connection references a missing node');
    if (triggers.some((n) => n.id === e.target))
      errors.push('Triggers cannot have incoming connections');
  }
  if (triggers[0]) walk(triggers[0].id);
  if (visited.size !== ids.size) errors.push('Every node must be reachable from the trigger');
  for (const n of graph.nodes) {
    const outgoing = graph.edges.filter((e) => e.source === n.id);
    if (n.type === 'end' && outgoing.length)
      errors.push('End nodes cannot have outgoing connections');
    else if (['hasTag', 'hasConsent'].includes(n.type)) {
      if (
        outgoing.length !== 2 ||
        !outgoing.some((e) => e.sourceHandle === 'yes') ||
        !outgoing.some((e) => e.sourceHandle === 'no')
      )
        errors.push('Conditions require one yes and one no branch');
    } else if (n.type !== 'end' && outgoing.length !== 1)
      errors.push('Each action needs one next step');
    if (['hasTag', 'addTag', 'notification'].includes(n.type) && !n.data.value?.trim())
      errors.push(`${n.type} requires a value`);
    if (
      n.type === 'updateStatus' &&
      !['NEW', 'CONTACTED', 'QUALIFIED', 'CONVERTED', 'LOST'].includes(n.data.value || '')
    )
      errors.push('Choose a valid lead status');
  }
  return [...new Set(errors)];
}
export function keywordMatches(text: string, keywords: string[], mode: string) {
  const value = text.normalize('NFKC').toLocaleLowerCase('en-US').trim();
  return keywords.some((k) =>
    mode === 'EXACT'
      ? value === k.normalize('NFKC').toLocaleLowerCase('en-US').trim()
      : value.includes(k.normalize('NFKC').toLocaleLowerCase('en-US').trim()),
  );
}
