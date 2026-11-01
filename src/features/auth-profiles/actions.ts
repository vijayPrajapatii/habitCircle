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
    return { error: 'Invalid input. Please check your email, password, and username.' }
  }

  const { email, password, username } = result.data

  const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { username, timezone: 'UTC' }, // Stored in user_metadata
      emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/login?message=Check your email to confirm your account`,
    },
  })

  if (signUpError) {
    // Return user-friendly error messages for common issues
    if (signUpError.message.toLowerCase().includes('user already registered') || signUpError.message.toLowerCase().includes('email already registered')) {
      return { error: 'An account with this email already exists. Please sign in or use a different email.' }
    }
    if (signUpError.message.toLowerCase().includes('rate limit') || signUpError.message.toLowerCase().includes('too many')) {
      return { error: 'Too many sign-up attempts. Please check your email for a confirmation link, or wait a few minutes before trying again.' }
    }
    // Check for constraint violations
    if (signUpError.message.toLowerCase().includes('constraint') || signUpError.message.toLowerCase().includes('violates')) {
      return { error: 'Unable to create account. Please try a different username or email.' }
    }
    return { error: signUpError.message }
  }

  return { success: true }
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