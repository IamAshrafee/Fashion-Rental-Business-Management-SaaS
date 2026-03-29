import { useQuery } from '@tanstack/react-query';
import { productApi } from '@/lib/api/products';

export function useCategories() {
  return useQuery({
    queryKey: ['owner-categories'],
    queryFn: () => productApi.getOwnerCategories(),
    staleTime: 5 * 60 * 1000,
  });
}

export function useEvents() {
  return useQuery({
    queryKey: ['owner-events'],
    queryFn: () => productApi.getOwnerEvents(),
    staleTime: 5 * 60 * 1000,
  });
}

export function useColors() {
  return useQuery({
    queryKey: ['colors'],
    queryFn: () => productApi.getColors(),
    staleTime: 5 * 60 * 1000, // standard lookup data
  });
}
