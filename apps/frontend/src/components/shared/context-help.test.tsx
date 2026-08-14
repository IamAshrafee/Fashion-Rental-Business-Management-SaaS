import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ContextHelp } from './context-help';

describe('ContextHelp', () => {
  it('has a focusable accessible trigger associated with its meaning', async () => {
    const user = userEvent.setup();
    render(<ContextHelp helpKey="inventory.acquisitionCost" />);

    await user.tab();
    const trigger = screen.getByRole('button', { name: 'Help: Unit acquisition cost' });
    expect(trigger).toHaveFocus();
    expect(trigger).toHaveAttribute('aria-describedby');
    expect(screen.getByText('The private amount invested in one exact physical item.')).toHaveClass(
      'sr-only',
    );
  });

  it('opens by click and renders the structured example and effect', async () => {
    const user = userEvent.setup();
    render(<ContextHelp helpKey="inventory.acquisitionCost" />);

    await user.click(screen.getByRole('button', { name: 'Help: Unit acquisition cost' }));
    expect(screen.getByText('Fashion-rental example')).toBeVisible();
    expect(screen.getByText(/Two identical dresses may cost/)).toBeVisible();
    expect(screen.getByText(/never exposed as the public reference retail value/)).toBeVisible();
  });

  it('dismisses with Escape and returns focus to the trigger', async () => {
    const user = userEvent.setup();
    render(<ContextHelp helpKey="fulfillment.assignment" />);
    const trigger = screen.getByRole('button', { name: 'Help: Physical-item assignment' });

    await user.click(trigger);
    expect(screen.getByText('Physical-item assignment')).toBeVisible();
    await user.keyboard('{Escape}');
    expect(screen.queryByText('Physical-item assignment')).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });
});
