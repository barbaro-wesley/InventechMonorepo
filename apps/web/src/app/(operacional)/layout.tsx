'use client'

import Link from 'next/link'
import { useRouter, usePathname } from 'next/navigation'
import { ArrowLeft, Bell, LogOut, Settings, LayoutGrid, Wrench } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useCurrentUser } from '@/store/auth.store'
import { useAuth } from '@/hooks/auth/use-auth'

function getInitials(name: string) {
  return name
    .split(' ')
    .slice(0, 2)
    .map((n) => n[0])
    .join('')
    .toUpperCase()
}

function getAvatarColor(name: string) {
  const colors = [
    'bg-blue-500',
    'bg-emerald-500',
    'bg-violet-500',
    'bg-amber-500',
    'bg-rose-500',
    'bg-cyan-500',
    'bg-indigo-500',
    'bg-teal-500',
  ]
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash)
  return colors[Math.abs(hash) % colors.length]
}

export default function OperacionalLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const user = useCurrentUser()
  const { logout } = useAuth()
  const router = useRouter()
  const pathname = usePathname()

  const isTechnician = user?.role === 'TECHNICIAN'
  const canSeeOperacional = user?.role !== 'TECHNICIAN'

  return (
    <div className="flex h-screen flex-col bg-[#f3f4f7] overflow-hidden">
      {/* Header */}
      <header className="h-14 shrink-0 border-b border-[#e0e5eb] bg-white/80 backdrop-blur-md flex items-center px-4 gap-3 z-20">
        {/* Voltar */}
        <Button
          variant="ghost"
          size="sm"
          className="gap-1.5 text-[#6c7c93] hover:text-[#0a3776]"
          onClick={() => router.push('/dashboard')}
        >
          <ArrowLeft className="h-4 w-4" />
          <span className="hidden sm:inline text-sm">Dashboard</span>
        </Button>

        <div className="w-px h-5 bg-[#e0e5eb]" />

        {/* Logo */}
        <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-[#0a3776] to-[#1162d4] flex items-center justify-center shrink-0">
          <span className="text-white text-xs font-bold">OS</span>
        </div>

        {/* Tabs de navegação */}
        <nav className="flex items-center gap-0.5">
          {/* Painel Técnico — sempre visível */}
          <Link
            href="/tecnico"
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              pathname === '/tecnico'
                ? 'bg-[#f3f4f7] text-[#0a3776]'
                : 'text-[#6c7c93] hover:text-[#1d2530] hover:bg-[#f3f4f7]'
            }`}
          >
            <Wrench className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">
              {isTechnician ? 'Minhas OS' : 'Painel Técnico'}
            </span>
          </Link>

          {/* Painel Operacional — apenas para não-técnicos */}
          {canSeeOperacional && (
            <Link
              href="/operacional"
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                pathname === '/operacional'
                  ? 'bg-[#f3f4f7] text-[#0a3776]'
                  : 'text-[#6c7c93] hover:text-[#1d2530] hover:bg-[#f3f4f7]'
              }`}
            >
              <LayoutGrid className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Operacional</span>
            </Link>
          )}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          {/* Notificações */}
          <Button variant="ghost" size="icon" className="relative text-[#6c7c93]">
            <Bell className="h-4 w-4" />
          </Button>

          {/* Avatar + menu */}
          {user && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-[#f3f4f7] transition-colors">
                  <div
                    className={`h-7 w-7 rounded-full ${getAvatarColor(user.name)} flex items-center justify-center shrink-0`}
                  >
                    <span className="text-white text-xs font-semibold">
                      {getInitials(user.name)}
                    </span>
                  </div>
                  <div className="hidden sm:block text-left">
                    <p className="text-xs font-medium text-[#1d2530] leading-none">
                      {user.name.split(' ')[0]}
                    </p>
                  </div>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <div className="px-3 py-2">
                  <p className="text-sm font-medium text-[#1d2530]">{user.name}</p>
                  <p className="text-xs text-[#6c7c93]">{user.email}</p>
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href="/configuracoes" className="flex items-center gap-2">
                    <Settings className="h-4 w-4" />
                    Configurações
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => logout()}
                  className="text-red-600 focus:text-red-600"
                >
                  <LogOut className="h-4 w-4 mr-2" />
                  Sair
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 overflow-hidden">
        {children}
      </main>
    </div>
  )
}
