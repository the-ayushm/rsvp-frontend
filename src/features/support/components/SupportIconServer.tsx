// components/CustomerSupport/SupportIconWrapper.tsx
"use client";

import SupportIcon from "./Support-Icon";
import { useQuery } from "@tanstack/react-query";
import { soft7AxiosInstance } from "@/lib/axiosInstance";

export default function SupportIconWrapper() {

  // const {data, isLoading} = useQuery({
  //   queryKey: ["user-role"],
  //   queryFn: async ()=>{
  //     const response = await soft7AxiosInstance.get("/admin/users");

      
  //     return {
  //       role: response.data.data.role,
  //       success: true
  //     };
  //   },
  //   retry: false,
  //   staleTime: 5 * 60 * 1000,
  //   refetchOnMount: "always",
  // })

      
      

  return <SupportIcon />;
  return null;
}