import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement, type ReactNode } from 'react';
import { _resetWendyInsightToastForTest, useWendyInsightToast } from './useWendyInsightToast';
import type { ProactiveInsight } from './useProactiveInsights';

const toastSpy = vi.hoisted(() => vi.fn());
const markReadSpy = vi.hoisted(() => vi.fn());
const useProactiveInsightsMock = vi.hoisted(() =>
  vi.fn<() => {
    insights: ProactiveInsight[];
    markRead: (id: number) => void;
    unreadCount: number;
    isLoading: boolean;
    error: null;
    dismiss: (id: number) => void;
  }>(),
);

vi.mock('./use-toast', () => ({ toast: toastSpy }));
vi.mock('./useProactiveInsights', () => ({
  useProactiveInsights: useProactiveInsightsMock,
}));
vi.mock('wouter', () => ({ useLocation: () => ['/', vi.fn()] as const }));

function makeInsight(
  id: number,
  createdAt = new Date('2026-05-25T10:00:00Z').toISOString(),
): ProactiveInsight {
  return {
    id,
    insightType: 'news',
    title: `Insight ${id}`,
    body: `Body ${id}`,
    ctaLabel: null,
    ctaTarget: null,
    linkedWeakSignalId: null,
    readAt: null,
    dismissedAt: null,
    createdAt,
  };
}

function wrapperFactory() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return function Wrapper({ children }: { children: ReactNode }) {
    return createElement(QueryClientProvider, { client: queryClient }, children);
  };
}

describe('useWendyInsightToast', () => {
  beforeEach(() => {
    _resetWendyInsightToastForTest();
    toastSpy.mockReset();
    markReadSpy.mockReset();
    useProactiveInsightsMock.mockReset();
  });

  afterEach(() => {
    _resetWendyInsightToastForTest();
  });

  it('does not toast the insights already present at first render', () => {
    useProactiveInsightsMock.mockReturnValue({
      insights: [makeInsight(1), makeInsight(2)],
      markRead: markReadSpy,
      unreadCount: 2,
      isLoading: false,
      error: null,
      dismiss: vi.fn(),
    });
    renderHook(() => useWendyInsightToast(), { wrapper: wrapperFactory() });
    expect(toastSpy).not.toHaveBeenCalled();
  });

  it('toasts a newly arrived insight and marks it read', () => {
    const initial = [makeInsight(1)];
    useProactiveInsightsMock.mockReturnValue({
      insights: initial,
      markRead: markReadSpy,
      unreadCount: 1,
      isLoading: false,
      error: null,
      dismiss: vi.fn(),
    });
    vi.useFakeTimers();
    const { rerender } = renderHook(() => useWendyInsightToast(), {
      wrapper: wrapperFactory(),
    });

    useProactiveInsightsMock.mockReturnValue({
      insights: [...initial, makeInsight(2, new Date('2026-05-25T12:00:00Z').toISOString())],
      markRead: markReadSpy,
      unreadCount: 2,
      isLoading: false,
      error: null,
      dismiss: vi.fn(),
    });
    rerender();

    expect(toastSpy).toHaveBeenCalledTimes(1);
    expect(toastSpy.mock.calls[0]?.[0]).toMatchObject({ title: 'Insight 2' });

    // markRead viene chiamato in un setTimeout(_, 0)
    vi.runAllTimers();
    expect(markReadSpy).toHaveBeenCalledWith(2);
    vi.useRealTimers();
  });

  it('respects the rate limit between toasts', () => {
    useProactiveInsightsMock.mockReturnValue({
      insights: [makeInsight(1)],
      markRead: markReadSpy,
      unreadCount: 1,
      isLoading: false,
      error: null,
      dismiss: vi.fn(),
    });
    const { rerender } = renderHook(() => useWendyInsightToast({ intervalMs: 60_000 }), {
      wrapper: wrapperFactory(),
    });

    useProactiveInsightsMock.mockReturnValue({
      insights: [makeInsight(1), makeInsight(2)],
      markRead: markReadSpy,
      unreadCount: 2,
      isLoading: false,
      error: null,
      dismiss: vi.fn(),
    });
    rerender();
    expect(toastSpy).toHaveBeenCalledTimes(1);

    useProactiveInsightsMock.mockReturnValue({
      insights: [makeInsight(1), makeInsight(2), makeInsight(3)],
      markRead: markReadSpy,
      unreadCount: 3,
      isLoading: false,
      error: null,
      dismiss: vi.fn(),
    });
    rerender();
    // 3 è nuovo ma il rate limit (60s) blocca il secondo toast nello stesso istante
    expect(toastSpy).toHaveBeenCalledTimes(1);
  });

  it('does not toast read insights even when new', () => {
    useProactiveInsightsMock.mockReturnValue({
      insights: [],
      markRead: markReadSpy,
      unreadCount: 0,
      isLoading: false,
      error: null,
      dismiss: vi.fn(),
    });
    const { rerender } = renderHook(() => useWendyInsightToast(), {
      wrapper: wrapperFactory(),
    });
    const read = { ...makeInsight(7), readAt: new Date().toISOString() };
    useProactiveInsightsMock.mockReturnValue({
      insights: [read],
      markRead: markReadSpy,
      unreadCount: 0,
      isLoading: false,
      error: null,
      dismiss: vi.fn(),
    });
    rerender();
    expect(toastSpy).not.toHaveBeenCalled();
  });
});
