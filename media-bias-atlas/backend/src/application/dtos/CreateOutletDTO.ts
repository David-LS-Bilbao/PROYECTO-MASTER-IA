import { z } from 'zod';

export const createOutletSchema = z.object({
  countryCode: z.string().length(2, 'El código de país debe tener exactamente 2 caracteres').toUpperCase(),
  name: z.string().min(2, 'El nombre debe tener al menos 2 caracteres').max(100),
  description: z.string().optional().nullable(),
  websiteUrl: z.string().url('Debe ser una URL válida').optional().nullable(),
});

export type CreateOutletDTO = z.infer<typeof createOutletSchema>;
