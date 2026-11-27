import { AsYouType, parsePhoneNumberFromString, type CountryCode } from 'libphonenumber-js/min';

export function internationalPhone(raw: unknown, country: CountryCode = 'BR') {
  if (typeof raw !== 'string' || raw.length > 40 || !/^\+?[\d\s().-]+$/.test(raw.trim())) return null;
  const phone = parsePhoneNumberFromString(raw, {defaultCountry: country, extract: false});
  return phone?.isValid() ? phone.number : null;
}

export function formatNationalPhone(raw: string, country: CountryCode) {
  const digits = raw.replace(/\D/g, '').slice(0, 15);
  return new AsYouType(country).input(digits);
}
