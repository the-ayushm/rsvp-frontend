/* eslint-disable @typescript-eslint/no-explicit-any */
'use client'

import Avatar from "@/components/ui/Avatar";
import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { 
  ChevronLeft, Plus, Search, X, Tag, 
  MessageCircle, Clock, Loader2, User, Phone, Mail, Calendar, Columns3
} from "lucide-react";
import { soft7AxiosInstance } from "@/lib/axiosInstance";
import toast from "react-hot-toast";

// ==================== TYPES ====================
interface Contact {
  id: string;
  name: string;
  phone_number: string;
  email: string | null;
  status: string;
  tags?: string[];
  assigned_to?: string[];
  created_at: string;
  updated_at: string;
  attributes: Record<string, any>;
  custom_fields?: Record<string, any>;
  notes?: string;
}

interface PipelineStage {
  id: string;
  name: string;
  color: string;
  bgColor: string;
  borderColor: string;
  headerBg: string;
  contacts: Contact[];
}

// Removed hardcoded PIPELINE_STAGES

// Available tags for contacts
// Pipeline tag colors are categorical identities (data), not theme — they keep their own hues.
/* eslint-disable no-restricted-syntax -- categorical data palette */
const AVAILABLE_TAGS = [
  { id: 'repeat_buyer', name: 'Repeat Buyer', color: 'bg-[var(--color-success-light)] text-[var(--color-primary-dark)] dark:bg-green-900/30 dark:text-[var(--color-primary)]' },
  { id: 'recover', name: 'Recover', color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' },
  { id: 'order_placed', name: 'Order placed', color: 'bg-blue-100 text-[var(--color-primary-dark)] dark:bg-blue-900/30 dark:text-blue-400' },
  { id: 'order', name: 'Order', color: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400' },
  { id: 'loyal', name: 'Loyal', color: 'bg-[var(--color-primary-light)] text-purple-700 dark:bg-purple-900/30 dark:text-purple-400' },
  { id: 'lost', name: 'Lost', color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
  { id: 'high_spending', name: 'High spending', color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' },
  { id: 'out', name: 'Out', color: 'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400' },
];
/* eslint-enable no-restricted-syntax */

// ==================== UI COMPONENTS ====================

const LoadingSpinner = () => (
  <div className="flex items-center justify-center py-16">
    <Loader2 className="w-8 h-8 text-primary animate-spin" />
  </div>
);

/** Contact avatar — one brand tint for everyone (semantic colors are reserved for state). */
const NameAvatar = ({ name }: { name: string }) => <Avatar name={name} size="sm" />;

const getContactDealValue = (contact: Contact): number => {
  const attrs = contact.attributes || {};
  const custom = contact.custom_fields || {};
  const raw = attrs.value ?? attrs.amount ?? attrs.deal_value ?? attrs.lead_value ??
              custom.value ?? custom.amount ?? custom.deal_value ?? custom.lead_value ??
              (contact as any).value ?? (contact as any).amount ?? (contact as any).lead_value ?? 0;
  const num = parseFloat(String(raw).replace(/[^0-9.]/g, ''));
  return isNaN(num) ? 0 : num;
};

const formatCurrency = (val: number): string => {
  if (!val || val === 0) return '₹0';
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(val);
};

const ContactCard = ({ 
  contact, 
  stage,
  availableTags = [],
  onDragStart, 
  onTagClick,
  onContactClick 
}: { 
  contact: Contact;
  stage: PipelineStage;
  availableTags?: any[];
  onDragStart: (e: React.DragEvent, contact: Contact) => void;
  onTagClick: (contact: Contact) => void;
  onContactClick: (contact: Contact) => void;
}) => {
  const dealVal = getContactDealValue(contact);

  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, contact)}
      onClick={() => onContactClick(contact)}
      className="bg-surface dark:bg-card rounded-[14px] p-[14px] shadow-[0_2px_8px_rgba(36,28,20,0.04)] border border-border dark:border-border cursor-grab active:cursor-grabbing hover:shadow-[0_12px_24px_-8px_rgba(var(--color-primary-rgb),0.15)] hover:border-primary/30 transition-all duration-200 group relative mb-[12px]"
    >
      <div className="flex items-start justify-between gap-1 mb-[10px]">
        <div className="flex items-center gap-[10px] flex-1 min-w-0">
          <NameAvatar name={contact.name} />
          <div className="flex-1 min-w-0">
            <h4 className="text-[13.5px] font-bold text-foreground dark:text-foreground truncate group-hover:text-primary-text transition-colors">
              {contact.name}
            </h4>
            <p className="text-[11.5px] text-muted-foreground font-mono truncate mt-[2px] flex items-center gap-[4px]">
              <Phone size={10} className="text-muted-foreground shrink-0" />
              {contact.phone_number}
            </p>
          </div>
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onTagClick(contact);
          }}
          className="p-[6px] rounded-[6px] hover:bg-surface-hover transition opacity-0 group-hover:opacity-100 shrink-0 text-muted-foreground hover:text-primary-text"
          title="Manage Tags"
        >
          <Tag size={13} />
        </button>
      </div>

      {/* Deal Amount / Value Badge */}
      {dealVal > 0 && (
        <div className="mt-[8px] mb-[4px] px-[8px] py-[3.5px] bg-surface-muted dark:bg-primary/10 border border-primary-soft dark:border-primary/20 rounded-[6px] flex items-center justify-between text-[11.5px] font-bold text-primary-text">
          <span className="font-semibold text-primary-text dark:text-primary/80 text-[11px] uppercase tracking-wider">Deal Value</span>
          <span>{formatCurrency(dealVal)}</span>
        </div>
      )}

      {/* Tags */}
      {contact.tags && contact.tags.length > 0 && (
        <div className="flex flex-wrap gap-[6px] mt-[10px]">
          {contact.tags.slice(0, 3).map((tag, idx) => {
            const rawVal = typeof tag === 'string' ? tag : (tag as any)?.name || String((tag as any)?.id || '');
            const foundTag = availableTags.find(t => String(t.id) === String(rawVal) || (t.name && t.name.toLowerCase() === String(rawVal).toLowerCase()));
            const displayLabel = foundTag?.name || rawVal;
            const tagInfo = AVAILABLE_TAGS.find(t => t.name === displayLabel || t.id === displayLabel);
            return (
              <span
                key={idx}
                className={`px-[8px] py-[3px] border border-transparent rounded-[6px] text-[11px] font-semibold ${tagInfo?.color || 'bg-surface-active text-muted-foreground dark:bg-surface-raised dark:text-secondary-foreground'}`}
              >
                {displayLabel}
              </span>
            );
          })}
          {contact.tags.length > 3 && (
            <span className="px-[6px] py-[3px] rounded-[6px] text-[11px] text-muted-foreground self-center">
              +{contact.tags.length - 3}
            </span>
          )}
        </div>
      )}

      {/* Contact details footer */}
      <div className="mt-[12px] pt-[10px] border-t border-border dark:border-border flex items-center justify-between text-[11px] text-muted-foreground">
        <div className="flex items-center gap-[5px]">
          <Clock size={11} className="text-muted-foreground" />
          <span className="text-[11px] font-medium">{new Date(contact.created_at).toLocaleDateString(undefined, {month: 'short', day: 'numeric'})}</span>
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            const phone = contact.phone_number.replace(/\D/g, '');
            window.open(`https://wa.me/${phone}`, '_blank');
          }}
          className="p-[6px] rounded-[6px] text-muted-foreground hover:text-primary-text hover:bg-primary/10 transition"
          title="Chat on WhatsApp"
        >
          <MessageCircle size={14} />
        </button>
      </div>
    </div>
  );
};

