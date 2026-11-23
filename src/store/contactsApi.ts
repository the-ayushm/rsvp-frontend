/* eslint-disable @typescript-eslint/no-explicit-any */
import { createApi } from "@reduxjs/toolkit/query/react";
import { soft7AxiosInstance } from "@/lib/axiosInstance";
import type { BaseQueryFn } from "@reduxjs/toolkit/query";
import type { AxiosError, AxiosRequestConfig } from "axios";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ContactRecord {
  id: string;
  phone_number: string;
  name: string;
  email: string | null;
  source?: string;
  assigned_to?: string[];
  tags?: string[];
  status?: string;
  wabaPhone?: string;
  interiorDesign?: string;
  name1?: string;
  test?: string;
  is_valid: boolean;
  invalid_reason: string | null;
  attributes: Record<string, any>;
  custom_fields?: Record<string, any>;
  created_at: string;
  updated_at: string;
  company_id: string;
  user_id: string | null;
  message_count: number;
  failed_count: number;
  last_contacted_at: string | null;
  last_invalid_at: string | null;
}

export interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  total_pages: number;
}

export interface ContactsPageResponse {
  contacts: ContactRecord[];
  pagination: PaginationMeta;
}

export interface ContactTag {
  id: number;
  name: string;
  group?: string;
  userId: number;
  createdAt: string;
}

export interface CreateContactPayload {
  phone_number: string;
  name: string;
  email?: string;
  attributes?: Record<string, any>;
  notes?: string;
  tag_ids?: string[];
}

export interface UpdateContactPayload {
  id: string;
  data: Partial<ContactRecord>;
}

// ─── Query args ───────────────────────────────────────────────────────────────

export interface GetContactsArgs {
  page: number;
  limit: number;
  search?: string;
}

// ─── Axios base-query ─────────────────────────────────────────────────────────

const axiosBaseQuery =
  (): BaseQueryFn<
    { url: string; method?: AxiosRequestConfig["method"]; params?: any; data?: any },
    unknown,
    { status?: number; message: string }
  > =>
  async ({ url, method = "GET", params, data }) => {
    try {
      const result = await soft7AxiosInstance({ url, method, params, data });
      return { data: result.data };
    } catch (err) {
      const error = err as AxiosError;
      return {
        error: {
          status: error.response?.status,
          message: error.message,
        },
      };
    }
  };

// ─── RTK Query API ────────────────────────────────────────────────────────────
//
// IMPORTANT — lazy-by-design:
//   • useGetContactsPageQuery  fires on page mount (contacts list)
//   • useGetContactTagsQuery   is called with `skip: !showFilters` so tags are
//     fetched ONLY when the filter modal is first opened
//   • useCreateContactMutation / useDeleteContactMutation / useUpdateContactMutation
//     are triggered only when the user submits the respective form/action
//
// This mirrors the inbox pattern: each endpoint runs only when its UI feature
// is actually activated, not blindly on page mount.

export const contactsApi = createApi({
  reducerPath: "contactsApi",
  baseQuery: axiosBaseQuery(),
  tagTypes: ["Contacts", "ContactTags"],

  endpoints: (builder) => ({

    // 1. Paginated contacts list — always needed on mount, refetched on page/search change
    getContactsPage: builder.query<ContactsPageResponse, GetContactsArgs>({
      query: ({ page, limit, search }) => ({
        url: "/admin/contacts",
        params: { page, limit, ...(search ? { search } : {}) },
      }),
      providesTags: ["Contacts"],
      transformResponse: (raw: any): ContactsPageResponse => {
        if (raw?.success && raw?.data) {
          return {
            contacts: raw.data.contacts ?? [],
            pagination: raw.data.pagination ?? {
              total: 0, page: 1, limit: 10, total_pages: 0,
            },
          };
        }
        return { contacts: [], pagination: { total: 0, page: 1, limit: 10, total_pages: 0 } };
      },
    }),

    // 2. Contact tags — lazy: skipped until the filter modal is opened
    getContactTags: builder.query<ContactTag[], void>({
      query: () => ({ url: "/admin/tags" }),
      providesTags: ["ContactTags"],
      transformResponse: (raw: any): ContactTag[] => {
        const list = Array.isArray(raw?.data)
          ? raw.data
          : Array.isArray(raw)
          ? raw
          : [];
        return list;
      },
    }),

    // 3. Create a contact — mutation fires only on form submit
    createContact: builder.mutation<any, CreateContactPayload>({
      query: (body) => ({
        url: "/admin/contacts",
        method: "POST",
        data: body,
      }),
      // Invalidate contacts list so the table refreshes automatically
      invalidatesTags: ["Contacts"],
    }),

    // 4. Update a contact — mutation fires only when user clicks Save in edit panel
    updateContact: builder.mutation<any, UpdateContactPayload>({
      query: ({ id, data }) => ({
        url: `/admin/contacts/${id}`,
        method: "PUT",
        data,
      }),
      invalidatesTags: ["Contacts"],
    }),

    // 5. Delete a contact — mutation fires only on delete button click
    deleteContact: builder.mutation<any, string>({
      query: (id) => ({
        url: `/admin/contacts/${id}`,
        method: "DELETE",
      }),
      invalidatesTags: ["Contacts"],
    }),
  }),
});

export const {
  useGetContactsPageQuery,
  useGetContactTagsQuery,
  useCreateContactMutation,
  useUpdateContactMutation,
  useDeleteContactMutation,
} = contactsApi;
