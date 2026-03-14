import { api } from "./api";

export interface TariffConfig {
  eeuRatePerKwh: number;
  a2ServiceRatePerKwh: number;
  vatPercent: number;
}

export const configService = {
  tariffs: async () => {
    const { data } = await api.get<TariffConfig>("/config/tariffs");
    return data;
  },
};
