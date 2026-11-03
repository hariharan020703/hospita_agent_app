import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '@/test/utils';
import { Button } from './Button';
import { DataTable, type Column } from './DataTable';
import { Field } from './Field';
import { Input } from './Input';
import { Modal } from './Modal';
import { TimeSlotPicker } from './TimeSlotPicker';

interface Row {
  id: string;
  name: string;
  fee: number;
}
const rows: Row[] = Array.from({ length: 12 }, (_, i) => ({
  id: `r${i}`,
  name: `Doctor ${String.fromCharCode(76 - i)}`,
  fee: 100 + i * 10,
}));
const columns: Column<Row>[] = [
  { id: 'name', header: 'Name', cell: (r) => r.name, sortValue: (r) => r.name },
  { id: 'fee', header: 'Fee', cell: (r) => r.fee, sortValue: (r) => r.fee, align: 'right' },
];

describe('DataTable', () => {
  it('paginates and sorts with aria-sort', async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <DataTable caption="Doctors" columns={columns} rows={rows} getRowId={(r) => r.id} pageSize={5} />,
    );
    expect(screen.getAllByRole('row')).toHaveLength(6);
    expect(screen.getByText('1–5 of 12')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Sort by Name' }));
    expect(screen.getByRole('columnheader', { name: /Name/ })).toHaveAttribute('aria-sort', 'ascending');
    expect(within(screen.getAllByRole('row')[1]!).getByText('Doctor A')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Next page' }));
    expect(screen.getByText('6–10 of 12')).toBeInTheDocument();
  });

  it('shows the empty state', () => {
    renderWithProviders(<DataTable caption="Doctors" columns={columns} rows={[]} getRowId={(r) => r.id} />);
    expect(screen.getByText('No results match your search or filters')).toBeInTheDocument();
  });
});

describe('Field', () => {
  it('links the label, hint and translated error to the control', () => {
    renderWithProviders(
      <Field label="Mobile number" hint="We'll send a code" error="phone" required>
        {(control) => <Input {...control} />}
      </Field>,
    );
    const input = screen.getByRole('textbox', { name: /Mobile number/ });
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveAccessibleDescription("We'll send a code Enter a 10-digit mobile number");
  });
});

describe('Modal', () => {
  function Harness({ onClose }: { onClose: () => void }) {
    const [open, setOpen] = useState(true);
    return (
      <Modal
        open={open}
        onClose={() => {
          setOpen(false);
          onClose();
        }}
        title="Cancel appointment"
        footer={<Button>Confirm</Button>}
      >
        <p>Body</p>
      </Modal>
    );
  }

  it('is a labelled dialog that closes on Escape', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    renderWithProviders(<Harness onClose={onClose} />);
    expect(screen.getByRole('dialog', { name: 'Cancel appointment' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Close' })).toHaveFocus();
    await user.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalled();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});

describe('TimeSlotPicker', () => {
  it('disables booked slots and selects free ones', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderWithProviders(
      <TimeSlotPicker
        value={null}
        onChange={onChange}
        slots={[
          { start: '09:00', end: '09:15', status: 'booked' },
          { start: '09:15', end: '09:30', status: 'available' },
          { start: '16:00', end: '16:15', status: 'available' },
        ]}
      />,
    );
    expect(screen.getByRole('radiogroup', { name: 'Morning' })).toBeInTheDocument();
    expect(screen.getByRole('radiogroup', { name: 'Evening' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /9:00.*Booked/i })).toBeDisabled();
    await user.click(screen.getByRole('radio', { name: /9:15.*Available/i }));
    expect(onChange).toHaveBeenCalledWith('09:15');
  });
});
