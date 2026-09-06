import { getTasks } from '@/app/actions/tasks'
import AppShell from '@/components/ui/AppShell'
import TaskChecklist from '@/components/features/checklist/TaskChecklist'

export default async function ChecklistPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string }>
}) {
  const result = await getTasks()
  const tasks = result.success ? result.data : []
  const { category } = await searchParams

  return (
    <AppShell>
      <TaskChecklist initialTasks={tasks} initialCategory={category} />
    </AppShell>
  )
}
