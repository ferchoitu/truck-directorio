const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export interface CarrierSummary {
  usdot_number: string;
  mc_number: string | null;
  legal_name: string | null;
  dba_name: string | null;
  city: string | null;
  state: string | null;
  operation_type: string | null;
  total_vehicles: number | null;
  total_drivers: number | null;
  safety_rating: string | null;
  slug: string | null;
}

export interface CarrierDetail extends CarrierSummary {
  address: string | null;
  zip: string | null;
  phone: string | null;
  email: string | null;
  carrier_classification: string | null;
  authority_status: string | null;
  duns_number: string | null;
  is_active: boolean;
  last_scraped_at: string | null;
}

export interface CarrierListResponse {
  items: CarrierSummary[];
  total: number;
  page: number;
  per_page: number;
  pages: number;
}

export interface SafetyScore {
  basic_category: string | null;
  score: string | null;
  percentile: number | null;
  alert_status: string | null;
  measured_date: string | null;
}

export interface Inspection {
  inspection_date: string | null;
  inspection_type: string | null;
  vehicles_inspected: number | null;
  drivers_inspected: number | null;
  violations_found: number | null;
  oos_vehicles: number | null;
  oos_drivers: number | null;
  state: string | null;
}

export interface Violation {
  violation_code: string | null;
  violation_description: string | null;
  violation_date: string | null;
  oos_indicator: boolean | null;
  severity_weight: number | null;
}

export interface CarrierSafety {
  usdot_number: string;
  safety_rating: string | null;
  safety_scores: SafetyScore[];
  inspections: Inspection[];
  violations: Violation[];
}

async function fetchJson<T>(path: string, revalidate = 3600): Promise<T | null> {
  try {
    const res = await fetch(`${API_URL}${path}`, { next: { revalidate } });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export function searchCarriers(
  params: Record<string, string>
): Promise<CarrierListResponse | null> {
  const query = new URLSearchParams(params).toString();
  const path = params.q ? "/api/carriers/search" : "/api/carriers";
  return fetchJson<CarrierListResponse>(`${path}?${query}`, 300);
}

export function getCarrierBySlug(slug: string): Promise<CarrierDetail | null> {
  return fetchJson<CarrierDetail>(`/api/carriers/by-slug/${encodeURIComponent(slug)}`, 86400);
}

export function getCarrierSafety(usdot: string): Promise<CarrierSafety | null> {
  return fetchJson<CarrierSafety>(`/api/carriers/${encodeURIComponent(usdot)}/safety`, 86400);
}

export function getTopCarriers(limit: number): Promise<CarrierSummary[] | null> {
  return fetchJson<CarrierSummary[]>(`/api/carriers/top?limit=${limit}`, 86400);
}
