export function formatMoney(amount: string, currencyCode: string = 'GBP'): string {
  const value = parseFloat(amount);
  if (isNaN(value)) return '';
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: currencyCode,
  }).format(value);
}
