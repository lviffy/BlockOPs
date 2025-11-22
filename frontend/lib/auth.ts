'use client'

import { usePrivy, useWallets } from '@privy-io/react-auth'
import { useEffect, useState } from 'react'
import { supabase, type User } from './supabase'

export function useAuth() {
  const { ready, authenticated, user, login, logout } = usePrivy()
  const { wallets } = useWallets()
  const [dbUser, setDbUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  // Check if user logged in via wallet
  const isWalletLogin = authenticated && wallets && wallets.length > 0
  
  // Get the primary wallet address if available
  const privyWalletAddress = wallets && wallets.length > 0 ? wallets[0].address : null

  console.log('useAuth Debug:', { 
    authenticated, 
    walletsCount: wallets?.length, 
    privyWalletAddress,
    dbUserWallet: dbUser?.wallet_address,
    isWalletLogin 
  })

  useEffect(() => {
    if (ready && authenticated && user) {
      syncUser()
    } else {
      setDbUser(null)
      setLoading(false)
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
      console.log('Syncing user with ID:', user.id)
      
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
          console.log('User not found in database, will create new user')
        } else {
          // Other error - log full details
          console.error('Error fetching user:', fetchError)
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
        // User exists, update if needed
        console.log('User found in database:', existingUser.id)
        setDbUser(existingUser)
      } else {
        // User doesn't exist, create new user
        console.log('Creating new user in database')
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
          console.log('User created successfully:', newUser.id)
          setDbUser(newUser)
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
  }
}
