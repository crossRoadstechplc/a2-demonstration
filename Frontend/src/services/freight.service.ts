import { api } from "./api";
import type { Shipment } from "@/types/shipment";

export const freightService = {
  request: async (payload: {
    pickupLocation: string;
    deliveryLocation: string;
    cargoDescription: string;
    weight: number;
    volume: number;
    pickupWindow: string;
    requiresRefrigeration?: boolean;
    temperatureTarget?: number;
  }) => {
    const { data } = await api.post<{ shipment: Shipment }>("/freight/request", payload);
    return data.shipment;
  },
  list: async () => {
    const { data } = await api.get<{ shipments: Shipment[] }>("/freight");
    return data.shipments;
  },
  getById: async (id: number) => {
    const { data } = await api.get<{ shipment: Shipment }>(`/freight/${id}`);
    return data.shipment;
  },
  tracking: async (id: number) => {
    const { data } = await api.get(`/freight/${id}/tracking`);
    return data;
  },
  assign: async (id: number) => {
    const { data } = await api.post(`/freight/${id}/assign`, {});
    return data;
  },
  accept: async (id: number) => {
    const { data } = await api.post(`/freight/${id}/accept`, {});
    return data;
  },
  pickupConfirm: async (id: number) => {
    const { data } = await api.post(`/freight/${id}/pickup-confirm`, {});
    return data;
  },
  deliveryConfirm: async (id: number) => {
    const { data } = await api.post(`/freight/${id}/delivery-confirm`, {});
    return data;
  },
  approveLoad: async (id: number) => {
    const { data } = await api.post(`/freight/${id}/approve-load`, {});
    return data;
  },
  customerDeliveryConfirmation: async (id: number) => {
    const { data } = await api.post(`/freight/${id}/delivery-confirmation`, {});
    return data;
  },
};
