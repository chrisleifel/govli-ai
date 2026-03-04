export function formatDate(date: Date, format?: string): string {
  try {
    if (!date || isNaN(date.getTime())) {
      return 'Invalid Date';
    }
    return date.toISOString();
  } catch (error) {
    return 'Invalid Date';
  }
}
