import { z } from 'zod';

export const createOutletSchema = z.object({
  countryCode: z
    .string()
    .length(2, 'El código de país debe tener exactamente 2 letras')
    .toUpperCase(),
  name: z
    .string()
    .min(2, 'El nombre debe tener al menos 2 caracteres')
    .max(100, 'El nombre no puede exceder los 100 caracteres'),
  websiteUrl: z
    .string()
    .url('Debe ser una URL válida')
    .optional()
    .or(z.literal('')),
});

export type CreateOutletFormData = z.infer<typeof createOutletSchema>;
