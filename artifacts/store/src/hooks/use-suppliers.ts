import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

export interface Supplier {
  id: number;
  companyName: string;
  contactPerson: string | null;
  taxId: string | null;
  phone1: string | null;
  phone2: string | null;
  address: string | null;
  city: string | null;
  email: string | null;
  website: string | null;
  notes: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SupplierProduct {
  id: number;
  nameHe: string;
  sku: string | null;
  price: number;
  stockQuantity: number;
  isActive: boolean;
  images: string[];
}

function authFetch(path: string, options?: RequestInit) {
  const token = localStorage.getItem("token");
  return fetch(path, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options?.headers ?? {}),
    },
  }).then(async r => {
    if (!r.ok) {
      const err = await r.json().catch(() => ({}));
      throw new Error(err.error || `HTTP ${r.status}`);
    }
    return r.json();
  });
}

export const SUPPLIERS_KEY = ["suppliers"];
export const supplierKey = (id: number) => ["supplier", id];
export const supplierProductsKey = (id: number) => ["supplier-products", id];

export function useSuppliers() {
  return useQuery<Supplier[]>({
    queryKey: SUPPLIERS_KEY,
    queryFn: () => authFetch("/api/suppliers"),
  });
}

export function useSupplier(id: number) {
  return useQuery<Supplier>({
    queryKey: supplierKey(id),
    queryFn: () => authFetch(`/api/suppliers/${id}`),
    enabled: !!id,
  });
}

export function useSupplierProducts(id: number) {
  return useQuery<SupplierProduct[]>({
    queryKey: supplierProductsKey(id),
    queryFn: () => authFetch(`/api/suppliers/${id}/products`),
    enabled: !!id,
  });
}

export function useCreateSupplier() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<Supplier>) =>
      authFetch("/api/suppliers", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: SUPPLIERS_KEY }),
  });
}

export function useUpdateSupplier() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<Supplier> }) =>
      authFetch(`/api/suppliers/${id}`, { method: "PUT", body: JSON.stringify(data) }),
    onSuccess: (_r, v) => {
      qc.invalidateQueries({ queryKey: SUPPLIERS_KEY });
      qc.invalidateQueries({ queryKey: supplierKey(v.id) });
    },
  });
}

export function useToggleSupplierStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, isActive }: { id: number; isActive: boolean }) =>
      authFetch(`/api/suppliers/${id}/status`, { method: "PATCH", body: JSON.stringify({ isActive }) }),
    onSuccess: (_r, v) => {
      qc.invalidateQueries({ queryKey: SUPPLIERS_KEY });
      qc.invalidateQueries({ queryKey: supplierKey(v.id) });
    },
  });
}

export function useDeleteSupplier() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) =>
      authFetch(`/api/suppliers/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: SUPPLIERS_KEY }),
  });
}
