export const pickupStatusColor: Readonly<Record<string, string>> = {
  pending: '#fcd34d',
  reserved: '#93c5fd',
  accepted: '#93c5fd',
  en_route: '#67e8f9',
  arrived: '#c4b5fd',
  completed: '#86efac',
  cancelled: '#fca5a5',
  rejected: '#fca5a5',
  expired: '#cbd5e1',
};

export const pickupStatusLightColor: Readonly<Record<string, string>> = {
  pending: '#805600', reserved: '#154f91', accepted: '#154f91', en_route: '#00647c',
  arrived: '#52369c', completed: '#126542', cancelled: '#9d1837', rejected: '#9d1837', expired: '#475569',
};

export function pickupStatusCss(status: string) {
  return status === 'overdue' ? 'var(--pickup-cancelled, #fca5a5)'
    : pickupStatusColor[status] && 'var(--pickup-' + status + ', ' + pickupStatusColor[status] + ')';
}
