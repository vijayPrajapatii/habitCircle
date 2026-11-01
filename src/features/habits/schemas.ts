import { z } from 'zod'

export const habitFormSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100, 'Name too long'),
  frequency: z.enum(['daily', 'weekly', 'monthly', 'quantity', 'custom']),
  target_quantity: z.number().int().positive().default(1),
  timezone: z.string().default('UTC'),
  description: z.string().max(500).optional(),
})

export type HabitFormValues = z.infer<typeof habitFormSchema>