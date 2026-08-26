import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ConfirmDialog, Dialog } from './Dialog'

describe('Dialog focus containment', () => {
  it('traps Tab and Shift+Tab inside the open dialog', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    render(
      <Dialog
        open
        onClose={onClose}
        title="Focus trap"
        footer={
          <button type="button" data-testid="footer-btn">
            Footer
          </button>
        }
      >
        <button type="button" data-testid="body-btn">
          Body
        </button>
      </Dialog>,
    )

    const closeBtn = screen.getByRole('button', { name: 'Close' })
    const bodyBtn = screen.getByTestId('body-btn')
    const footerBtn = screen.getByTestId('footer-btn')

    closeBtn.focus()
    expect(closeBtn).toHaveFocus()

    await user.tab()
    expect(bodyBtn).toHaveFocus()
    await user.tab()
    expect(footerBtn).toHaveFocus()
    await user.tab()
    expect(closeBtn).toHaveFocus()

    await user.tab({ shift: true })
    expect(footerBtn).toHaveFocus()
  })

  it('closes on Escape and restores focus', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    const opener = document.createElement('button')
    opener.textContent = 'Open'
    document.body.appendChild(opener)
    opener.focus()

    const { rerender } = render(
      <Dialog open onClose={onClose} title="Esc">
        <p>Content</p>
      </Dialog>,
    )

    await user.keyboard('{Escape}')
    expect(onClose).toHaveBeenCalled()

    rerender(
      <Dialog open={false} onClose={onClose} title="Esc">
        <p>Content</p>
      </Dialog>,
    )
    expect(opener).toHaveFocus()
    opener.remove()
  })
})

describe('ConfirmDialog error feedback', () => {
  it('announces an error while remaining open for retry', () => {
    render(
      <ConfirmDialog
        open
        title="Delete?"
        message="Sure?"
        onConfirm={() => undefined}
        onClose={() => undefined}
        error="Network failed"
      />,
    )
    expect(screen.getByRole('alert')).toHaveTextContent('Network failed')
    expect(screen.getByRole('button', { name: 'Delete' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeEnabled()
  })
})
