import '@testing-library/jest-dom';
import React from 'react';
import { render, screen } from '@testing-library/react';
import { Empty, ErrorState } from './shared';
import { MetricCards } from './overview';
test('empty state gives a truthful next step', () => {
  render(<Empty title="No leads yet" description="Create a form to capture your first lead." />);
  expect(screen.getByText('No leads yet')).toBeInTheDocument();
  expect(screen.getByText('Create a form to capture your first lead.')).toBeInTheDocument();
});
test('overview does not fabricate revenue or delivery', () => {
  render(<MetricCards />);
  expect(screen.getByText('No paid orders in this period')).toBeInTheDocument();
  expect(screen.getByText('Accepted by Instagram; delivery unconfirmed')).toBeInTheDocument();
  expect(screen.getAllByText('0')).toHaveLength(3);
});
test('errors are accessible and actionable', () => {
  render(<ErrorState error={new Error('API unavailable')} retry={() => {}} />);
  expect(screen.getByRole('alert')).toHaveTextContent('API unavailable');
  expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
});
