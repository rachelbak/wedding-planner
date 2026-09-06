import { getTasks } from '@/app/actions/tasks'
import AppShell from '@/components/ui/AppShell'
import BudgetDashboard from '@/components/features/budget/BudgetDashboard'

export default async function BudgetPage() {
  const result = await getTasks()
  const allTasks = result.success ? result.data : []
  const vendorTasks = allTasks.filter((t) => t.category === 'logistics_and_vendors')

  return (
    <AppShell>
      <BudgetDashboard vendorTasks={vendorTasks} />
    </AppShell>
  )
}
