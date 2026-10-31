import { z } from 'zod'

export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']),
  NEXT_PUBLIC_SITE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  NEXT_PUBLIC_APP_NAME: z.string().min(1),
  SUPABASE_DB_HOST: z.string(),
  SUPABASE_DB_PORT: z.string().transform(val => parseInt(val, 10)),
  SUPABASE_DB_USER: z.string(),
  SUPABASE_DB_PASSWORD: z.string(),
  SUPABASE_DB_POOL_SIZE: z.string().transform(val => parseInt(val, 10)),
  RESEND_API_KEY: z.string().optional(),
  SCHEDULER_SECRET: z.string().optional(),
})

export type Env = z.infer<typeof envSchema>

export function getEnv(): Env {
  const result = envSchema.safeParse(process.env)
  if (!result.success) {
    console.error('❌ Missing or invalid environment variables:')
    console.error(result.error.format())
    throw new Error('Missing or invalid environment variables')
  }
  return result.data
}