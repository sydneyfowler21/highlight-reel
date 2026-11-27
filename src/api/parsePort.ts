export function parsePort(port: string | undefined): number {
  if (port === undefined || port === '') return 3000;
  if (!/^[0-9]+$/.test(port)) {
    throw new RangeError(
      `Expected PORT to be a whole number from 1 to 65535, got ${port}`,
    );
  }
  const value = Number(port);
  if (value < 1 || value > 65535) {
    throw new RangeError(
      `Expected PORT to be a whole number from 1 to 65535, got ${port}`,
    );
  }
  return value;
}
