'use client';

import {useState} from 'react';
import {getCountries, getCountryCallingCode, type CountryCode} from 'libphonenumber-js/min';
import {formatNationalPhone, internationalPhone} from '@/lib/phone';

const names = new Intl.DisplayNames(['pt-BR'], {type:'region'});
const countries = getCountries().map(code => ({
  code,
  label:names.of(code) ?? code,
  dial:getCountryCallingCode(code),
  flag:String.fromCodePoint(...[...code].map(letter => letter.charCodeAt(0) + 127397)),
})).sort((a,b) => a.label.localeCompare(b.label,'pt-BR'));
const searchable = (value:string) => value.normalize('NFD').replace(/\p{Diacritic}/gu,'').toLowerCase();

export default function CountryPhoneInput({value,onChange}:{value:string;onChange:(raw:string,e164:string|null)=>void}) {
  const [country,setCountry] = useState<CountryCode>('BR');
  const [open,setOpen] = useState(false);
  const [query,setQuery] = useState('');
  const selected = countries.find(item => item.code === country)!;
  return <div className="country-phone" onKeyDown={event => {
    if (event.key === 'Escape' && open) {
      event.stopPropagation();
      setOpen(false);
      event.currentTarget.querySelector('button')?.focus();
    }
  }}>
    <button type="button" className="secondary country-toggle" aria-label={`País: ${selected.label}, +${selected.dial}`} aria-expanded={open} onClick={() => {setQuery('');setOpen(!open);}}>
      <span aria-hidden="true">{selected.flag}</span> +{selected.dial}
    </button>
    <input type="tel" inputMode="tel" autoComplete="tel-national" aria-label="Número do WhatsApp" placeholder={country === 'BR' ? '(11) 91234-5678' : 'Número de telefone'} required value={value} onChange={event => {
      const raw = event.target.value.trimStart();
      const next = raw.startsWith('+') ? raw.replace(/[^+\d\s().-]/g, '').slice(0, 25) : formatNationalPhone(raw,country);
      onChange(next,internationalPhone(next,country));
    }}/>
    {open && <div className="country-options">
      <input type="search" autoFocus aria-label="Pesquisar país" placeholder="Pesquisar país" value={query} onChange={event => setQuery(event.target.value)}/>
      <ul>{countries.filter(item => searchable(`${item.label} ${item.code} +${item.dial}`).includes(searchable(query.trim()))).map(item => <li key={item.code}>
        <button type="button" aria-pressed={country === item.code} onClick={event => {
          const root = event.currentTarget.closest('.country-phone');
          setCountry(item.code);
          setOpen(false);
          onChange('',null);
          root?.querySelector<HTMLInputElement>('input[type=tel]')?.focus();
        }}><span aria-hidden="true">{item.flag}</span> {item.label} <small>+{item.dial}</small></button>
      </li>)}</ul>
    </div>}
  </div>;
}