const StageColumn = ({ 
  stage, 
  availableTags = [],
  onDrop, 
  onDragOver, 
  onDragLeave,
  onDragStart,
  onTagClick,
  onContactClick,
  isDraggingOver 
}: { 
  stage: PipelineStage;
  availableTags?: any[];
  onDrop: (e: React.DragEvent, stageId: string) => void;
  onDragOver: (e: React.DragEvent, stageId: string) => void;
  onDragLeave: (e: React.DragEvent) => void;
  onDragStart: (e: React.DragEvent, contact: Contact) => void;
  onTagClick: (contact: Contact) => void;
  onContactClick: (contact: Contact) => void;
  isDraggingOver: boolean;
}) => {
  return (
    <div
      className={`flex-shrink-0 w-[340px] bg-surface-muted dark:bg-card rounded-[16px] border ${
        isDraggingOver 
          ? 'border-primary shadow-[0_15px_40px_-10px_rgba(var(--color-primary-rgb),0.2)] ring-2 ring-primary/20 bg-surface' 
          : 'border-border dark:border-border shadow-[0_2px_10px_rgba(36,28,20,0.03)]'
      } flex flex-col h-full transition-all duration-200`}
      onDragOver={(e) => onDragOver(e, stage.id)}
      onDragLeave={onDragLeave}
      onDrop={(e) => onDrop(e, stage.id)}
    >
      {/* Column Header */}
      <div className="p-[14px] border-b border-border dark:border-border bg-surface dark:bg-card rounded-t-[16px] flex items-center justify-between gap-2">
        <div className="flex items-center gap-[10px] min-w-0">
          <div className="w-[12px] h-[12px] rounded-full shadow-sm shrink-0" style={{ backgroundColor: stage.color?.replace('text-', '') || 'var(--color-primary)' }} />
          <h3 className="font-bold text-[14px] text-foreground dark:text-foreground tracking-tight truncate">
            {stage.name}
          </h3>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <span className="text-[11px] font-bold text-white px-[10px] py-[4px] rounded-full shrink-0 min-w-[24px] text-center shadow-[0_4px_10px_-2px_rgba(var(--color-primary-rgb),0.4)]" style={{ background: 'linear-gradient(135deg, var(--color-primary), var(--color-primary))' }}>
            {stage.contacts.length}
          </span>
        </div>
      </div>

      {/* Column Content */}
      <div 
        className="flex-1 overflow-y-auto p-2.5 space-y-1 custom-scrollbar-sleek"
      >
        {stage.contacts.length === 0 ? (
          <div className="text-center py-12 px-4 border border-dashed border-border rounded-xl my-1 flex flex-col items-center justify-center bg-surface dark:bg-card">
            <div className="w-9 h-9 mb-2 rounded-full bg-muted border border-border flex items-center justify-center">
              <User size={16} className="text-muted-foreground" />
            </div>
            <p className="text-xs font-medium text-muted-foreground">No contacts</p>
            <p className="text-[10px] text-muted-foreground/80 mt-0.5">Drag & drop here</p>
          </div>
        ) : (
          stage.contacts.map((contact) => (
            <ContactCard
              key={contact.id}
              contact={contact}
              stage={stage}
              availableTags={availableTags}
              onDragStart={onDragStart}
              onTagClick={onTagClick}
              onContactClick={onContactClick}
            />
          ))
        )}
      </div>
    </div>
  );
};

