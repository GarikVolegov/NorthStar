import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';

const useDynamicTranslationMock = vi.hoisted(() => vi.fn());

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    i18n: { language: 'en-US', resolvedLanguage: 'en-US' },
  }),
}));

vi.mock('@/lib/dynamic-translation', () => ({
  useDynamicTranslation: useDynamicTranslationMock,
}));

import {
  WendyEmptyState,
  _resetWendyEmptyStateForTest,
} from './WendyEmptyState';

describe('WendyEmptyState', () => {
  beforeEach(() => {
    _resetWendyEmptyStateForTest();
    useDynamicTranslationMock.mockImplementation(
      ({ key, source }: { key?: string; source: string }) => key ? `dynamic:${key}` : source,
    );
  });

  afterEach(() => {
    _resetWendyEmptyStateForTest();
    vi.clearAllMocks();
  });

  it('renders capability cards through dynamic translations on first show', () => {
    render(
      <WendyEmptyState
        starterPrompts={[]}
        onPromptSelect={() => undefined}
      />,
    );
    expect(screen.getByRole('region', { name: 'dynamic:wendy.empty.regionLabel' })).toBeInTheDocument();
    expect(screen.getByText('dynamic:wendy.empty.title')).toBeInTheDocument();
    expect(screen.getByText('dynamic:wendy.empty.subtitle')).toBeInTheDocument();
    expect(screen.getByText('dynamic:wendy.empty.capabilities.knowsYou.title')).toBeInTheDocument();
    expect(screen.getByText('dynamic:wendy.empty.capabilities.marketLive.title')).toBeInTheDocument();
    expect(screen.getByText('dynamic:wendy.empty.capabilities.actsForYou.title')).toBeInTheDocument();
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
    const dismiss = screen.getByRole('button', { name: 'dynamic:wendy.empty.dismiss' });
    fireEvent.click(dismiss);
    // Lo stato è dismissed → ri-render senza capability cards
    expect(screen.queryByText('dynamic:wendy.empty.capabilities.knowsYou.title')).not.toBeInTheDocument();

    // Un nuovo render legge da localStorage e parte già dismissed
    rerender(
      <WendyEmptyState
        starterPrompts={[{ label: 'Prova', icon: '✨' }]}
        onPromptSelect={() => undefined}
      />,
    );
    expect(screen.queryByText('dynamic:wendy.empty.capabilities.knowsYou.title')).not.toBeInTheDocument();
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
    expect(screen.queryByText('dynamic:wendy.empty.startWith')).not.toBeInTheDocument();
  });
});
