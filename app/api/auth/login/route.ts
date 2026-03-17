import { NextRequest, NextResponse } from 'next/server'

import { batchOps } from '@/lib/db'
import { batchLoginSchema } from '@/lib/schemas'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { supabaseAuth } from '@/lib/supabaseAuth'

const BATCH_CREDENTIALS: Record<string, string> = {
  '2023-27': '2327',
  '2024-28': '2428',
  '2025-29': '2529',
  '2026-30': '2630',
}

function batchEmail(batchName: string) {
  return `batch-${batchName.toLowerCase()}@sms.local`
}

async function findAuthUserByEmail(email: string) {
  // supabase-js v2 doesn't expose getUserByEmail; list + filter is the supported approach.
  // These batch accounts are few, so a small paged scan is fine.
  const normalizedEmail = email.trim().toLowerCase()
  const perPage = 1000

  for (let page = 1; page <= 10; page++) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage })
    if (error) throw error

    const match = data.users.find((user) => (user.email ?? '').toLowerCase() === normalizedEmail)
    if (match) return match

    if (data.users.length < perPage) return null
  }

  return null
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { batchName, password } = batchLoginSchema.parse(body)

    if (!BATCH_CREDENTIALS[batchName] || BATCH_CREDENTIALS[batchName] !== password) {
      return NextResponse.json({ error: 'Invalid batch name or password' }, { status: 401 })
    }

    const email = batchEmail(batchName)
    const { data: signIn, error: signInError } = await supabaseAuth.auth.signInWithPassword({
      email,
      password,
    })

    if (signInError || !signIn.session) {
      const existingUser = await findAuthUserByEmail(email)

      if (existingUser) {
        await supabaseAdmin.auth.admin.updateUserById(existingUser.id, {
          password,
          email_confirm: true,
        })
      } else {
        await supabaseAdmin.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
        })
      }

      const { error: retryError } = await supabaseAuth.auth.signInWithPassword({
        email,
        password,
      })
      if (retryError) {
        return NextResponse.json({ error: 'Authentication failed' }, { status: 401 })
      }
    }

    let batch = await batchOps.getByName(batchName)
    if (!batch) {
      await batchOps.create(batchName, 'system')
      batch = await batchOps.getByName(batchName)
    }

    return NextResponse.json({
      batch_id: batch?.batch_id,
      batch_name: batch?.batch_name,
      created_at: batch?.created_at,
      role: 'admin',
    })
  } catch (error) {
    console.error('[v0] Auth login error:', error)
    return NextResponse.json({ error: 'Authentication failed' }, { status: 400 })
  }
}
