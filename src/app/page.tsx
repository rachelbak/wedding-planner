import { getTasks } from '@/app/actions/tasks'
import AppShell from '@/components/ui/AppShell'
import DashboardOverview from '@/components/features/dashboard/DashboardOverview'

export default async function HomePage() {
  const result = await getTasks()
  // Degrade gracefully when the DB is not yet connected
  const tasks = result.success ? result.data : []

  return (
    <AppShell>
      <DashboardOverview tasks={tasks} />
    </AppShell>
  )
}
