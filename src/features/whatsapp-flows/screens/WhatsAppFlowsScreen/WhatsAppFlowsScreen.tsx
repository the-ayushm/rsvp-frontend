/* eslint-disable @typescript-eslint/no-unused-vars */
"use client";

import { useEffect, useState } from "react";
import { Eye, Edit, Trash } from "lucide-react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import "../../whatsapp-flows.css";
import { soft7AxiosInstance } from "@/lib/axiosInstance";


interface Flow {
  id: number;
  businessId: string;
  name: string;
  flowId: string;
  metaFlowId?: string | null;
  categories: string;
  status: string;
  validation: string;
}

interface WhatsAppAccount {
  id: number;
  name: string | null;
  phoneNumber: string | null;
  wabaId: string | null;
}

export default function WhatsappFlowsPage() {
  const router = useRouter();
  const [selectedBusiness, setSelectedBusiness] = useState<string>("");
  const [flows, setFlows] = useState<Flow[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedWhatsappIds, setSelectedWhatsappIds] = useState<string[]>([]);
  const [accounts, setAccounts] = useState<WhatsAppAccount[]>([]);
  const [accountsLoading, setAccountsLoading] = useState(true);
  const [newFlowName, setNewFlowName] = useState("");

  const fetchFlows = async () => {
    setLoading(true);
    try {
      const res = await soft7AxiosInstance.get("/api/user/whatsapp-flows/list");
      const data = await res.data;
      setFlows(data);
    } catch (error) {
      console.error("Failed to fetch flows:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchAccounts = async () => {
    setAccountsLoading(true);
    try {
      const res = await soft7AxiosInstance.get("/admin/waba/phone-numbers");
      const data = res.data;

      // Extract the array from various possible response shapes (same logic as inbox)
      const rawList = Array.isArray(data)
        ? data
        : Array.isArray(data?.data?.data)
          ? data.data.data
          : Array.isArray(data?.data?.phone_numbers)
            ? data.data.phone_numbers
            : Array.isArray(data?.data?.phoneNumbers)
              ? data.data.phoneNumbers
              : Array.isArray(data?.data)
                ? data.data
                : Array.isArray(data?.phone_numbers)
                  ? data.phone_numbers
                  : Array.isArray(data?.results)
                    ? data.results
                    : [];

      // Map to the WhatsAppAccount shape expected by this component
      const mapped: WhatsAppAccount[] = rawList.map((pn: any, idx: number) => ({
        id: pn.id || idx,
        name: pn.verified_name || pn.display_phone_number || pn.phone_number || null,
        phoneNumber: pn.display_phone_number || pn.phone_number || pn.number || null,
        wabaId: String(pn.waba_id || pn.wabaId || pn.id || ""),
      }));

      setAccounts(mapped);
      if (!selectedBusiness && mapped.length > 0) {
        // Default to first account's WABA ID
        setSelectedBusiness(mapped[0].wabaId || "");
      }
    } catch (error) {
      console.error("Failed to fetch WhatsApp accounts:", error);
    } finally {
      setAccountsLoading(false);
    }
  };

  useEffect(() => {
    fetchFlows();
    fetchAccounts();
  }, []);

  const handleDelete = async (id: number) => {
    if (!confirm("Are you sure you want to delete this flow?")) return;
    try {
      await soft7AxiosInstance.delete(`/api/user/whatsapp-flows/delete/${id}`);
      setFlows(flows.filter((flow) => flow.id !== id));
    } catch (error) {
      console.error("Failed to delete flow:", error);
    }
  };

  const handlePublish = async (id: number) => {
    try {
      await soft7AxiosInstance.post(`/api/user/whatsapp-flows/${id}/publish`);
      setFlows(flows.map((f) => (f.id === id ? { ...f, status: "PUBLISHED" } : f)));
    } catch (error) {
      console.error("Failed to publish flow:", error);
    }
  };

  const handleCreateForm = async () => {
    // Navigate to create page; actual creation happens there with Flow JSON
    window.location.href = "/user/manage/whatsapp-flows/create?businessId=" + encodeURIComponent(selectedBusiness);
  };

  const handleCreateFlowBuilder = () => {
    const name = newFlowName.trim();
    if (!name) {
      toast.error("Enter a flow name");
      return;
    }
    if (!selectedBusiness) {
      toast.error("Select a WhatsApp account first");
      return;
    }
    const exists = flows.some(
      (f) => f.businessId === selectedBusiness && f.name.toLowerCase() === name.toLowerCase(),
    );
    if (exists) {
      toast.error("Flow name must be unique for this WhatsApp account");
      return;
    }
    router.push(
      `/user/manage/whatsapp-flows/builder?businessId=${encodeURIComponent(
        selectedBusiness,
      )}&name=${encodeURIComponent(name)}`,
    );
  };

  return (
    <div className="whatsapp-page">
      <div className="whatsapp-card">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-8 gap-4">
          <div>
            <h1 className="whatsapp-title">WhatsApp Forms</h1>
            <p className="whatsapp-subtitle">
              Select a WhatsApp Business Account to manage its forms
            </p> 
          </div>

          <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center">
            <select
              value={selectedBusiness}
              onChange={(e) => setSelectedBusiness(e.target.value)}
              className="whatsapp-select"
              disabled={accountsLoading || accounts.length === 0}
            >
              {accountsLoading && <option>Loading accounts…</option>}
              {!accountsLoading && accounts.length === 0 && (
                <option value="">No WhatsApp accounts found</option>
              )}
              {!accountsLoading &&
                accounts.map((acc) => (
                  <option key={acc.id} value={acc.wabaId || ""}>
                    {acc.phoneNumber || acc.wabaId || `Account ${acc.id}`}
                  </option>
                ))}
            </select>

            <input
              type="text"
              value={newFlowName}
              onChange={(e) => setNewFlowName(e.target.value)}
              placeholder="Enter unique flow name"
              className="whatsapp-select md:w-56"
            />

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleCreateFlowBuilder}
                className="create-form-btn"
              >
                New Flow in Builder
              </button>
            </div>
          </div>


        </div>
   <div className="hidden md:block overflow-x-auto">
  <table className="whatsapp-table text-sm">
    <thead className="flows-header">
      <tr className="flows-header-row">
        <th className="px-4 py-3 text-center">
      <input
        type="checkbox"
        checked={
          flows.length > 0 &&
          selectedWhatsappIds.length === flows.length
        }
        onChange={(e) => {
          if (e.target.checked) {
            setSelectedWhatsappIds(flows.map((flow) => flow.id.toString()));
          } else {
            setSelectedWhatsappIds([]);
          }
        }}
        className="h-4 w-4 text-primary-text border-border-strong rounded focus:ring-primary"
      />
    </th>
        <th className="px-6 py-3 text-left">Name</th>
        <th className="px-6 py-3 text-left">Flow ID</th>
        <th className="px-6 py-3 text-left">Categories</th>
        <th className="px-6 py-3 text-left">Status</th>
        <th className="px-6 py-3 text-left">Validation</th>
        <th className="px-6 py-3 text-center">Actions</th>
      </tr>
    </thead>
    <tbody className="divide-y divide-border">
      {loading ? (
        <tr>
          <td colSpan={7} className="text-center py-8">
            Loading...
          </td>
        </tr>
      ) : flows.length === 0 ? (
        <tr>
          <td colSpan={6} className="whatsapp-empty">
            No results.
          </td>
        </tr>
      ) : (
        flows.map((flow) => (
          <tr
  key={flow.id}
  className="hover:bg-primary-lighter transition whatsapp-row"
>
  <td className="px-4 py-4 text-center">
    <input
      type="checkbox"
      checked={selectedWhatsappIds.includes(flow.id.toString())}
      onChange={(e) => {
        if (e.target.checked) {
          setSelectedWhatsappIds([
            ...selectedWhatsappIds,
            flow.id.toString(),
          ]);
        } else {
          setSelectedWhatsappIds(
            selectedWhatsappIds.filter(
              (id) => id !== flow.id.toString()
            )
          );
        }
      }}
      className="h-4 w-4 text-primary-text border-border-strong rounded focus:ring-primary"
    />
  </td>
            <td className="px-6 py-4">{flow.name}</td>
            <td className="px-6 py-4">{flow.flowId}</td>
            <td className="px-6 py-4">{flow.categories}</td>
            <td className="px-6 py-4">{flow.status}</td>
            <td className="px-6 py-4">
              {(() => {
                try {
                  const validationObj = JSON.parse(flow.validation);
                  return `${validationObj.screenTitle || ""} | ${
                    validationObj.largeHeading || ""
                  } | ${validationObj.fields?.length || 0} fields`;
                } catch (e) {
                  return flow.validation; // fallback in case it's not valid JSON
                }
              })()}
            </td>
            <td className="px-6 py-4 text-center">
  <div className="inline-flex items-center gap-2 flex-wrap">
    {flow.status === "DRAFT" && flow.metaFlowId && (
      <button
        onClick={() => handlePublish(flow.id)}
        className="whatsapp-action-edit inline-flex items-center gap-1 px-3 py-1.5 rounded-md text-sm shadow transition"
      >
        Publish
      </button>
    )}
    <button className="whatsapp-action-view inline-flex items-center gap-1 px-3 py-1.5 rounded-md text-sm shadow transition">
      <Eye className="w-4 h-4" />
      View
    </button>
    <button
      onClick={() =>
        router.push(
          `/user/manage/whatsapp-flows/builder?flowId=${flow.id}` +
          `&businessId=${encodeURIComponent(flow.businessId)}` +
          `&name=${encodeURIComponent(flow.name)}`
        )
      }
      className="whatsapp-action-edit inline-flex items-center gap-1 px-3 py-1.5 rounded-md text-sm shadow transition"
    >
      <Edit className="w-4 h-4" />
      Edit
    </button>
    <button
      onClick={() => handleDelete(flow.id)}
      className="whatsapp-action-delete inline-flex items-center gap-1 px-3 py-1.5 rounded-md text-sm shadow transition"
    >
      <Trash className="w-4 h-4" />
      Delete
    </button>
  </div>
</td>

          </tr>
        ))
      )}
    </tbody>
  </table>
</div>
{/* Mobile View */}
<div className="block md:hidden space-y-4">
  {loading ? (
    <div className="text-center py-6">Loading...</div>
  ) : flows.length === 0 ? (
    <div className="text-center py-6 text-muted-foreground">No results.</div>
  ) : (
    flows.map((flow) => (
      <div
        key={flow.id}
        className="bg-surface dark:bg-surface-raised rounded-xl shadow border border-border dark:border-border p-4 space-y-3"
      >
        {/* Header */}
        <div className="flex justify-between items-start">
          <div>
            <h3 className="font-semibold text-foreground dark:text-white">
              {flow.name}
            </h3>
            <p className="text-xs text-muted-foreground">
              Flow ID: {flow.flowId}
            </p>
          </div>

          <input
            type="checkbox"
            checked={selectedWhatsappIds.includes(flow.id.toString())}
            onChange={(e) => {
              if (e.target.checked) {
                setSelectedWhatsappIds([
                  ...selectedWhatsappIds,
                  flow.id.toString(),
                ]);
              } else {
                setSelectedWhatsappIds(
                  selectedWhatsappIds.filter(
                    (id) => id !== flow.id.toString()
                  )
                );
              }
            }}
            className="h-4 w-4 text-primary-text border-border-strong rounded"
          />
        </div>

        {/* Info */}
        <div className="text-sm text-secondary-foreground dark:text-secondary-foreground space-y-1">
          <p><span className="font-medium">Category:</span> {flow.categories}</p>
          <p><span className="font-medium">Status:</span> {flow.status}</p>
          <p>
            <span className="font-medium">Validation:</span>{" "}
            {(() => {
              try {
                const validationObj = JSON.parse(flow.validation);
                return `${validationObj.screenTitle || ""} | ${
                  validationObj.largeHeading || ""
                } | ${validationObj.fields?.length || 0} fields`;
              } catch {
                return flow.validation;
              }
            })()}
          </p>
        </div>

        {/* Actions */}
        <div className="flex gap-2 pt-2">
          <button className="whatsapp-action-view flex-1 py-2 rounded-lg text-sm">
            View
          </button>
          <button
            className="whatsapp-action-edit flex-1 py-2 rounded-lg text-sm"
            onClick={() =>
              router.push(
                `/user/manage/whatsapp-flows/builder?flowId=${flow.id}` +
                `&businessId=${encodeURIComponent(flow.businessId)}` +
                `&name=${encodeURIComponent(flow.name)}`
              )
            }
          >
            Edit
          </button>
          <button
            onClick={() => handleDelete(flow.id)}
            className="whatsapp-action-delete flex-1 py-2 rounded-lg text-sm"
          >
            Delete
          </button>
        </div>
      </div>
    ))
  )}
</div>

      
      </div>
    </div>
  );
}
