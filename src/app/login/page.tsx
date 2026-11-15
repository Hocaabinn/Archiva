'use client'

import { Suspense } from 'react'
import LoginForm from '@/components/auth/login-form'

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#F0F5FA] flex items-center justify-center text-sm text-[#4B5E76]">Memuat...</div>}>
      <LoginForm />
    </Suspense>
  )
}
