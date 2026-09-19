import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ChatInput } from '@/components/chat/ChatInput';
import type { QuotaState } from '@/types/chat';

function renderInput(quota?: QuotaState | null) {
  return render(
    <ChatInput
      onSend={vi.fn()}
      isLoading={false}
      isConnected
      messages={[]}
      isStreamingEnabled
      onStopStreaming={vi.fn()}
      quota={quota}
    />
  );
}

describe('ChatInput quota indicator', () => {
  it('shows remaining messages and a progress bar when quota is known', () => {
    renderInput({ remaining: 13, limit: 20 });
    expect(screen.getByText('13/20 left')).toBeInTheDocument();
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  it('highlights an exhausted quota', () => {
    renderInput({ remaining: 0, limit: 20 });
    expect(screen.getByText('0/20 left')).toBeInTheDocument();
  });

  it('hides the quota indicator when no quota is known', () => {
    renderInput(null);
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    expect(screen.queryByText(/left/)).not.toBeInTheDocument();
  });
});
