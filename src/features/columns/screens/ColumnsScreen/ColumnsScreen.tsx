/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
"use client";

import { useEffect, useState } from "react";
import { Eye, EyeOff, Trash2, Search, Edit, ArrowLeft, Settings, Loader2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import "../../columns.css";
import { soft7AxiosInstance } from "@/lib/axiosInstance";
import toast, { Toaster } from "react-hot-toast";

interface Column {
  id: string;
  label: string;
  type: string;
  visible: boolean;
}

export default function ManageColumns() {
  const router = useRouter();
  const [columns, setColumns] = useState<Column[]>([]);
  const [search, setSearch] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  async function fetchColumns() {
    setIsLoading(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 300));
     const res = await soft7AxiosInstance.get("/admin/columns/");

console.log("GET COLUMN RESPONSE", res.data);

const rawData: any[] =
  res.data?.data ||
  res.data?.results ||
  res.data ||
  [];

const data: Column[] = rawData.map((col: any) => ({
  ...col,
  id: String(col.id || col._id || col.key || ""),
  visible: col.visible === true || String(col.visible).toLowerCase() === "true" || col.visible === 1,
}));

      setColumns(data);
    } catch (error) {
      console.error("Failed to fetch columns:", error);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    fetchColumns();
  }, []);

 const handleDelete = async () => {
  if (!deleteId) return;

  try {
    try {
      await soft7AxiosInstance.delete(`/admin/columns/${deleteId}`);
    } catch (e: any) {
      if (e?.response?.status === 404 || e?.response?.status === 301 || e?.response?.status === 308) {
        await soft7AxiosInstance.delete(`/admin/columns/${deleteId}/`);
      } else {
        throw e;
      }
    }

    setColumns((prev) =>
      prev.filter((col) => col.id !== deleteId && (col as any)._id !== deleteId)
    );

    setSelectedIds((prev) =>
      prev.filter((id) => id !== deleteId)
    );

    toast.success("Column deleted successfully");

    setDeleteId(null);
  } catch (error: any) {
    toast.error(
      error?.response?.data?.message ||
      "Failed to delete column"
    );
  }
};

  const toggleVisibility = async (id: string, current: boolean) => {
    const targetCol = columns.find((c) => c.id === id);
    if (!targetCol) return;

    const nextVisible = !current;

    // Optimistic update
    setColumns((prev) =>
      prev.map((col) =>
        col.id === id ? { ...col, visible: nextVisible } : col
      )
    );

    try {
      await soft7AxiosInstance.patch(`/admin/columns/${id}`, {
        visible: nextVisible,
      });
      toast.success(
        `Column "${targetCol.label}" is now ${nextVisible ? "visible" : "hidden"}`
      );
    } catch (error) {
      try {
        await soft7AxiosInstance.put(`/admin/columns/${id}`, {
          label: targetCol.label,
          type: targetCol.type,
          visible: nextVisible,
        });
        toast.success(
          `Column "${targetCol.label}" is now ${nextVisible ? "visible" : "hidden"}`
        );
      } catch (err) {
        console.error("Failed to toggle visibility:", err);
        toast.error("Failed to update column visibility");
        fetchColumns();
      }
    }
  };

  const filteredColumns = columns.filter((col) =>
    col.label.toLowerCase().includes(search.toLowerCase())
  );

  const getTypeBadge = (type: string) => {
    let colorClass = "bg-muted/60 text-muted-foreground border-border";
    switch (type.toLowerCase()) {
      case "string":
      case "text":
        colorClass = "bg-info-bg dark:bg-info-bg/20 text-[var(--color-primary-dark)] dark:text-info border-info-border dark:border-info-border/30";
        break;
      case "number":
      case "integer":
      case "float":
        colorClass = "bg-surface-muted dark:bg-surface-muted/20 text-primary-text dark:text-primary-text border-border-subtle dark:border-primary-soft/30";
        break;
      case "boolean":
        colorClass = "bg-warning-bg dark:bg-warning-bg/20 text-warning dark:text-warning border-warning-border dark:border-warning-border/30";
        break;
      case "date":
      case "datetime":
        colorClass = "bg-primary-lighter dark:bg-primary-light/20 text-primary-text dark:text-primary-text border-primary-soft dark:border-primary-soft/30";
        break;
      default:
        break;
    }
    return (
      <span className={`px-2.5 py-1 text-xs font-semibold rounded-full border ${colorClass}`}>
        {type}
      </span>












    );
  };

 
   return (
  <>
    <Toaster position="top-right" toastOptions={{ duration: 3000 }} />

    <div className="columns-page">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 md:py-8">
        
        {/* Navigation & Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.back()}
              className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground dark:hover:text-foreground transition font-medium"
            >
              <ArrowLeft size={16} />
              <span>Back</span>
            </button>
          </div>

          <Link
            href="/user/manage/columns/create"
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 
                       bg-primary hover:bg-primary text-primary-foreground rounded-xl 
                       text-sm font-semibold transition-all duration-200 shadow-md shadow-[rgba(var(--color-primary-rgb),1)]/10 hover:shadow-[rgba(var(--color-primary-rgb),1)]/20"
          >
        
            <span>Add New Column</span>
          </Link>
        </div>

        {/* Title Block */}
        <div className="mb-8">
          <h1 className="flex items-center text-2xl md:text-3xl font-extrabold text-foreground gap-2">
            <span>Column Management</span>
            <Settings className="w-6 h-6 md:w-8 md:h-8 text-primary-text animate-pulse" />
          </h1>
          <p className="text-sm text-muted-foreground mt-1.5">
            Create, search, and configure custom table columns for contact attributes.
          </p>
        </div>

        {/* Search */}
        <div className="flex justify-start mb-6">
          <div className="relative w-full sm:w-80 md:w-96">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search column by name..."
              className="
                w-full
                pl-11
                pr-4
                h-12
                rounded-xl
                border border-border
                bg-card
                text-foreground
                placeholder-muted-foreground dark:placeholder-muted-foreground
                shadow-sm
                focus:ring-2 focus:ring-primary/25
                focus:border-primary
                text-sm
                outline-none
                transition-all duration-200
              "
            />
          </div>
        </div>

        {/* Main Content Card */}
        <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
          
          {/* TABLE VIEW (Desktop / Tablet) */}
          <div className="hidden md:block overflow-x-auto">
            <table className="min-w-full divide-y divide-border dark:divide-border text-sm">
              <thead className="bg-muted/40">
                <tr>
                  <th className="px-6 py-3.5 text-center w-[5%]">
                    <input
                      type="checkbox"
                      className="rounded border-border text-primary-text focus:ring-primary/20"
                      checked={
                        filteredColumns.length > 0 &&
                        selectedIds.length === filteredColumns.length
                      }
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedIds(filteredColumns.map(col => col.id));
                        } else {
                          setSelectedIds([]);
                        }
                      }}
                    />
                  </th>
                  <th className="px-6 py-3.5 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Column Name
                  </th>
                  <th className="px-6 py-3.5 text-center text-xs font-semibold text-muted-foreground uppercase tracking-wider w-[25%]">
                    Data Type
                  </th>
                  <th className="px-6 py-3.5 text-center text-xs font-semibold text-muted-foreground uppercase tracking-wider w-[15%]">
                    Visibility
                  </th>
                  <th className="px-6 py-3.5 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wider w-[15%]">
                    Actions
                  </th>
                </tr>
              </thead>

              <tbody className="bg-card divide-y divide-border-subtle dark:divide-border">
                {isLoading ? (
                  <tr>
                    <td colSpan={5} className="py-20 text-center">
                      <div className="flex flex-col items-center justify-center">
                        <Loader2 className="w-8 h-8 text-primary-text animate-spin mb-2" />
                        <p className="text-sm font-medium text-muted-foreground">Loading columns...</p>
                      </div>
                    </td>
                  </tr>
                ) : filteredColumns.length > 0 ? (
                  filteredColumns.map((col) => (
                    <tr
                      key={col.id}
                      className="hover:bg-surface-muted/75 dark:hover:bg-surface-active/30 transition-colors duration-150"
                    >
                      <td className="px-6 py-4 text-center">
                        <input
                          type="checkbox"
                          className="rounded border-border text-primary-text focus:ring-primary/20"
                          checked={selectedIds.includes(col.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedIds([...selectedIds, col.id]);
                            } else {
                              setSelectedIds(selectedIds.filter(id => id !== col.id));
                            }
                          }}
                        />
                      </td>
                      
                      {/* Column Name */}
                      <td className="px-6 py-4 whitespace-nowrap font-semibold text-foreground">
                        {col.label}
                      </td>

                      {/* Data Type */}
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        {getTypeBadge(col.type)}
                      </td>

                      {/* Visibility Toggle */}
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <button
                          onClick={() => toggleVisibility(col.id, col.visible)}
                          className={`p-2 rounded-xl transition duration-200 ${
                            col.visible
                              ? "text-primary-text bg-surface-muted dark:bg-primary-light hover:bg-primary-light dark:hover:bg-primary-soft"
                              : "text-muted-foreground bg-muted/60 hover:bg-muted/80"
                          }`}
                          title={col.visible ? "Hide column from user interface" : "Show column in user interface"}
                        >
                          {col.visible ? <Eye size={18} /> : <EyeOff size={18} />}
                        </button>
                      </td>

                      {/* Actions */}
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Link
                            href={`/user/manage/columns/create/${col.id}`}
                            className="p-2 rounded-xl text-muted-foreground hover:text-[var(--color-primary)] hover:bg-info-bg dark:text-muted-foreground dark:hover:text-info dark:hover:bg-info-bg/20 transition duration-200"
                            title="Edit column settings"
                          >
                            <Edit size={18} />
                          </Link>
                          <button
                         onClick={() => setDeleteId(col.id)}
                            className="p-2 rounded-xl text-muted-foreground hover:text-error hover:bg-error-bg dark:text-muted-foreground dark:hover:text-error dark:hover:bg-error-bg/20 transition duration-200"
                            title="Delete column"
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="text-center py-16 px-4">
                      {search ? (
                        <div className="flex flex-col items-center justify-center">
                          <p className="text-foreground font-semibold text-sm">
                            No results found for &quot;
                            <span className="text-primary-text dark:text-primary-text">{search}</span>
                            &quot;
                          </p>
                          <p className="text-muted-foreground text-xs mt-1">
                            Try checking for spelling errors or create a new column instead.
                          </p>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center justify-center">
                          <p className="text-muted-foreground font-medium">No custom columns defined yet.</p>
                          <p className="text-muted-foreground text-xs mt-0.5 mb-4">
                            Define custom attributes for contacts to track extra segmented data.
                          </p>
                          <Link
                            href="/user/manage/columns/create"
                            className="px-4 py-2 bg-primary hover:bg-primary text-primary-foreground rounded-xl text-xs font-semibold shadow-md transition duration-200"
                          >
                            Create First Column
                          </Link>
                        </div>
                      )}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* MOBILE / LIST VIEW */}
          <div className="md:hidden divide-y divide-border-subtle dark:divide-border">
            {isLoading ? (
              <div className="py-16 text-center flex flex-col items-center justify-center">
                <Loader2 className="w-8 h-8 text-primary-text animate-spin mb-2" />
                <p className="text-xs text-muted-foreground">Loading columns...</p>
              </div>
            ) : filteredColumns.length > 0 ? (
              filteredColumns.map((col) => (
                <div
                  key={col.id}
                  className="p-5 bg-card space-y-4 hover:bg-surface-muted/50 dark:hover:bg-surface-raised/50 transition-colors"
                >
                  {/* Top line: Label & Visibility Toggle */}
                  <div className="flex justify-between items-center">
                    <h3 className="font-bold text-foreground text-base">
                      {col.label}
                    </h3>
                    <button
                      onClick={() => toggleVisibility(col.id, col.visible)}
                      className={`p-2 rounded-xl transition duration-200 ${
                        col.visible
                          ? "text-primary-text bg-surface-muted dark:bg-primary-light"
                          : "text-muted-foreground bg-muted/60"
                      }`}
                    >
                      {col.visible ? <Eye size={18} /> : <EyeOff size={18} />}
                    </button>
                  </div>

                  {/* Badges Info */}
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">Type:</span>
                    {getTypeBadge(col.type)}
                  </div>

                  {/* Action Buttons Grid */}
                  <div className="flex gap-3 pt-2">
                    <Link
                      href={`/user/manage/columns/create/${col.id}`}
                      className="flex-1 inline-flex justify-center items-center gap-2 py-2.5 px-4
                                 border border-info-border dark:border-info-border/50 text-[var(--color-primary)] dark:text-info 
                                 rounded-xl text-xs font-semibold hover:bg-info-bg dark:hover:bg-info-bg/20 transition duration-200"
                    >
                      <Edit size={14} />
                      <span>Edit</span>
                    </Link>

                    <button
                     onClick={() => setDeleteId(col.id)}
                      className="flex-1 inline-flex justify-center items-center gap-2 py-2.5 px-4
                                 border border-error-border dark:border-error-border/50 text-error dark:text-error 
                                 rounded-xl text-xs font-semibold hover:bg-error-bg dark:hover:bg-error-bg/20 transition duration-200"
                    >
                      <Trash2 size={14} />
                      <span>Delete</span>
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-16 px-4">
                <p className="text-sm text-muted-foreground">No columns found.</p>
                {!search && (
                  <Link
                    href="/user/manage/columns/create"
                    className="inline-block mt-3 text-xs font-semibold text-primary-text dark:text-primary-text underline"
                  >
                    Click to add new column
                  </Link>
                )}
              </div>
            )}
          </div>

        </div>

           </div>
    </div>

    {deleteId && (
      <div className="fixed inset-0 bg-black/50 dark:bg-black/80 flex items-center justify-center z-[110] p-4 backdrop-blur-sm" onClick={() => setDeleteId(null)}>
        <div className="bg-card rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-border text-center" onClick={e => e.stopPropagation()}>
          <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-error-bg dark:bg-error-bg/30 flex items-center justify-center">
            <Trash2 size={22} className="text-error dark:text-error" />
          </div>
          <h3 className="text-base font-semibold text-foreground mb-1">
            Delete Column
          </h3>
          <p className="text-xs text-muted-foreground mb-6">
            Are you sure you want to delete this custom column? This action cannot be undone.
          </p>
          <div className="flex justify-center gap-3">
            <button
              type="button"
              onClick={() => setDeleteId(null)}
              className="px-4 py-2 text-xs text-foreground hover:bg-muted rounded-lg transition border border-border font-medium"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleDelete}
              className="px-4 py-2 text-xs bg-error text-white rounded-lg hover:bg-error transition font-semibold"
            >
              Delete
            </button>
          </div>
        </div>
      </div>
    )}
  </>
);
}