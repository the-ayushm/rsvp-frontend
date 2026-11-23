/* eslint-disable @typescript-eslint/no-explicit-any */

"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { soft7AxiosInstance } from "@/lib/axiosInstance";

export type WhiteLabelCompany = {
  id?: string;
  name?: string;
  domain?: string;
  domain_name?: string;
  logo?: string | null;
  favicon?: string | null;
  status?: string;
  [key: string]: any;
};

type CompanyContextType = {
  company: WhiteLabelCompany | null;
  companyName: string;
  companyLogo: string | null;
  companyFavicon: string | null;
  isLoading: boolean;
  refreshCompany: () => Promise<void>;
};

const DEFAULT_COMPANY_NAME = "Dashboard";
const COMPANY_DETAILS_ENDPOINT = "/auth/company-details";

const CompanyContext = createContext<CompanyContextType>({
  company: null,
  companyName: DEFAULT_COMPANY_NAME,
  companyLogo: null,
  companyFavicon: null,
  isLoading: true,
  refreshCompany: async () => { },
});

export function useCompany() {
  return useContext(CompanyContext);
}

function normalizeDomain(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .split("/")[0]
    .split(":")[0]
    .replace(/\.$/, "");
}

function extractCompany(responseData: any): WhiteLabelCompany | null {
  if (!responseData) return null;

  if (
    responseData.company &&
    typeof responseData.company === "object"
  ) {
    return responseData.company;
  }

  if (
    responseData.data?.company &&
    typeof responseData.data.company === "object"
  ) {
    return responseData.data.company;
  }

  if (
    responseData.data &&
    typeof responseData.data === "object" &&
    !Array.isArray(responseData.data)
  ) {
    return responseData.data;
  }

  if (
    typeof responseData === "object" &&
    !Array.isArray(responseData) &&
    (
      responseData.id ||
      responseData.name ||
      responseData.domain ||
      responseData.domain_name ||
      responseData.logo ||
      responseData.favicon
    )
  ) {
    return responseData;
  }

  return null;
}

function setFavicon(url: string | null) {
  if (typeof document === "undefined") return;
  const href = new URL(url || "/favicon.ico", document.baseURI).href;
  let icons = [...document.querySelectorAll<HTMLLinkElement>("link[rel~='icon']")];
  if (icons.length === 0) {
    const icon = document.createElement("link");
    icon.rel = "icon";
    document.head.appendChild(icon);
    icons = [icon];
  }
  for (const icon of icons) {
    if (icon.href !== href) icon.href = href;
    // The company logo may be PNG/SVG instead of the default ICO.
    for (const attribute of ["type", "sizes", "media"]) {
      if (icon.hasAttribute(attribute)) icon.removeAttribute(attribute);
    }
  }
}

function isDefaultOrLocalDomain(domain: string): boolean {
  const d = domain.toLowerCase();
  return (
    d === "localhost" ||
    d === "127.0.0.1" ||
    d === "::1" ||
    d.endsWith(".local") ||
    d.endsWith(".localhost") ||
    d === "soft7.in" ||
    d === "www.soft7.in" ||
    d === "app.soft7.in" ||
    d === "dashboard.soft7.in" ||
    d === "hostapi.soft7.in"
  );
}

