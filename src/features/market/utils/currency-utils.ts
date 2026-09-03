/**
 * @file currency-utils.ts
 * @description Automatic currency detection and locale-aware number formatting for KLAROS.
 */

export type SupportedCurrency = 'GBP' | 'INR' | 'USD' | 'EUR';

export interface CurrencyConfig {
  currency: SupportedCurrency;
  symbol: string;
  locale: string;
}

const CURRENCY_CONFIGS: Record<SupportedCurrency, CurrencyConfig> = {
  GBP: { currency: 'GBP', symbol: '£', locale: 'en-GB' },
  INR: { currency: 'INR', symbol: '₹', locale: 'en-IN' },
  USD: { currency: 'USD', symbol: '$', locale: 'en-US' },
  EUR: { currency: 'EUR', symbol: '€', locale: 'en-IE' },
};

/**
 * Automatically inspects dataset locations, headers, and values to determine the business currency.
 * Avoids mislabeling UK datasets (Online Retail II) as INR.
 */
export function detectCurrencyFromSales(sales: Array<{ store_city?: string; payment_method?: string }>): CurrencyConfig {
  let ukCount = 0;
  let inCount = 0;
  let usCount = 0;
  let euCount = 0;

  const sampleSize = Math.min(sales.length, 500);
  for (let i = 0; i < sampleSize; i++) {
    const s = sales[i];
    const loc = String(s.store_city || '').toLowerCase();
    const pmt = String(s.payment_method || '').toLowerCase();

    if (
      loc.includes('united kingdom') ||
      loc.includes('uk') ||
      loc.includes('london') ||
      loc.includes('england') ||
      loc.includes('scotland') ||
      loc.includes('wales') ||
      loc.includes('birmingham') ||
      pmt.includes('gbp') ||
      pmt.includes('£')
    ) {
      ukCount++;
    } else if (
      loc.includes('india') ||
      loc.includes('mumbai') ||
      loc.includes('delhi') ||
      loc.includes('bangalore') ||
      loc.includes('bengaluru') ||
      loc.includes('hyderabad') ||
      loc.includes('chennai') ||
      loc.includes('pune') ||
      loc.includes('kolkata') ||
      pmt.includes('inr') ||
      pmt.includes('₹') ||
      pmt.includes('upi')
    ) {
      inCount++;
    } else if (
      loc.includes('usa') ||
      loc.includes('united states') ||
      loc.includes('new york') ||
      loc.includes('california') ||
      loc.includes('texas') ||
      pmt.includes('usd') ||
      pmt.includes('$')
    ) {
      usCount++;
    } else if (
      loc.includes('germany') ||
      loc.includes('france') ||
      loc.includes('spain') ||
      loc.includes('italy') ||
      loc.includes('netherlands') ||
      loc.includes('eire') ||
      pmt.includes('eur') ||
      pmt.includes('€')
    ) {
      euCount++;
    }
  }

  if (ukCount > inCount && ukCount >= usCount && ukCount >= euCount) {
    return CURRENCY_CONFIGS.GBP;
  }
  if (usCount > inCount && usCount >= ukCount && usCount >= euCount) {
    return CURRENCY_CONFIGS.USD;
  }
  if (euCount > inCount && euCount >= ukCount && euCount >= usCount) {
    return CURRENCY_CONFIGS.EUR;
  }
  return CURRENCY_CONFIGS.INR;
}

/**
 * Returns a configured Intl.NumberFormat instance for the given currency code.
 */
export function getCurrencyFormatter(currency: string = 'INR'): Intl.NumberFormat {
  const norm = (currency || '').toUpperCase() as SupportedCurrency;
  const config = CURRENCY_CONFIGS[norm] || CURRENCY_CONFIGS.INR;
  return new Intl.NumberFormat(config.locale, {
    style: 'currency',
    currency: config.currency,
    maximumFractionDigits: 0,
  });
}

/**
 * Returns currency guidelines for LLM prompting and report generation.
 */
export function getCurrencyPromptGuideline(metrics?: { kpis?: { currency?: string; currencySymbol?: string } }): {
  currency: string;
  symbol: string;
  guideline: string;
} {
  const currency = metrics?.kpis?.currency || 'INR';
  const symbol = metrics?.kpis?.currencySymbol || (currency === 'GBP' ? '£' : currency === 'USD' ? '$' : currency === 'EUR' ? '€' : '₹');
  const guideline = `Always format all monetary values using the ${symbol} symbol (${currency}). Do not use any other currency symbol.`;
  return { currency, symbol, guideline };
}
