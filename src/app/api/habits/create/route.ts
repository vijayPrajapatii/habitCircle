import { NextResponse } from 'next/server'
import { createHabit } from '@/features/habits/actions'

export async function POST(request: Request) {
  try {
    const body = await request.json()

    // Convert to FormData-like structure for the action
    const formData = new FormData()
    formData.append('group_id', body.group_id)
    formData.append('name', body.name)
    formData.append('frequency', body.frequency)
    formData.append('target_quantity', String(body.target_quantity || 1))
    formData.append('timezone', body.timezone || 'UTC')

    const result = await createHabit(formData)

    if (result.error) {
      return NextResponse.json(
        { error: result.error },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { habit: result.habit },
      { status: 201 }
    )
  } catch (error) {
    console.error('Error creating habit:', error)
    return NextResponse.json(
      { error: 'Failed to create habit' },
      { status: 500 }
    )
  }
}