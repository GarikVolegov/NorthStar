import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import {
  WendyEmptyState,
  _resetWendyEmptyStateForTest,
} from './WendyEmptyState';

describe('WendyEmptyState', () => {
  beforeEach(() => {
    _resetWendyEmptyStateForTest();
  });

  afterEach(() => {
    _resetWendyEmptyStateForTest();
  });

  it('renders capability cards on first show', () => {
    render(
      <WendyEmptyState
        starterPrompts={[]}
        onPromptSelect={() => undefined}
      />,
    );
    expect(screen.getByText('Conosco te')).toBeInTheDocument();
    expect(screen.getByText('Conosco il mercato')).toBeInTheDocument();
    expect(screen.getByText('Agisco per te')).toBeInTheDocument();
  });

  it('renders starter prompts and forwards click to onPromptSelect', () => {
    const onPromptSelect = vi.fn();
    render(
      <WendyEmptyState
        starterPrompts={[
          { label: 'Analizza i miei progressi', icon: '📊' },
          { label: 'Cosa dovrei fare oggi?', icon: '🎯' },
        ]}
        onPromptSelect={onPromptSelect}
      />,
    );

    const button = screen.getByRole('button', {
      name: /Analizza i miei progressi/i,
    });
    fireEvent.click(button);
    expect(onPromptSelect).toHaveBeenCalledWith('Analizza i miei progressi');
  });

  it('hides the capability presentation after dismiss', async () => {
    const { rerender } = render(
      <WendyEmptyState starterPrompts={[]} onPromptSelect={() => undefined} />,
    );
    const dismiss = screen.getByRole('button', {
      name: /Nascondi la presentazione/i,
    });
    fireEvent.click(dismiss);
    // Lo stato è dismissed → ri-render senza capability cards
    expect(screen.queryByText('Conosco te')).not.toBeInTheDocument();

    // Un nuovo render legge da localStorage e parte già dismissed
    rerender(
      <WendyEmptyState
        starterPrompts={[{ label: 'Prova', icon: '✨' }]}
        onPromptSelect={() => undefined}
      />,
    );
    expect(screen.queryByText('Conosco te')).not.toBeInTheDocument();
    // ma i starter prompts restano visibili
    expect(screen.getByRole('button', { name: /Prova/i })).toBeInTheDocument();
  });

  it('omits the starter prompts section when the list is empty', () => {
    render(
      <WendyEmptyState
        starterPrompts={[]}
        onPromptSelect={() => undefined}
      />,
    );
    expect(screen.queryByText(/Prova a chiedermi/i)).not.toBeInTheDocument();
  });
});
