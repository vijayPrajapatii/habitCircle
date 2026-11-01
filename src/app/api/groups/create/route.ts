import { NextResponse } from 'next/server'
import { createGroup } from '@/features/groups/actions'

export async function POST(request: Request) {
  try {
    const formData = await request.formData()
    const result = await createGroup(formData)

    if (result.error) {
      return NextResponse.json(
        { error: result.error },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { group: result.group },
      { status: 201 }
    )
  } catch (error) {
    console.error('Error creating group:', error)
    return NextResponse.json(
      { error: 'Failed to create group' },
      { status: 500 }
    )
  }
}