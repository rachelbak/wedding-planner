import { getTasks } from '@/app/actions/tasks'
import AppShell from '@/components/ui/AppShell'
import WeeklyPlanner from '@/components/features/planner/WeeklyPlanner'

export default async function PlannerPage() {
  const result = await getTasks()
  const tasks = result.success ? result.data : []

  return (
    <AppShell>
      <WeeklyPlanner initialTasks={tasks} />
    </AppShell>
  )
}
