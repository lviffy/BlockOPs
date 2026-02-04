'use client'

import { PrivyProvider } from '@privy-io/react-auth'
import { Toaster } from '@/components/ui/toaster'
import { useEffect, useState } from 'react'

export function Providers({ children }: { children: React.ReactNode }) {
  const privyAppId = process.env.NEXT_PUBLIC_PRIVY_APP_ID
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!privyAppId) {
    throw new Error('NEXT_PUBLIC_PRIVY_APP_ID is not set')
  }

  // Only render Privy on client side
  if (!mounted) {
    return <>{children}</>
  }

  return (
    <PrivyProvider
      appId={privyAppId}
      config={{
        loginMethods: ['email', 'wallet', 'google', 'github'],
        appearance: {
          theme: 'dark',
          accentColor: '#1a1a1a',
          logo: undefined,
        },
      }}
    >
      {children}
      <Toaster />
    </PrivyProvider>
  )
}
