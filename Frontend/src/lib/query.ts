"use client";

import {
  type MutationFunction,
  type QueryKey,
  useMutation,
  useQuery,
  type UseQueryOptions,
} from "@tanstack/react-query";

export async function queryFetcher<T>(request: Promise<{ data: T }>): Promise<T> {
  const response = await request;
  return response.data;
}

export function useAppQuery<TData, TError = Error>(
  options: Omit<UseQueryOptions<TData, TError>, "queryKey" | "queryFn"> & {
    queryKey: QueryKey;
    queryFn: () => Promise<TData>;
  }
) {
  return useQuery<TData, TError>({
    staleTime: 60_000,
    ...options,
  });
}

export function useAppMutation<TData, TVariables, TError = Error>(
  mutationFn: MutationFunction<TData, TVariables>
) {
  return useMutation<TData, TError, TVariables>({
    mutationFn,
  });
}
