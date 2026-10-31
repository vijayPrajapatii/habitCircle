'use server'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { z } from 'zod'

const signUpSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  username: z.string().min(3).max(30).regex(/^[a-z0-9_]+$/),
})

export async function signUp(formData: FormData) {
  const supabase = await createClient()

  const rawData = {
    email: formData.get('email'),
    password: formData.get('password'),
    username: formData.get('username'),
  }

  const result = signUpSchema.safeParse(rawData)
  if (!result.success) {
    return { error: 'Invalid input' }
  }

  const { email, password, username } = result.data

  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { username },
      emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/dashboard`,
    },
  })

  if (error) {
    return { error: error.message }
  }

  redirect('/login?message=Check your email to confirm your account')
}

const signInSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
})

export async function signIn(formData: FormData) {
  const supabase = await createClient()

  const rawData = {
    email: formData.get('email'),
    password: formData.get('password'),
  }

  const result = signInSchema.safeParse(rawData)
  if (!result.success) {
    return { error: 'Invalid input' }
  }

  const { email, password } = result.data

  const { error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) {
    return { error: error.message }
  }

  redirect('/dashboard')
}

export async function signOut() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/login')
}

export async function resetPassword(formData: FormData) {
  const supabase = await createClient()

  const email = formData.get('email') as string
  if (!email) {
    return { error: 'Email is required' }
  }

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/reset-password`,
  })

  if (error) {
    return { error: error.message }
  }

  return { success: true }
}

export async function updatePassword(formData: FormData) {
  const supabase = await createClient()

  const password = formData.get('password') as string
  const confirmPassword = formData.get('confirmPassword') as string

  if (!password || password.length < 8) {
    return { error: 'Password must be at least 8 characters' }
  }

  if (password !== confirmPassword) {
    return { error: 'Passwords do not match' }
  }

  const { error } = await supabase.auth.updateUser({ password })

  if (error) {
    return { error: error.message }
  }

  redirect('/login?message=Password updated successfully')
}