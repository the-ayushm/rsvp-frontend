// The existing TIMESTAMP columns hold UTC values without an offset.
export const parseUtcTimestamp = (value: string): Date =>
  new Date(value.replace(' ', 'T') + 'Z');
