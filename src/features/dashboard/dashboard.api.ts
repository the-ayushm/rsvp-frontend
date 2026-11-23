import { soft7AxiosInstance } from '@/lib/axiosInstance';
import type { DashboardStatsResponse, TimeFrame } from './types';

/** Preserve the endpoint and shared authentication/interceptor behavior. */
export async function getDashboardStats(timeFrame: TimeFrame) {
  const { data } = await soft7AxiosInstance.get<DashboardStatsResponse>(`/admin/users/stats?time_frame=${timeFrame}`);
  return data;
}