// Add Tag Modal
const AddTagModal = ({
  contact,
  availableTags = [],
  onClose,
  onSave,
}: {
  contact: Contact;
  availableTags?: any[];
  onClose: () => void;
  onSave: (contactId: string, tags: string[]) => void;
}) => {
  const [localTags, setLocalTags] = useState<any[]>(availableTags);
  const [isLoadingTags, setIsLoadingTags] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);

  // Fetch tags if availableTags is empty on modal mount
  useEffect(() => {
    if (availableTags && availableTags.length > 0) {
      setLocalTags(availableTags);
    } else {
      setIsLoadingTags(true);
      soft7AxiosInstance.get('/admin/contacts/tags')
        .then(res => {
          let list: any[] = [];
          if (res.data?.success && Array.isArray(res.data.data)) list = res.data.data;
          else if (Array.isArray(res.data)) list = res.data;
          else if (res.data?.tags && Array.isArray(res.data.tags)) list = res.data.tags;
          else if (res.data?.data?.tags && Array.isArray(res.data.data.tags)) list = res.data.data.tags;
          setLocalTags(list);
        })
        .catch(err => console.error('Failed to load tags in modal:', err))
        .finally(() => setIsLoadingTags(false));
    }
  }, [availableTags]);

  // Sync selectedTags mapping when contact.tags or localTags change
  useEffect(() => {
    if (!Array.isArray(contact.tags)) {
      setSelectedTags([]);
      return;
    }
    const mapped = contact.tags.map(t => {
      if (typeof t === 'object' && t !== null) return String((t as any).id || (t as any).name);
      const rawStr = String(t);
      const found = localTags.find(at => String(at.id) === rawStr || (at.name && at.name.toLowerCase() === rawStr.toLowerCase()));
      return found ? String(found.id) : rawStr;
    }).filter(Boolean);
    setSelectedTags(mapped);
  }, [contact.tags, localTags]);

  const filteredTags = localTags.filter(tag =>
    (tag.name || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  const toggleTag = (tagId: string) => {
    setSelectedTags(prev =>
      prev.includes(tagId)
        ? prev.filter(t => t !== tagId)
        : [...prev, tagId]
    );
  };

  const handleSave = () => {
    onSave(contact.id, selectedTags);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 dark:bg-black/70 flex items-center justify-center z-[9999] p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-card text-foreground rounded-xl w-full max-w-md shadow-2xl border border-border overflow-hidden max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="px-5 py-4 border-b border-border flex justify-between items-center">
          <h3 className="text-sm font-semibold text-foreground">
            Manage Tags - {contact.name}
          </h3>
          <button onClick={onClose} className="p-1 text-muted-foreground hover:text-secondary-foreground">
            <X size={16} />
          </button>
        </div>
        
        <div className="p-5">
          <div className="relative mb-4">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search tags..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs border border-border rounded-lg bg-muted text-foreground focus:outline-none focus:border-border focus:ring-1 focus:ring-ring"
            />
          </div>

          {selectedTags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-4">
              {selectedTags.map((tagId, idx) => {
                const tagObj = localTags.find(t => String(t.id) === String(tagId) || (t.name && t.name.toLowerCase() === String(tagId).toLowerCase()));
                const tagLabel = tagObj?.name || tagId;
                return (
                  <span
                    key={idx}
                    className="px-2 py-0.5 rounded-md text-xs bg-muted border border-border text-foreground flex items-center gap-1"
                  >
                    {tagLabel}
                    <button onClick={() => toggleTag(String(tagId))} className="hover:opacity-70 text-muted-foreground">
                      <X size={12} />
                    </button>
                  </span>
                );
              })}
            </div>
          )}

          <div className="space-y-1 max-h-64 overflow-y-auto custom-scrollbar-sleek">
            {isLoadingTags ? (
              <div className="flex justify-center py-6">
                <Loader2 size={18} className="animate-spin text-primary" />
              </div>
            ) : filteredTags.length === 0 ? (
              <p className="text-center text-xs text-muted-foreground py-4">No tags found</p>
            ) : (
              filteredTags.map(tag => {
                const tagIdStr = String(tag.id);
                const isSelected = selectedTags.includes(tagIdStr) || selectedTags.includes(tag.name);
                return (
                  <label
                    key={tag.id}
                    className="flex items-center gap-2.5 p-2 hover:bg-muted rounded-lg cursor-pointer transition"
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleTag(tagIdStr)}
                      className="w-3.5 h-3.5 accent-foreground rounded cursor-pointer"
                    />
                    <span className="px-2 py-0.5 rounded-md text-xs bg-muted border border-border text-foreground">
                      {tag.name}
                    </span>
                  </label>
                );
              })
            )}
          </div>
        </div>

        <div className="px-5 py-3 border-t border-border flex justify-end gap-2 bg-muted/40">
          <button
            onClick={onClose}
            className="px-3.5 py-1.5 text-xs border border-border text-muted-foreground rounded-lg hover:bg-muted transition"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-1.5 text-xs bg-primary text-primary-foreground rounded-lg hover:opacity-90 font-medium transition"
          >
            Save Tags
          </button>
        </div>
      </div>
    </div>
  );
};

