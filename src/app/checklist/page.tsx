import { getTasks } from '@/app/actions/tasks'
import { getCategories } from '@/app/actions/categories'
import AppShell from '@/components/ui/AppShell'
import TaskChecklist from '@/components/features/checklist/TaskChecklist'

export default async function ChecklistPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string }>
}) {
  const [tasksResult, categoriesResult] = await Promise.all([
    getTasks(),
    getCategories(),
  ])
  const tasks      = tasksResult.success      ? tasksResult.data      : []
  const categories = categoriesResult.success ? categoriesResult.data : []
  const { category } = await searchParams

  return (
    <AppShell>
      <TaskChecklist
        initialTasks={tasks}
        initialCategories={categories}
        initialCategory={category}
      />
    </AppShell>
  )
}
