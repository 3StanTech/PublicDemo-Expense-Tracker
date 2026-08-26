import { describe, expect, it } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { BudgetProgressBars, CategoryDonut, IncomeExpenseBars, NetWorthLine } from './FinanceCharts'

describe('FinanceCharts keyboard accessibility', () => {
  it('IncomeExpenseBars exposes focusable chart region and data table', async () => {
    const user = userEvent.setup()
    render(
      <IncomeExpenseBars
        data={[
          { month: '2024-01', incomeMinor: 10000, expenseMinor: 4000 },
          { month: '2024-02', incomeMinor: 12000, expenseMinor: 5000 },
        ]}
      />,
    )

    const focusRegions = screen.getAllByTestId('chart-focus-region')
    expect(focusRegions.length).toBeGreaterThanOrEqual(1)
    expect(focusRegions[0]).toHaveAttribute('tabindex', '0')
    expect(focusRegions[0]).toHaveAttribute(
      'aria-label',
      expect.stringMatching(/Income versus expense/i),
    )

    const tableRegion = screen.getByTestId('chart-data-table')
    expect(tableRegion).toHaveAttribute('tabindex', '0')
    expect(tableRegion).toHaveAccessibleName(/data table/i)

    await user.tab()
    expect(focusRegions[0]).toHaveFocus()
    await user.tab()
    expect(tableRegion).toHaveFocus()

    expect(within(tableRegion).getByRole('columnheader', { name: 'Income' })).toBeInTheDocument()
    expect(screen.getByTestId('chart-summary').textContent).toMatch(/income/i)
  })

  it('CategoryDonut, NetWorthLine, and BudgetProgressBars are keyboard-focusable', async () => {
    const user = userEvent.setup()
    const { unmount } = render(
      <CategoryDonut data={[{ categoryName: 'Food', amountMinor: 2500 }]} />,
    )
    let focus = screen.getByTestId('chart-focus-region')
    expect(focus).toHaveAttribute('tabindex', '0')
    await user.tab()
    expect(focus).toHaveFocus()
    unmount()

    const { unmount: unmountNw } = render(
      <NetWorthLine data={[{ asOf: '2024-01-31', netWorthMinor: 500000 }]} />,
    )
    focus = screen.getByTestId('chart-focus-region')
    expect(focus).toHaveAttribute('tabindex', '0')
    expect(screen.getByTestId('chart-data-table')).toHaveAttribute('tabindex', '0')
    unmountNw()

    render(
      <BudgetProgressBars
        data={[{ categoryName: 'Food', budgetMinor: 10000, spentMinor: 4000 }]}
      />,
    )
    focus = screen.getByTestId('chart-focus-region')
    expect(focus).toHaveAttribute('tabindex', '0')
    const table = screen.getByTestId('chart-data-table')
    expect(table).toHaveAttribute('tabindex', '0')
    await user.tab()
    expect(focus).toHaveFocus()
    await user.tab()
    expect(table).toHaveFocus()
  })
})
