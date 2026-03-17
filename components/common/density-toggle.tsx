'use client'

import { useEffect, useState } from 'react'

import { Switch } from '@/components/ui/switch'
import { cn } from '@/lib/utils'

type Density = 'compact' | 'comfortable'

const STORAGE_KEY = 'ui-density'

function readCurrentDensity(): Density {
  const value = document.documentElement.dataset.density
  return value === 'compact' ? 'compact' : 'comfortable'
}

export function DensityToggle({ className }: { className?: string }) {
  const [density, setDensity] = useState<Density>('comfortable')

  useEffect(() => {
    setDensity(readCurrentDensity())
  }, [])

  const isCompact = density === 'compact'

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <span className="text-xs font-semibold tracking-[0.16em] text-slate-500 uppercase">Compact</span>
      <Switch
        checked={isCompact}
        onCheckedChange={(checked) => {
          const next: Density = checked ? 'compact' : 'comfortable'
          document.documentElement.dataset.density = next
          try {
            localStorage.setItem(STORAGE_KEY, next)
          } catch {}
          setDensity(next)
        }}
        aria-label="Toggle compact layout"
      />
    </div>
  )
}

