import React, { useState, useEffect } from "react";
import { X, Save } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { soft7AxiosInstance } from "@/lib/axiosInstance";
import toast from "react-hot-toast";

export const EditReminderModal = ({
  isOpen,
  onClose,
  reminderData,
}: {
  isOpen: boolean;
  onClose: () => void;
  reminderData: any;
}) => {
  const queryClient = useQueryClient();

  const [name, setName] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [frequency, setFrequency] = useState("once");
  const [variables, setVariables] = useState<Record<string, string>>({});

  useEffect(() => {
    if (reminderData && isOpen) {
      setName(reminderData.fullData?.name || reminderData.name || "");
      setDate(reminderData.date || "");
      setTime(reminderData.time || "");
      setFrequency(reminderData.fullData?.frequency || "once");

      // Load existing variables or parameter_mapping
      const existingVars =
        reminderData.fullData?.variables ||
        reminderData.fullData?.parameter_mapping ||
        {};
      setVariables({ ...existingVars });
    }
  }, [reminderData, isOpen]);

  const editMutation = useMutation({
    mutationFn: async (payload: any) => {
      const { data } = await soft7AxiosInstance.put(
        `/admin/reminders/${reminderData.id}`,
        payload
      );
      return data;
    },
    onSuccess: () => {
      toast.success("Reminder updated successfully");
      queryClient.invalidateQueries({ queryKey: ["reminders"] });
      onClose();
    },
    onError: (err: any) => {
      toast.error(
        err?.response?.data?.message || err.message || "Failed to update reminder"
      );
    },
  });

  if (!isOpen || !reminderData) return null;

  const handleSave = () => {
    if (!date || !time) {
      toast.error("Date and Time are required");
      return;
    }

    const local_datetime = `${date}T${time}:00`;
    const timezone =
      reminderData.timezone ||
      Intl.DateTimeFormat().resolvedOptions().timeZone;

    // Contact ID - use singular contact_id as requested
    const contact_id =
      reminderData.fullData?.contact_id ||
      (reminderData.fullData?.contact_ids && reminderData.fullData?.contact_ids[0]) ||
      "";

    const payload = {
      name,
      contact_id,
      phone_number_id: reminderData.fullData?.phone_number_id || "",
      template_id: reminderData.fullData?.template_id || "",
      frequency,
      local_datetime,
      timezone,
      variables,
    };

    editMutation.mutate(payload);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-card w-full max-w-lg rounded-2xl border border-border shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="p-4 border-b border-border flex justify-between items-center bg-muted/30">
          <h2 className="text-lg font-semibold text-foreground">Edit Reminder</h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex-1 flex flex-col gap-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              Reminder Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                Date
              </label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                Time
              </label>
              <input
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              Frequency
            </label>
            <select
              value={frequency}
              onChange={(e) => setFrequency(e.target.value)}
              className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
            >
              <option value="once">Once</option>
              <option value="yearly">Yearly</option>
            </select>
          </div>

          {Object.keys(variables).length > 0 && (
            <div className="mt-2">
              <h3 className="text-sm font-semibold text-foreground mb-2">
                Template Variables
              </h3>
              <div className="flex flex-col gap-3">
                {Object.keys(variables).map((key) => (
                  <div key={key}>
                    <label className="block text-xs font-medium text-muted-foreground mb-1">
                      {key}
                    </label>
                    <input
                      type="text"
                      value={variables[key]}
                      onChange={(e) =>
                        setVariables({ ...variables, [key]: e.target.value })
                      }
                      className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                    />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="p-4 border-t border-border flex justify-end gap-2 bg-muted/30">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm font-medium text-foreground bg-background border border-border hover:bg-muted transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={editMutation.isPending}
            className="px-4 py-2 rounded-lg text-sm font-semibold text-primary-foreground bg-primary hover:bg-primary-hover transition-colors flex items-center gap-2"
          >
            {editMutation.isPending ? (
              <span className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
            ) : (
              <Save size={16} />
            )}
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
};
