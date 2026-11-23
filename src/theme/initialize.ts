import { ACCENTS, ACCENT_STORAGE_KEY, DEFAULT_ACCENT, THEME_STORAGE_KEY } from './config';

/** Runs before hydration to preserve appearance and company-title restoration. */
export const appearanceInitializationScript = `
(function() {
  try {
    const accents = ${JSON.stringify(Object.keys(ACCENTS))};
    const savedAccent = localStorage.getItem(${JSON.stringify(ACCENT_STORAGE_KEY)});
    document.documentElement.dataset.accent = accents.includes(savedAccent) ? savedAccent : ${JSON.stringify(DEFAULT_ACCENT)};
    const savedTheme = localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)});
    const mode = ['light', 'dark', 'system'].includes(savedTheme) ? savedTheme : 'system';
    const system = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    const resolved = mode === 'system' ? system : mode;
    document.documentElement.classList.toggle('dark', resolved === 'dark');
    document.documentElement.style.colorScheme = resolved;
    const savedCompany = localStorage.getItem('soft7_company_details');
    if (savedCompany) {
      const parsed = JSON.parse(savedCompany);
      if (parsed?.company?.name) document.title = parsed.company.name;
    }
  } catch (error) {
    console.error('Initialization error:', error);
  }
})();
`;
