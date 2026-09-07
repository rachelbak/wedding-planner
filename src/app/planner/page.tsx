import { getTasks } from '@/app/actions/tasks'
import { getCategories } from '@/app/actions/categories'
import AppShell from '@/components/ui/AppShell'
import WeeklyPlanner from '@/components/features/planner/WeeklyPlanner'

export default async function PlannerPage() {
  const [tasksResult, categoriesResult] = await Promise.all([
    getTasks(),
    getCategories(),
  ])
  const tasks      = tasksResult.success      ? tasksResult.data      : []
  const categories = categoriesResult.success ? categoriesResult.data : []

  return (
    <AppShell>
      <WeeklyPlanner initialTasks={tasks} initialCategories={categories} />
    </AppShell>
  )
}
