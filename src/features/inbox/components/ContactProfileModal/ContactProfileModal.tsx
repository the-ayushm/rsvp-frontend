import React from "react";
import { useRouter } from "next/navigation";
import { Copy, ExternalLink } from "lucide-react";
import toast from "react-hot-toast";
import Avatar from "@/components/ui/Avatar";
import Button from "@/components/ui/Button";
import IconButton from "@/components/ui/IconButton";
import Modal from "@/components/ui/Modal";
import { Contact } from "../../types/inbox.types";
import { removePlusPrefix } from "../../utils/phone.utils";

interface ContactProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedContact: Contact | null;
}

export const ContactProfileModal = ({ isOpen, onClose, selectedContact }: ContactProfileModalProps) => {
  const router = useRouter();
  if (!selectedContact) return null;

  const phone = `+${removePlusPrefix(selectedContact.phone)}`;
  const assigned = Array.isArray(selectedContact.assigned_to)
    ? selectedContact.assigned_to.join(", ")
    : selectedContact.assigned_to;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
          <Button
            leftIcon={<ExternalLink size={15} />}
            onClick={() => {
              onClose();
              router.push(`/user/contacts?search=${encodeURIComponent(selectedContact.name)}`);
            }}
          >
            View in contacts
          </Button>
        </>
      }
    >
      <div className="flex flex-col items-center gap-1 pb-4 text-center">
        <Avatar size="xl" name={selectedContact.name} />
        <h3 className="mt-2 text-base font-semibold text-foreground">{selectedContact.name}</h3>
        <span className="inline-flex items-center gap-1 text-sm tabular-nums text-muted-foreground">
          {phone}
          <IconButton
            aria-label="Copy phone number"
            size="sm"
            icon={<Copy size={14} />}
            onClick={() => {
              navigator.clipboard.writeText(phone);
              toast.success("Phone number copied!");
            }}
          />
        </span>
      </div>
      {assigned && (
        <div className="flex justify-between border-t border-border-subtle pt-3 text-sm">
          <span className="text-muted-foreground">Assigned to</span>
          <span className="font-medium text-foreground">{assigned}</span>
        </div>
      )}
    </Modal>
  );
};
