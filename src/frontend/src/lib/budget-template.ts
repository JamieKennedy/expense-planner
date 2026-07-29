import { apiRequest, type BudgetLine, type BudgetTemplate } from './api'

export function upsertBudgetLine(lines: BudgetLine[], line: BudgetLine) {
  return lines.some((item) => item.id === line.id)
    ? lines.map((item) => (item.id === line.id ? line : item))
    : [...lines, line]
}

export function removeBudgetLine(lines: BudgetLine[], lineId: string) {
  return lines.filter((item) => item.id !== lineId)
}

export function replaceBudgetTemplate(lines: BudgetLine[]) {
  return apiRequest<BudgetTemplate>('/api/budget-template', {
    method: 'PUT',
    body: JSON.stringify({
      lines: lines.map(({ name, allowancePence, tagId, contributorShares }) => ({
        name,
        allowancePence,
        tagId,
        contributorShares,
      })),
    }),
  })
}
