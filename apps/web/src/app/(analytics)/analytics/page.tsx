'use client'

import { useState } from 'react'
import { LayoutDashboard, Wrench, Cpu, Users, CalendarCheck, DollarSign } from 'lucide-react'
import { FilterBar, type AnalyticsFilters } from './_components/filter-bar'
import { SectionOverview } from './_components/section-overview'
import { SectionOs } from './_components/section-os'
import { SectionEquipment } from './_components/section-equipment'
import { SectionTechnicians } from './_components/section-technicians'
import { SectionPreventive } from './_components/section-preventive'
import { SectionFinancial } from './_components/section-financial'
import { cn } from '@/lib/utils'

type Tab = 'overview' | 'os' | 'equipment' | 'technicians' | 'preventive' | 'financial'

const TABS: { id: Tab; label: string; icon: React.ElementType; description: string }[] = [
  { id: 'overview',    label: 'Visão Geral',       icon: LayoutDashboard, description: 'KPIs consolidados e evolução geral' },
  { id: 'os',          label: 'Ordens de Serviço',  icon: Wrench,          description: 'Desempenho, backlog e SLA' },
  { id: 'equipment',   label: 'Equipamentos',       icon: Cpu,             description: 'Parque, falhas e disponibilidade' },
  { id: 'technicians', label: 'Técnicos',           icon: Users,           description: 'Performance e ranking individual' },
  { id: 'preventive',  label: 'Preventivas',        icon: CalendarCheck,   description: 'Aderência, atrasos e próximas' },
  { id: 'financial',   label: 'Financeiro',         icon: DollarSign,      description: 'Custos, TCO e tendências' },
]

function defaultFilters(): AnalyticsFilters {
  const end = new Date()
  const start = new Date()
  start.setDate(start.getDate() - 30)
  return {
    startDate: start.toISOString().slice(0, 10),
    endDate: end.toISOString().slice(0, 10),
  }
}

export default function AnalyticsPage() {
  const [activeTab, setActiveTab] = useState<Tab>('overview')
  const [filters, setFilters] = useState<AnalyticsFilters>(defaultFilters)

  const activeTabMeta = TABS.find((t) => t.id === activeTab)!

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Tab bar */}
      <div className="bg-white border-b border-[#e8ecf1] shrink-0">
        <div className="flex items-end gap-0 px-6 overflow-x-auto scrollbar-none">
          {TABS.map((tab) => {
            const Icon = tab.icon
            const isActive = activeTab === tab.id
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 whitespace-nowrap transition-colors shrink-0',
                  isActive
                    ? 'border-[#1162d4] text-[#0a3776]'
                    : 'border-transparent text-[#6c7c93] hover:text-[#1d2530] hover:border-[#e0e5eb]',
                )}
              >
                <Icon className="h-4 w-4" />
                <span>{tab.label}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Filter bar */}
      <FilterBar filters={filters} onChange={setFilters} />

      {/* Section header */}
      <div className="px-6 pt-5 pb-1 shrink-0">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-[#0a3776] to-[#1162d4] flex items-center justify-center shrink-0">
            <activeTabMeta.icon className="h-4 w-4 text-white" />
          </div>
          <div>
            <h1 className="text-base font-bold text-[#1d2530] leading-none">{activeTabMeta.label}</h1>
            <p className="text-xs text-[#6c7c93] mt-0.5">{activeTabMeta.description}</p>
          </div>
          <div className="ml-auto text-xs text-[#6c7c93]">
            {filters.startDate} → {filters.endDate}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-6 py-4">
        {activeTab === 'overview'    && <SectionOverview    filters={filters} />}
        {activeTab === 'os'          && <SectionOs          filters={filters} />}
        {activeTab === 'equipment'   && <SectionEquipment   filters={filters} />}
        {activeTab === 'technicians' && <SectionTechnicians filters={filters} />}
        {activeTab === 'preventive'  && <SectionPreventive  filters={filters} />}
        {activeTab === 'financial'   && <SectionFinancial   filters={filters} />}
        <div className="h-6" />
      </div>
    </div>
  )
}
