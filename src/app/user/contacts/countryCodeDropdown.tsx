import { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check } from 'lucide-react';


// Add this component before your main ContactsPage component

interface CountryCode {
  code: string;
  dialCode: string;
  flag: string;
  name: string;
}

const countryCodes: CountryCode[] = [
  { code: 'IN', dialCode: '+91', flag: '🇮🇳', name: 'India' },
  { code: 'US', dialCode: '+1', flag: '🇺🇸', name: 'USA' },
  { code: 'GB', dialCode: '+44', flag: '🇬🇧', name: 'UK' },
  { code: 'AU', dialCode: '+61', flag: '🇦🇺', name: 'Australia' },
  { code: 'CA', dialCode: '+1', flag: '🇨🇦', name: 'Canada' },
  { code: 'AE', dialCode: '+971', flag: '🇦🇪', name: 'UAE' },
  { code: 'SG', dialCode: '+65', flag: '🇸🇬', name: 'Singapore' },
  { code: 'MY', dialCode: '+60', flag: '🇲🇾', name: 'Malaysia' },
  { code: 'LK', dialCode: '+94', flag: '🇱🇰', name: 'Sri Lanka' },
  { code: 'BD', dialCode: '+880', flag: '🇧🇩', name: 'Bangladesh' },
  { code: 'PK', dialCode: '+92', flag: '🇵🇰', name: 'Pakistan' },
  { code: 'NP', dialCode: '+977', flag: '🇳🇵', name: 'Nepal' },
  { code: 'ID', dialCode: '+62', flag: '🇮🇩', name: 'Indonesia' },
  { code: 'TH', dialCode: '+66', flag: '🇹🇭', name: 'Thailand' },
  { code: 'VN', dialCode: '+84', flag: '🇻🇳', name: 'Vietnam' },
  { code: 'PH', dialCode: '+63', flag: '🇵🇭', name: 'Philippines' },
];

export const CountryCodeDropdown = ({
  selectedCode,
  onSelect,
  disabled = false,
}: {
  selectedCode: string;
  onSelect: (dialCode: string) => void;
  disabled?: boolean;
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const selectedCountry = countryCodes.find(c => c.dialCode === selectedCode);
  
  const filteredCountries = countryCodes.filter(country =>
    country.name.toLowerCase().includes(search.toLowerCase()) ||
    country.dialCode.includes(search) ||
    country.code.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div ref={dropdownRef} className="relative">
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        className="flex items-center gap-1.5 px-2 py-2 bg-muted border border-border rounded-l-lg hover:bg-muted transition disabled:opacity-50"
        disabled={disabled}
      >
        {selectedCountry ? (
          <>
            <img 
              src={`https://flagcdn.com/w20/${selectedCountry.code.toLowerCase()}.png`} 
              alt={selectedCountry.name} 
              className="w-5 h-auto object-contain rounded-sm"
            />
            <span className="text-sm font-medium text-foreground">
              {selectedCountry.dialCode}
            </span>
          </>
        ) : (
          <span className="text-sm font-medium text-muted-foreground mx-1">
            Code
          </span>
        )}
        <ChevronDown size={14} className={`text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute z-50 mt-1 left-0 w-64 bg-card border border-border rounded-lg shadow-xl overflow-hidden">
          <div className="p-2 border-b border-border">
            <input
              type="text"
              placeholder="Search country..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-muted border border-border text-foreground text-xs px-2.5 py-1.5 rounded-md focus:outline-none focus:border-border focus:ring-1 focus:ring-ring"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
          <div className="max-h-64 overflow-y-auto">
            {filteredCountries.map((country) => (
              <button
                key={country.code}
                type="button"
                onClick={() => {
                  onSelect(country.dialCode);
                  setIsOpen(false);
                  setSearch('');
                }}
                className={`w-full flex items-center gap-2 px-3 py-2 hover:bg-muted transition text-left ${
                  selectedCode === country.dialCode ? 'bg-accent/10 font-medium' : ''
                }`}
              >
                <img 
                  src={`https://flagcdn.com/w40/${country.code.toLowerCase()}.png`} 
                  alt={country.name} 
                  className="w-6 h-auto object-contain rounded-sm"
                />
                <div className="flex-1">
                  <p className="text-xs font-medium text-foreground">{country.name}</p>
                  <p className="text-[10px] text-muted-foreground">{country.dialCode}</p>
                </div>
                {selectedCode === country.dialCode && (
                  <Check size={14} className="text-accent" />
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};