// Contact Details Modal
const ContactDetailsModal = ({
  contact,
  onClose,
  onStatusChange,
  stages,
}: {
  contact: Contact;
  onClose: () => void;
  onStatusChange: (contactId: string, newStatus: string) => void;
  stages: PipelineStage[];
}) => {
  const [selectedStatus, setSelectedStatus] = useState(contact.status);

  return (
    <div className="fixed inset-0 bg-black/50 dark:bg-black/70 flex items-center justify-center z-[9999] p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-surface dark:bg-card text-foreground rounded-[16px] w-full shadow-[0_30px_70px_-22px_rgba(var(--color-primary-rgb),0.3),0_2px_10px_rgba(36,28,20,0.05)] border-none flex flex-col overflow-hidden" style={{ maxWidth: '560px' }} onClick={e => e.stopPropagation()}>
        
        {/* Header */}
        <div className="px-[26px] py-[20px] flex items-center justify-between relative overflow-hidden bg-gradient-to-br from-primary to-primary">
          <div className="absolute w-[180px] h-[180px] rounded-full -top-[100px] -right-[50px] pointer-events-none" style={{ backgroundColor: 'color-mix(in oklab, var(--color-primary-foreground) 8%, transparent)' }}></div>
          
          <div className="flex items-center gap-[11px] relative z-10">
            <div className="w-[34px] h-[34px] rounded-[10px] flex items-center justify-center shrink-0" style={{ backgroundColor: 'color-mix(in oklab, var(--color-primary-foreground) 18%, transparent)' }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-[16px] h-[16px] text-white">
                <circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>
              </svg>
            </div>
            <div className="font-semibold tracking-[-0.01em] m-0 text-white" style={{ fontSize: '18px', fontFamily: '"Space Grotesk", "Inter", sans-serif' }}>
              Contact details
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-[30px] h-[30px] shrink-0 rounded-full border-none flex items-center justify-center transition-colors relative z-10 hover:bg-surface/20"
            style={{ backgroundColor: 'color-mix(in oklab, var(--color-primary-foreground) 16%, transparent)' }}
            aria-label="Close"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="var(--color-primary-foreground)" strokeWidth="2" strokeLinecap="round" className="w-[13px] h-[13px]"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        {/* Identity Strip */}
        <div className="flex items-center gap-[14px] px-[26px] py-[20px] border-b border-border bg-surface-hover">
          <div className="w-[44px] h-[44px] rounded-full text-white flex items-center justify-center font-bold text-[16px] shrink-0 shadow-[0_6px_16px_-6px_rgba(var(--color-primary-rgb),0.5)]" style={{ background: 'linear-gradient(135deg, var(--color-primary), var(--color-primary))' }}>
            {contact.name.charAt(0).toUpperCase()}
          </div>
          <div>
            <div className="text-[15.5px] font-bold text-foreground">
              {contact.name}
            </div>
            <div className="text-[12.5px] text-muted-foreground mt-[3px] flex items-center gap-[6px]">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-[12px] h-[12px] shrink-0"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
              {contact.phone_number}
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="px-[26px] py-[22px] pb-[8px]">
          
          {contact.email && (
            <div className="flex flex-col gap-[8px] py-[14px] border-b border-border">
              <div className="flex items-center gap-[8px] text-[12px] font-bold tracking-[0.04em] uppercase text-primary-text">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-[14px] h-[14px] shrink-0 text-primary-text"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 6-10 7L2 6"/></svg>
                Email
              </div>
              <div className="text-[14.5px] text-muted-foreground italic pl-[22px] break-all">
                {contact.email}
              </div>
            </div>
          )}

          <div className="flex flex-col gap-[8px] py-[14px] border-b border-border">
            <div className="flex items-center gap-[8px] text-[12px] font-bold tracking-[0.04em] uppercase text-primary-text">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-[14px] h-[14px] shrink-0 text-primary-text"><path d="M20.59 13.41 11 22.99a2 2 0 0 1-2.83 0L1 15.83a2 2 0 0 1 0-2.83L10.59 3.41A2 2 0 0 1 12 3H19a2 2 0 0 1 2 2v7a2 2 0 0 1-.41 1.41z"/><circle cx="15.5" cy="8.5" r="1.5" fill="currentColor" stroke="none"/></svg>
              Status
            </div>
            <div className="relative mt-[4px] ml-[22px]">
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="w-full rounded-[8px] border-[1.5px] border-border bg-surface-muted pl-[14px] pr-[34px] py-[10px] text-[14px] text-foreground transition-all focus:outline-none focus:border-primary focus:bg-surface focus:shadow-[0_0_0_3px_rgba(var(--color-primary-rgb),0.15)] appearance-none cursor-pointer"
              >
                {stages.map(stage => (
                  <option key={stage.id} value={stage.id}>
                    {stage.name}
                  </option>
                ))}
              </select>
              <svg className="absolute right-[12px] top-1/2 -translate-y-1/2 w-[15px] h-[15px] text-muted-foreground pointer-events-none" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 12 15 18 9"/></svg>
            </div>
          </div>

          <div className="flex flex-col gap-[8px] py-[14px] border-b border-border">
            <div className="flex items-center gap-[8px] text-[12px] font-bold tracking-[0.04em] uppercase text-primary-text">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-[14px] h-[14px] shrink-0 text-primary-text"><path d="M20.59 13.41 11 22.99a2 2 0 0 1-2.83 0L1 15.83a2 2 0 0 1 0-2.83L10.59 3.41A2 2 0 0 1 12 3H19a2 2 0 0 1 2 2v7a2 2 0 0 1-.41 1.41z"/><circle cx="15.5" cy="8.5" r="1.5" fill="currentColor" stroke="none"/></svg>
              Tags
            </div>
            <div className="pl-[22px] flex flex-wrap gap-[6px]">
              {contact.tags && contact.tags.length > 0 ? (
                contact.tags.map((tag, idx) => {
                  const tagStr = typeof tag === 'string' ? tag : (tag as any)?.name || String((tag as any)?.id || '');
                  const tagInfo = AVAILABLE_TAGS.find(t => t.name === tagStr || t.id === tagStr);
                  return (
                    <span
                      key={idx}
                      className={`px-[8px] py-[4px] rounded-[6px] text-[12.5px] font-medium ${tagInfo?.color || 'bg-surface-hover text-secondary-foreground'}`}
                    >
                      {tagStr}
                    </span>
                  );
                })
              ) : (
                <div className="text-[13.5px] text-muted-foreground">No tags added yet</div>
              )}
            </div>
          </div>

          <div className="flex flex-col gap-[8px] py-[14px] border-b border-border last:border-0">
            <div className="flex items-center gap-[8px] text-[12px] font-bold tracking-[0.04em] uppercase text-primary-text">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-[14px] h-[14px] shrink-0 text-primary-text"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
              Created at
            </div>
            <div className="text-[14.5px] text-muted-foreground italic pl-[22px]">
              {new Date(contact.created_at).toLocaleString()}
            </div>
          </div>

          {contact.notes && (
            <div className="flex flex-col gap-[8px] py-[14px] border-t border-border">
              <div className="flex items-center gap-[8px] text-[12px] font-bold tracking-[0.04em] uppercase text-primary-text">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-[14px] h-[14px] shrink-0 text-primary-text"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
                Notes
              </div>
              <div className="text-[14.5px] text-foreground pl-[22px]">
                {contact.notes}
              </div>
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="flex justify-end gap-[10px] px-[26px] py-[16px] pb-[22px] border-t border-border shrink-0 bg-surface dark:bg-card">
          <button
            onClick={onClose}
            className="px-[20px] py-[11px] rounded-[8px] text-[14px] font-semibold bg-surface border-[1.5px] border-border text-muted-foreground hover:bg-surface-hover transition-all duration-150"
          >
            Cancel
          </button>
          <button
            onClick={() => {
              onStatusChange(contact.id, selectedStatus);
              onClose();
            }}
            className="px-[20px] py-[11px] rounded-[8px] text-[14px] font-semibold text-white transition-all duration-150 flex items-center gap-[7px] hover:brightness-105 hover:-translate-y-[1px] shadow-[0_10px_22px_-8px_rgba(var(--color-primary-rgb),0.55)]"
            style={{ background: 'linear-gradient(135deg, var(--color-primary), var(--color-primary))' }}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-[15px] h-[15px]"><polyline points="20 6 9 17 4 12"/></svg>
            Update status
          </button>
        </div>
      </div>
    </div>
  );
};

// Create Contact Modal
const CreateContactModal = ({
  onClose,
  onSuccess,
  stages,
}: {
  onClose: () => void;
  onSuccess: () => void;
  stages: PipelineStage[];
}) => {
  const [formData, setFormData] = useState({
    name: '',
    phone_number: '',
    status: stages.length > 0 ? stages[0].id : 'new_lead',
    dealValue: '',
    message: '',
  });
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.phone_number.trim()) {
      toast.error('Name and phone number are required');
      return;
    }

    setIsLoading(true);
    try {
      const response = await soft7AxiosInstance.post('/admin/contacts', {
        name: formData.name,
        phone_number: formData.phone_number,
        status: formData.status,
        notes: formData.message,
        attributes: {
          value: formData.dealValue ? parseFloat(formData.dealValue) : 0,
        },
      });
      if (response.data.success) {
        toast.success('Contact created successfully');
        onSuccess();
        onClose();
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to create contact');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 dark:bg-black/70 flex items-center justify-center z-[9999] p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-surface dark:bg-card text-foreground rounded-[16px] w-full shadow-[0_30px_70px_-22px_rgba(var(--color-primary-rgb),0.3),0_2px_10px_rgba(36,28,20,0.05)] border-none flex flex-col overflow-hidden" style={{ maxWidth: '500px' }} onClick={e => e.stopPropagation()}>
        
        {/* Header */}
        <div className="px-[26px] py-[20px] flex items-center justify-between relative overflow-hidden bg-gradient-to-br from-primary to-primary">
          <div className="absolute w-[180px] h-[180px] rounded-full -top-[100px] -right-[50px] pointer-events-none" style={{ backgroundColor: 'color-mix(in oklab, var(--color-primary-foreground) 8%, transparent)' }}></div>
          
          <div className="flex items-center gap-[11px] relative z-10">
            <div className="w-[34px] h-[34px] rounded-[10px] flex items-center justify-center shrink-0" style={{ backgroundColor: 'color-mix(in oklab, var(--color-primary-foreground) 18%, transparent)' }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-[16px] h-[16px] text-white">
                <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="16" y1="11" x2="22" y2="11"/>
              </svg>
            </div>
            <div className="font-semibold tracking-[-0.01em] m-0 text-white" style={{ fontSize: '18px', fontFamily: '"Space Grotesk", "Inter", sans-serif' }}>
              Create contact
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-[30px] h-[30px] shrink-0 rounded-full border-none flex items-center justify-center transition-colors relative z-10 hover:bg-surface/20"
            style={{ backgroundColor: 'color-mix(in oklab, var(--color-primary-foreground) 16%, transparent)' }}
            aria-label="Close"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="var(--color-primary-foreground)" strokeWidth="2" strokeLinecap="round" className="w-[13px] h-[13px]"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="flex flex-col">
          <div className="px-[26px] pt-[24px] pb-[6px]">
            <div className="mb-[18px]">
              <label className="block text-[13px] font-semibold text-foreground mb-[7px]">
                Name <span className="text-primary-text ml-[2px]">*</span>
              </label>
              <div className="relative">
                <svg className="absolute left-[13px] top-1/2 -translate-y-1/2 w-[16px] h-[16px] text-muted-foreground pointer-events-none" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData(p => ({ ...p, name: e.target.value }))}
                  placeholder="Enter name"
                  required
                  className="w-full rounded-[8px] border-[1.5px] border-border bg-surface-muted pl-[38px] pr-[14px] py-[11px] text-[14px] text-foreground transition-all focus:outline-none focus:border-primary focus:bg-surface focus:shadow-[0_0_0_3px_rgba(var(--color-primary-rgb),0.15)] placeholder:text-muted-foreground"
                />
              </div>
            </div>

            <div className="mb-[18px]">
              <label className="block text-[13px] font-semibold text-foreground mb-[7px]">
                Phone number <span className="text-primary-text ml-[2px]">*</span>
              </label>
              <div className="relative">
                <svg className="absolute left-[13px] top-1/2 -translate-y-1/2 w-[16px] h-[16px] text-muted-foreground pointer-events-none" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
                <input
                  type="tel"
                  value={formData.phone_number}
                  onChange={(e) => setFormData(p => ({ ...p, phone_number: e.target.value }))}
                  placeholder="Enter phone number"
                  required
                  className="w-full rounded-[8px] border-[1.5px] border-border bg-surface-muted pl-[38px] pr-[14px] py-[11px] text-[14px] text-foreground transition-all focus:outline-none focus:border-primary focus:bg-surface focus:shadow-[0_0_0_3px_rgba(var(--color-primary-rgb),0.15)] placeholder:text-muted-foreground"
                />
              </div>
            </div>

            <div className="mb-[18px]">
              <label className="block text-[13px] font-semibold text-foreground mb-[7px]">
                Status
              </label>
              <div className="relative">
                <svg className="absolute left-[13px] top-1/2 -translate-y-1/2 w-[16px] h-[16px] text-primary-text pointer-events-none" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="3" fill="currentColor" stroke="none"/></svg>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData(p => ({ ...p, status: e.target.value }))}
                  className="w-full rounded-[8px] border-[1.5px] border-border bg-surface-muted pl-[38px] pr-[34px] py-[11px] text-[14px] text-foreground transition-all focus:outline-none focus:border-primary focus:bg-surface focus:shadow-[0_0_0_3px_rgba(var(--color-primary-rgb),0.15)] appearance-none cursor-pointer"
                >
                  {stages.map(stage => (
                    <option key={stage.id} value={stage.id}>
                      {stage.name}
                    </option>
                  ))}
                </select>
                <svg className="absolute right-[12px] top-1/2 -translate-y-1/2 w-[15px] h-[15px] text-muted-foreground pointer-events-none" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 12 15 18 9"/></svg>
              </div>
            </div>

            <div className="mb-[18px]">
              <label className="block text-[13px] font-semibold text-foreground mb-[7px]">
                Deal Value / Amount (₹)
              </label>
              <div className="relative">
                <span className="absolute left-[13px] top-1/2 -translate-y-1/2 text-[14px] font-bold text-muted-foreground pointer-events-none">₹</span>
                <input
                  type="number"
                  value={formData.dealValue}
                  onChange={(e) => setFormData(p => ({ ...p, dealValue: e.target.value }))}
                  placeholder="e.g. 25000"
                  className="w-full rounded-[8px] border-[1.5px] border-border bg-surface-muted pl-[34px] pr-[14px] py-[11px] text-[14px] text-foreground transition-all focus:outline-none focus:border-primary focus:bg-surface focus:shadow-[0_0_0_3px_rgba(var(--color-primary-rgb),0.15)] placeholder:text-muted-foreground"
                />
              </div>
            </div>

            <div className="mb-[18px]">
              <label className="block text-[13px] font-semibold text-foreground mb-[7px]">
                Message
              </label>
              <textarea
                rows={3}
                value={formData.message}
                onChange={(e) => setFormData(p => ({ ...p, message: e.target.value }))}
                placeholder="Add a message..."
                className="w-full min-h-[78px] rounded-[8px] border-[1.5px] border-border bg-surface-muted px-[14px] py-[11px] text-[14px] text-foreground transition-all focus:outline-none focus:border-primary focus:bg-surface focus:shadow-[0_0_0_3px_rgba(var(--color-primary-rgb),0.15)] placeholder:text-muted-foreground resize-y"
              />
            </div>
          </div>

          <div className="flex justify-end gap-[10px] px-[26px] py-[16px] pb-[22px] border-t border-border shrink-0 bg-surface dark:bg-card">
            <button
              type="button"
              onClick={onClose}
              className="px-[20px] py-[11px] rounded-[8px] text-[14px] font-semibold bg-surface border-[1.5px] border-border text-muted-foreground hover:bg-surface-hover transition-all duration-150 flex items-center gap-[7px]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="px-[20px] py-[11px] rounded-[8px] text-[14px] font-semibold text-white transition-all duration-150 flex items-center gap-[7px] disabled:opacity-50 hover:brightness-105 hover:-translate-y-[1px] shadow-[0_10px_22px_-8px_rgba(var(--color-primary-rgb),0.55)]"
              style={{ background: 'linear-gradient(135deg, var(--color-primary), var(--color-primary))' }}
            >
              {isLoading ? (
                <>
                  <Loader2 size={15} className="animate-spin" /> Creating...
                </>
              ) : (
                <>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-[15px] h-[15px]"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                  Create contact
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ==================== MAIN PAGE ====================
export default function SalesPipelinePage() {
  const router = useRouter();
  const [stages, setStages] = useState<PipelineStage[]>([]);
  const [allStages, setAllStages] = useState<PipelineStage[]>([]);
  const [selectedPipelines, setSelectedPipelines] = useState<string[]>([]);
  const [showPipelineDropdown, setShowPipelineDropdown] = useState(false);
  const pipelineRef = useRef<HTMLDivElement>(null);
  const pipelineButtonRef = useRef<HTMLButtonElement>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  const contactsControllerRef = useRef<AbortController | null>(null);
  const [draggedContact, setDraggedContact] = useState<Contact | null>(null);
  const [draggingOverStage, setDraggingOverStage] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [showTagModal, setShowTagModal] = useState(false);
  const [contactForTag, setContactForTag] = useState<Contact | null>(null);
  const [availableTags, setAvailableTags] = useState<any[]>([]);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearchQuery(searchQuery.trim()), 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => () => contactsControllerRef.current?.abort(), []);

  const fetchAvailableTags = useCallback(async () => {
    try {
      let res;
      try {
        res = await soft7AxiosInstance.get('/admin/contacts/tags');
      } catch (err) {
        res = await soft7AxiosInstance.get('/admin/tags');
      }
      let tagsList: any[] = [];
      if (res.data?.success && Array.isArray(res.data.data)) {
        tagsList = res.data.data;
      } else if (Array.isArray(res.data)) {
        tagsList = res.data;
      } else if (res.data?.tags && Array.isArray(res.data.tags)) {
        tagsList = res.data.tags;
      } else if (res.data?.data?.tags && Array.isArray(res.data.data.tags)) {
        tagsList = res.data.data.tags;
      }
      setAvailableTags(tagsList);
    } catch (e) {
      console.error('Failed to fetch available tags', e);
    }
  }, []);

  useEffect(() => {
    fetchAvailableTags();
  }, [fetchAvailableTags]);

  // Click-outside for pipeline dropdown
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        showPipelineDropdown &&
        pipelineRef.current && !pipelineRef.current.contains(e.target as Node) &&
        pipelineButtonRef.current && !pipelineButtonRef.current.contains(e.target as Node)
      ) {
        setShowPipelineDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showPipelineDropdown]);

  // Fetch contacts
  const fetchContacts = useCallback(async () => {
    contactsControllerRef.current?.abort();
    const controller = new AbortController();
    contactsControllerRef.current = controller;
    setIsLoading(true);
    try {
      // 1. Fetch pipelines
      const pipelineRes = await soft7AxiosInstance.get('/admin/pipeline', { signal: controller.signal });
      if (controller.signal.aborted) return;
      const rawStages = pipelineRes.data?.data ?? pipelineRes.data ?? [];
      const dbStages = Array.isArray(rawStages) ? rawStages : [];

      const formattedStages: PipelineStage[] = dbStages
        .slice()
        .sort((a: any, b: any) => (a.position || 0) - (b.position || 0))
        .map((s: any) => ({
          id: String(s.id),
          name: s.name || 'Stage',
          color: s.color || '',
          bgColor: s.bg_color || '',
          borderColor: s.border_color || '',
          headerBg: s.header_bg || '',
          contacts: []
        }));

      setAllStages(formattedStages);

      // Load selected pipelines from localStorage
      const saved = localStorage.getItem('sales_pipeline_selected');
      let currentSelected = formattedStages.map(s => s.id);
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) {
            currentSelected = parsed;
          }
        } catch(e) {}
      }
      setSelectedPipelines(currentSelected);

      // Each pipeline UUID is the backend status filter for its contacts.
      const stageResults = await Promise.allSettled(formattedStages.map(async stage => {
        const response = await soft7AxiosInstance.get('/admin/contacts', {
          signal: controller.signal,
          params: {
            page: 1,
            limit: 2000,
            sortBy: 'created_at',
            sortOrder: 'desc',
            status: stage.id,
            ...(debouncedSearchQuery ? { search: debouncedSearchQuery } : {}),
          },
        });
        if (response.data?.success === false) {
          throw new Error(response.data.message || 'Failed to load pipeline contacts');
        }
        const rawContacts = response.data?.data?.contacts ?? response.data?.data ?? response.data?.contacts ?? [];
        const contacts = Array.isArray(rawContacts) ? rawContacts : [];

        return {
          ...stage,
          contacts: contacts.map((c: any): Contact => ({
            id: String(c.id),
            name: c.name || 'No Name',
            phone_number: c.phone_number || '',
            email: c.email,
            status: c.status || stage.id,
            tags: Array.isArray(c.tags) ? c.tags : [],
            assigned_to: Array.isArray(c.assigned_to)
              ? c.assigned_to
              : c.assigned_to
              ? [c.assigned_to]
              : [],
            created_at: c.created_at || new Date().toISOString(),
            updated_at: c.updated_at || new Date().toISOString(),
            attributes: c.attributes || {},
            notes: c.notes,
          })),
        };
      }));
      if (controller.signal.aborted) return;
      const updatedStages = stageResults.map(result => {
        if (result.status === 'rejected') throw result.reason;
        return result.value;
      });

      setStages(updatedStages);
    } catch (error) {
      if (controller.signal.aborted) return;
      console.error('Failed to fetch data:', error);
      toast.error('Failed to load data');
      setStages([]);
      setAllStages([]);
    } finally {
      if (contactsControllerRef.current === controller) {
        contactsControllerRef.current = null;
        if (!controller.signal.aborted) setIsLoading(false);
      }
    }
  }, [debouncedSearchQuery]);

  useEffect(() => {
    fetchContacts();
  }, [fetchContacts]);

  // Drag and drop handlers
  const handleDragStart = (e: React.DragEvent, contact: Contact) => {
    setDraggedContact(contact);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', JSON.stringify(contact));
    // Add transparent drag image
    const dragImage = document.createElement('div');
    dragImage.style.opacity = '0';
    document.body.appendChild(dragImage);
    e.dataTransfer.setDragImage(dragImage, 0, 0);
    setTimeout(() => document.body.removeChild(dragImage), 0);
  };

  const handleDragOver = (e: React.DragEvent, stageId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (draggingOverStage !== stageId) {
      setDraggingOverStage(stageId);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setDraggingOverStage(null);
  };

  const handleDrop = async (e: React.DragEvent, targetStageId: string) => {
    e.preventDefault();
    setDraggingOverStage(null);
    
    if (!draggedContact) return;
    
    // Find source stage
    const sourceStage = stages.find(s => s.contacts.some(c => c.id === draggedContact.id));
    if (!sourceStage || sourceStage.id === targetStageId) return;

    // Update UI optimistically
    const updatedStages = stages.map(stage => {
      if (stage.id === sourceStage.id) {
        return {
          ...stage,
          contacts: stage.contacts.filter(c => c.id !== draggedContact.id)
        };
      }
      if (stage.id === targetStageId) {
        const updatedContact = { ...draggedContact, status: targetStageId };
        return {
          ...stage,
          contacts: [...stage.contacts, updatedContact]
        };
      }
      return stage;
    });
    
    setStages(updatedStages);

    // Update in backend
    try {
      await soft7AxiosInstance.put(`/admin/contacts/${draggedContact.id}`, {
        status: targetStageId
      });
      toast.success(`Moved to ${allStages.find(s => s.id === targetStageId)?.name || targetStageId}`);
      fetchContacts();
    } catch (error) {
      console.error('Failed to update contact status:', error);
      toast.error('Failed to update contact status');
      // Revert on error
      fetchContacts();
    }
    
    setDraggedContact(null);
  };

  // Update contact status
  const handleStatusChange = async (contactId: string, newStatus: string) => {
    try {
      await soft7AxiosInstance.put(`/admin/contacts/${contactId}`, { status: newStatus });
      toast.success('Status updated');
      fetchContacts();
    } catch (error) {
      toast.error('Failed to update status');
    }
  };

  // Update contact tags
  const handleUpdateTags = async (contactId: string, tags: string[]) => {
    try {
      const cleanTags = tags.map(t => String(t));
      const res = await soft7AxiosInstance.put(`/admin/contacts/${contactId}`, { tag_ids: cleanTags });
      if (res.data?.success) {
        toast.success('Tags updated successfully');
        fetchContacts();
      } else {
        toast.error(res.data?.message || 'Failed to update tags');
      }
    } catch (error: any) {
      console.error('Update tags error:', error);
      toast.error(error.response?.data?.message || 'Failed to update tags');
    }
  };

  return (
    <div className="h-[calc(100vh-70px)] bg-background flex flex-col overflow-hidden">
      {/* Sleek Scrollbar Styles */}
      <style dangerouslySetInnerHTML={{ __html: `
        .custom-scrollbar-sleek::-webkit-scrollbar {
          width: 6px;
          height: 6px;
        }
        .custom-scrollbar-sleek::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar-sleek::-webkit-scrollbar-thumb {
          background: var(--color-border-strong);
          border-radius: 9999px;
        }
        .dark .custom-scrollbar-sleek::-webkit-scrollbar-thumb {
          background: var(--neutral-700);
        }
        .custom-scrollbar-sleek::-webkit-scrollbar-thumb:hover {
          background: var(--neutral-500);
        }
      `}} />

      {/* Header */}
      <div className="shrink-0 bg-surface/90 dark:bg-card/90 backdrop-blur-md border-b border-border dark:border-border shadow-[0_4px_20px_-10px_rgba(var(--color-primary-rgb),0.08)]">
        <div className="max-w-[1600px] mx-auto px-6 py-3">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-[14px]">
              <button
                onClick={() => router.back()}
                className="p-[8px] rounded-[10px] border border-border dark:border-border text-muted-foreground hover:text-primary-text hover:bg-surface-hover transition-all bg-surface-muted dark:bg-card shadow-[0_2px_8px_rgba(36,28,20,0.04)]"
              >
                <ChevronLeft size={16} />
              </button>
              <div className="flex items-center gap-[10px]">
                <h1 className="text-[20px] font-bold text-foreground dark:text-foreground">
                  Sales Pipeline
                </h1>
                <span className="px-[10px] py-[3px] text-[11px] font-bold rounded-full bg-primary/10 text-primary-text border border-primary/20 flex items-center gap-[6px]">
                  <span className="w-[6px] h-[6px] rounded-full bg-primary animate-pulse" />
                  Drag & Drop Active
                </span>
              </div>
            </div>

            <div className="flex items-center gap-[12px]">
              {/* Search */}
              <div className="relative">
                <Search size={14} className="absolute left-[12px] top-1/2 -translate-y-1/2 text-primary-text" />
                <input
                  type="text"
                  placeholder="Search contacts..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-[34px] pr-[14px] py-[8px] text-[13px] font-medium border-[1.5px] border-border dark:border-border rounded-[10px] bg-surface-muted dark:bg-card text-foreground dark:text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary focus:bg-surface focus:shadow-[0_0_0_3px_rgba(var(--color-primary-rgb),0.15)] transition-all w-[260px]"
                />
              </div>

              {/* Pipeline Dropdown */}
              <div className="relative">
                <button
                  ref={pipelineButtonRef}
                  onClick={() => setShowPipelineDropdown(p => !p)}
                  className="flex items-center gap-[8px] px-[14px] py-[9px] text-[13px] font-semibold text-muted-foreground bg-surface-muted border border-border dark:border-border rounded-[10px] hover:bg-surface-hover hover:text-primary-text transition-all shadow-[0_2px_8px_rgba(36,28,20,0.04)]"
                >
                  <Columns3 size={15} />
                  Pipelines
                </button>

                {showPipelineDropdown && (
                  <div 
                    ref={pipelineRef}
                    className="absolute right-0 top-[calc(100%+8px)] w-[240px] bg-surface border border-border rounded-[16px] shadow-[0_15px_40px_-10px_rgba(var(--color-primary-rgb),0.15)] z-50 overflow-hidden"
                  >
                    <div className="p-[8px] max-h-64 overflow-y-auto custom-scrollbar-sleek">
                      {allStages.map(stage => (
                        <label key={stage.id} className="flex items-center gap-[10px] px-[12px] py-[8px] hover:bg-surface-muted rounded-[10px] cursor-pointer transition-all">
                          <input 
                            type="checkbox"
                            checked={selectedPipelines.includes(stage.id)}
                            onChange={() => {
                              const newSelected = selectedPipelines.includes(stage.id)
                                ? selectedPipelines.filter(id => id !== stage.id)
                                : [...selectedPipelines, stage.id];
                              setSelectedPipelines(newSelected);
                              localStorage.setItem('sales_pipeline_selected', JSON.stringify(newSelected));
                            }}
                            className="w-[16px] h-[16px] accent-primary-text rounded-[4px] border-border"
                          />
                          <span className="text-[13px] font-semibold text-foreground">{stage.name}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Add Contact Button */}
              <button
                onClick={() => setShowCreateModal(true)}
                className="flex items-center gap-[8px] px-[16px] py-[9px] text-[13px] font-bold text-white rounded-[10px] hover:-translate-y-[1px] hover:shadow-[0_10px_22px_-8px_rgba(var(--color-primary-rgb),0.55)] transition-all shadow-sm"
                style={{ background: 'linear-gradient(135deg, var(--color-primary), var(--color-primary))' }}
              >
                <Plus size={15} />
                Add Contact
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Pipeline Columns View */}
      <div className="flex-1 px-6 pt-6 overflow-x-auto overflow-y-hidden custom-scrollbar-sleek">
        {isLoading ? (
          <LoadingSpinner />
        ) : (
          <div className="flex gap-5 h-full pb-6">
            {stages.filter(stage => selectedPipelines.includes(stage.id)).map((stage) => (
              <StageColumn
                key={stage.id}
                stage={stage}
                availableTags={availableTags}
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDragStart={handleDragStart}
                onTagClick={(contact) => {
                  setContactForTag(contact);
                  setShowTagModal(true);
                }}
                onContactClick={(contact) => {
                  setSelectedContact(contact);
                }}
                isDraggingOver={draggingOverStage === stage.id}
              />
            ))}
          </div>
        )}
      </div>

      {/* Modals */}
      {showCreateModal && (
        <CreateContactModal
          onClose={() => setShowCreateModal(false)}
          onSuccess={fetchContacts}
          stages={allStages}
        />
      )}

      {selectedContact && (
        <ContactDetailsModal
          contact={selectedContact}
          onClose={() => setSelectedContact(null)}
          onStatusChange={handleStatusChange}
          stages={allStages}
        />
      )}

      {showTagModal && contactForTag && (
        <AddTagModal
          contact={contactForTag}
          availableTags={availableTags}
          onClose={() => {
            setShowTagModal(false);
            setContactForTag(null);
          }}
          onSave={handleUpdateTags}
        />
      )}
    </div>
  );
}
