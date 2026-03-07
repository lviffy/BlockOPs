'use client'

import { usePrivy, useWallets } from '@privy-io/react-auth'
import { useEffect, useState } from 'react'
import { supabase, type User } from './supabase'

export function useAuth() {
  const { ready, authenticated, user, login, logout } = usePrivy()
  const { wallets } = useWallets()
  const [dbUser, setDbUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [showPrivateKeySetup, setShowPrivateKeySetup] = useState(false)
  const [hasCheckedPrivateKey, setHasCheckedPrivateKey] = useState(false)

  // Check if user logged in via wallet
  const isWalletLogin = authenticated && wallets && wallets.length > 0
  
  // Get the primary wallet address if available
  const privyWalletAddress = wallets && wallets.length > 0 ? wallets[0].address : null

  useEffect(() => {
    if (ready && authenticated && user) {
      syncUser()
    } else {
      setDbUser(null)
      setLoading(false)
      // Reset the check when user logs out
      setHasCheckedPrivateKey(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, authenticated, user])

  const syncUser = async () => {
    if (!user?.id) {
      console.warn('Cannot sync user: No user ID available')
      return
    }

    setLoading(true)
    try {
      // Check if user exists
      const { data: existingUser, error: fetchError } = await supabase
        .from('users')
        .select('*')
        .eq('id', user.id)
        .single()

      if (fetchError) {
        // PGRST116 = "not found" (this is OK, we'll create the user)
        if (fetchError.code === 'PGRST116') {
          // User doesn't exist, continue to create
        } else {
          // Other error - log full details with proper serialization
          console.error('Error fetching user:', JSON.stringify(fetchError, null, 2))
          console.error('Error details:', {
            message: fetchError.message,
            code: fetchError.code,
            details: fetchError.details,
            hint: fetchError.hint,
            userId: user.id
          })
          setLoading(false)
          return
        }
      }

      if (existingUser) {
        setDbUser(existingUser)
        
        // Check if user needs to set up private key (only once per session)
        if (!existingUser.private_key && !hasCheckedPrivateKey) {
          setShowPrivateKeySetup(true)
          setHasCheckedPrivateKey(true)
        }
      } else {
        // User doesn't exist, create new user
        const { data: newUser, error: createError } = await supabase
          .from('users')
          .insert({
            id: user.id,
            private_key: null,
            wallet_address: null,
          })
          .select()
          .single()

        if (createError) {
          console.error('Error creating user:', createError)
          console.error('Create error details:', {
            message: createError.message,
            code: createError.code,
            details: createError.details,
            hint: createError.hint,
            userId: user.id
          })
        } else {
          setDbUser(newUser)
          
          // Show private key setup modal for new users
          setShowPrivateKeySetup(true)
          setHasCheckedPrivateKey(true)
        }
      }
    } catch (error) {
      console.error('Error syncing user:', error)
    } finally {
      setLoading(false)
    }
  }

  const connectMetaMask = async () => {
    // Use Privy's login modal directly
    try {
      await login()
    } catch (error) {
      console.error('Login error:', error)
    }
  }

  return {
    ready,
    authenticated,
    user,
    dbUser,
    loading,
    login: connectMetaMask,
    logout,
    syncUser,
    isWalletLogin,
    privyWalletAddress,
    showPrivateKeySetup,
    setShowPrivateKeySetup,
  }
}
