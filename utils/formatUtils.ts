/**
 * Converts a number into its word representation (English).
 * Specifically formatted for Naira currency.
 */
export function amountToWords(amount: number): string {
  if (amount === 0) return 'Zero Naira Only';
  
  const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
  const teens = ['Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];

  function convert(num: number): string {
    if (num >= 1000000) {
      return convert(Math.floor(num / 1000000)) + ' Million ' + convert(num % 1000000);
    }
    if (num >= 1000) {
      return convert(Math.floor(num / 1000)) + ' Thousand ' + convert(num % 1000);
    }
    if (num >= 100) {
      return ones[Math.floor(num / 100)] + ' Hundred ' + convert(num % 100);
    }
    if (num >= 20) {
      return tens[Math.floor(num / 10)] + ' ' + ones[num % 10];
    }
    if (num >= 10) {
      return teens[num - 10];
    }
    return ones[num];
  }

  const result = convert(Math.floor(amount));
  return (result + ' Naira Only').replace(/\s+/g, ' ').trim();
}
