'use client'

import dynamic from 'next/dynamic'

const RegisterForm = dynamic(() => import('@/components/auth/register-form'), {
  ssr: false,
  loading: () => (
    <div className="min-h-screen flex items-center justify-center bg-[#F7F3EB] text-[#5B6166] font-serif text-sm">
      Memuat Pendaftaran Akun...
    </div>
  ),
})

export default function RegisterPage() {
  return <RegisterForm />
}
