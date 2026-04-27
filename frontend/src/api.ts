import type { AnalysisResponse, ProductRecord } from "./types";

const API_URL = (import.meta.env.VITE_API_URL ?? "http://localhost:4000").replace(/\/$/, "");

async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...init?.headers
    },
    ...init
  });
  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(payload.error?.message ?? "TrueCost could not complete the request.");
  }

  return payload as T;
}

export function analyzeProduct(url: string) {
  return apiRequest<AnalysisResponse>("/api/analyze", {
    method: "POST",
    body: JSON.stringify({ url })
  });
}

export function getRecentProducts() {
  return apiRequest<{ products: ProductRecord[] }>("/api/recent");
}

export function getProduct(productId: string) {
  return apiRequest<AnalysisResponse>(`/api/products/${productId}`);
}

export function createAlert(productId: string, email: string, targetPrice: number) {
  return apiRequest<{ alert: unknown }>("/api/alert", {
    method: "POST",
    body: JSON.stringify({ productId, email, targetPrice })
  });
}
