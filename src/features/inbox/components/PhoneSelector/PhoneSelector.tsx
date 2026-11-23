/* eslint-disable @typescript-eslint/no-explicit-any */
import React from "react";
import { Check, ChevronDown, Phone } from "lucide-react";
import { cn } from "@/lib/utils";
import Dropdown, { DropdownItem, DropdownLabel } from "@/components/ui/Dropdown";
import styles from "./PhoneSelector.module.css";

interface PhoneSelectorProps {
  phoneNumbers: any[];
  selectedPhone: string;
  selectedPhoneMeta: any;
  showPhoneDropdown: boolean;
  setShowPhoneDropdown: React.Dispatch<React.SetStateAction<boolean>>;
  handlePhoneSelect: (phoneId: string) => void;
}

const phoneId = (pn: any) => String(pn.id || pn.phoneNumberId || pn.displayPhone || pn.phone_number);
const phoneLabel = (pn: any) => pn.displayPhone || pn.phone_number || pn.number || phoneId(pn);

/** Switch which connected WhatsApp number the inbox shows. */
export const PhoneSelector = ({
  phoneNumbers,
  selectedPhone,
  selectedPhoneMeta,
  showPhoneDropdown,
  setShowPhoneDropdown,
  handlePhoneSelect,
}: PhoneSelectorProps) => {
  const label =
    selectedPhoneMeta?.displayPhone ||
    selectedPhoneMeta?.phone_number ||
    selectedPhoneMeta?.display_phone_number ||
    selectedPhoneMeta?.number ||
    (phoneNumbers.length > 0 ? "Select phone number" : "No phone numbers connected");

  return (
    <Dropdown
      open={showPhoneDropdown}
      onOpenChange={setShowPhoneDropdown}
      align="start"
      className="w-full"
      menuClassName="w-full max-h-72 overflow-y-auto"
      trigger={
        <button type="button" className={styles.trigger} aria-label="WhatsApp number">
          <span className={styles.icon}>
            <Phone size={12} />
          </span>
          <span className={styles.label}>{label}</span>
          <ChevronDown size={15} className={styles.chevron} />
        </button>
      }
    >
      <DropdownLabel>WhatsApp numbers</DropdownLabel>
      {phoneNumbers.length === 0 ? (
        <p className="px-2.5 py-2 text-xs text-muted-foreground">No phone numbers found</p>
      ) : (
        phoneNumbers.map((pn: any) => {
          const id = phoneId(pn);
          const selected = selectedPhone === id;
          return (
            <DropdownItem
              key={id}
              onSelect={() => handlePhoneSelect(id)}
              className={cn(selected && styles.optionSelected)}
              icon={<span className={styles.dot} />}
            >
              <span className="flex-1 tabular-nums">{phoneLabel(pn)}</span>
              {selected && <Check size={14} />}
            </DropdownItem>
          );
        })
      )}
    </Dropdown>
  );
};