export function CompanyProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [company, setCompany] =
    useState<WhiteLabelCompany | null>(null);

  const [isLoading, setIsLoading] = useState(true);

  const fetchCompanyDetails = async () => {
    if (typeof window === "undefined") return;

    /*
     * Production hostname.
     *
     * Example:
     * https://acer.soft7.in/auth
     * becomes:
     * acer.soft7.in
     */
    const domain = normalizeDomain(
      window.location.hostname
    );

    if (!domain || isDefaultOrLocalDomain(domain)) {
      let cachedCompany: WhiteLabelCompany | null = null;
      let companyId: string | null = null;
      try {
        companyId = localStorage.getItem("company_id");
        if (!companyId) {
          const savedUser = localStorage.getItem("user_data");
          if (savedUser) {
            const user = JSON.parse(savedUser);
            companyId = user?.company_id || user?.companyId || null;
          }
        }
        const saved = localStorage.getItem("soft7_company_details");
        if (saved) {
          const parsed = JSON.parse(saved);
          const comp = extractCompany(parsed);
          if (comp && (!parsed.domain || parsed.domain === domain) && (!companyId || comp.id === companyId)) {
            cachedCompany = comp;
            setCompany(comp);
          }
        }
      } catch {
        /* ignore fallback parsing error */
      }
      // Shared/local dashboards use the signed-in company's existing logo endpoint.
      if (companyId && localStorage.getItem("console_access_token")) {
        try {
          const response = await soft7AxiosInstance.get(`/admin/companies/${encodeURIComponent(companyId)}`);
          const comp = extractCompany(response.data);
          if (comp) {
            setCompany(comp);
            return;
          }
        } catch {
          // Keep cached branding if a temporary lookup fails.
        }
      }
      setCompany(cachedCompany);
      return;
    }

    try {
      console.log(
        "Fetching company details for domain:",
        domain
      );

      /*
       * IMPORTANT:
       * Same API calling pattern used throughout the app:
       *
       * soft7AxiosInstance.post("/auth/...", payload)
       *
       * domain_name is ONLY in the request body.
       * There is NO query parameter.
       */
      const response = await soft7AxiosInstance.post(
        COMPANY_DETAILS_ENDPOINT,
        {
          domain_name: domain,
        }
      );

      console.log(
        "Company details API response:",
        response.data
      );

      const companyData = extractCompany(
        response.data
      );

      if (!companyData) {
        console.warn(
          "No company returned for domain:",
          domain
        );
        setCompany(null);
        return;
      }

      setCompany(companyData);

      const companyName = String(
        companyData.name || ""
      ).trim();

      const logoUrl =
        companyData.logo || null;

      const faviconUrl =
        companyData.favicon ||
        companyData.logo ||
        null;

      console.log(
        "Company branding loaded:",
        {
          domain,
          companyName,
          logo: logoUrl,
          favicon: faviconUrl,
        }
      );
    } catch (error: any) {
      if (process.env.NODE_ENV === "development") {
        console.warn(
          "Company details API notice:",
          error?.message || error?.response?.statusText || "Domain lookup unavailable"
        );
      }
      setCompany(null);
    }
  };

  useEffect(() => {
    document.title = String(company?.name || "").trim() || DEFAULT_COMPANY_NAME;
    const iconUrl = company?.favicon || company?.logo || null;
    const applyIcon = () => setFavicon(iconUrl);
    applyIcon();
    // Next.js can restore its metadata icon on navigation; keep company branding.
    const observer = new MutationObserver(applyIcon);
    observer.observe(document.head, {
      childList: true, subtree: true, attributes: true,
      attributeFilter: ["href", "rel", "type", "sizes", "media"],
    });
    if (company) {
      try {
        localStorage.setItem("soft7_company_details", JSON.stringify({
          domain: normalizeDomain(window.location.hostname), company,
        }));
      } catch {
        // Branding still applies when browser storage is unavailable.
      }
    }
    return () => observer.disconnect();
  }, [company]);

  useEffect(() => {
    let active = true;

    const load = async () => {
      try {
        await fetchCompanyDetails();
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    };

    load();

    return () => {
      active = false;
    };
  }, []);

  const value = useMemo<CompanyContextType>(
    () => ({
      company,
      companyName:
        String(company?.name || "").trim() ||
        DEFAULT_COMPANY_NAME,
      companyLogo: company?.logo || null,
      companyFavicon:
        company?.favicon ||
        company?.logo ||
        null,
      isLoading,
      refreshCompany: fetchCompanyDetails,
    }),
    [company, isLoading]
  );

  return (
    <CompanyContext.Provider value={value}>
      {children}
    </CompanyContext.Provider>
  );
}

export default CompanyContext;
