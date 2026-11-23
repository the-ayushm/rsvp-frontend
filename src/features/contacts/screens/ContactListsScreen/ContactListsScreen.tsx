/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, RefreshCcw, X, Users, Calendar, Trash2, Eye, FileText, ChevronLeft, ChevronRight } from 'lucide-react';
import toast from 'react-hot-toast';
import { soft7AxiosInstance } from "@/lib/axiosInstance";
import { formatListCount, getContactListStats, type ContactList } from '../../utils/contact-list-stats';
import ContactListDetails from './ContactListDetails';

export default function ContactListsPage() {
  const router = useRouter();
  const [lists, setLists] = useState<ContactList[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedList, setSelectedList] = useState<ContactList | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isDeleting, setIsDeleting] = useState(false);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  // Detect mobile screen
  useEffect(() => {
    const checkMobile = () => {
      if (window.innerWidth < 768) {
        setItemsPerPage(5);
      } else {
        setItemsPerPage(10);
      }
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const fetchContactLists = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await soft7AxiosInstance.get('/admin/contacts/lists');
      const result = response.data;
      
      let listsData: ContactList[] = [];
      if (result.success && result.data && Array.isArray(result.data)) {
        listsData = result.data;
      } else if (Array.isArray(result)) {
        listsData = result;
      } else if (result.lists && Array.isArray(result.lists)) {
        listsData = result.lists;
      } else {
        listsData = [];
      }
      
      setLists(listsData);
      setSelectedIds([]);
      setCurrentPage(1);
      
      if (listsData.length === 0) {
        toast('No contact lists found', { icon: '📋' });
      } else {
        const totalContacts = listsData.reduce((sum, list) => sum + (getContactListStats(list).total ?? 0), 0);
        toast.success(`Found ${listsData.length} list${listsData.length !== 1 ? 's' : ''} with ${totalContacts} total contacts`);
      }
    } catch (error: any) {
      console.error('Failed to fetch contact lists:', error);
      if (error.response?.status === 401) {
        toast.error('Session expired. Please login again.');
        setError('Session expired. Please refresh the page and login again.');
      } else {
        setError(error.message || 'Failed to load contact lists');
        toast.error('Failed to load contact lists');
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchContactLists();
  }, []);

  // Delete list function
  const deleteList = async (listId: string) => {
    try {
      await soft7AxiosInstance.delete(`/admin/contacts/lists/${listId}`);
      return true;
    } catch (error: any) {
      console.error('Failed to delete list:', error);
      if (error.response?.status === 401) {
        toast.error('Session expired. Please login again.');
      } else {
        toast.error('Failed to delete list');
      }
      return false;
    }
  };

  // Handle single delete
  const handleDeleteList = async (listId: string, listName: string) => {
    if (window.confirm(`Are you sure you want to delete "${listName}"?`)) {
      setIsDeleting(true);
      const success = await deleteList(listId);
      if (success) {
        toast.success(`List "${listName}" deleted successfully!`);
        await fetchContactLists();
      }
      setIsDeleting(false);
    }
  };

  // Handle bulk delete
  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) {
      toast.error('Please select at least one list to delete');
      return;
    }

    if (window.confirm(`Are you sure you want to delete ${selectedIds.length} selected list${selectedIds.length !== 1 ? 's' : ''}?`)) {
      setIsDeleting(true);
      let successCount = 0;
      let failCount = 0;

      for (const listId of selectedIds) {
        const success = await deleteList(listId);
        if (success) {
          successCount++;
        } else {
          failCount++;
        }
      }

      if (successCount > 0) {
        toast.success(`Deleted ${successCount} list${successCount !== 1 ? 's' : ''} successfully!`);
      }
      if (failCount > 0) {
        toast.error(`Failed to delete ${failCount} list${failCount !== 1 ? 's' : ''}`);
      }

      await fetchContactLists();
      setSelectedIds([]);
      setIsDeleting(false);
    }
  };

  // Select all / deselect all
  const toggleSelectAll = () => {
    if (selectedIds.length === paginatedLists.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(paginatedLists.map(list => list.id));
    }
  };

  // Toggle single selection
  const toggleSelect = (listId: string) => {
    if (selectedIds.includes(listId)) {
      setSelectedIds(selectedIds.filter(id => id !== listId));
    } else {
      setSelectedIds([...selectedIds, listId]);
    }
  };

  const formatDate = (dateString?: string | null) => {
    if (!dateString) return 'N/A';
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return 'Invalid Date';
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return 'Invalid Date';
    }
  };

  // Pagination calculations
  const totalPages = Math.ceil(lists.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedLists = lists.slice(startIndex, endIndex);

  const goToPage = (page: number) => {
    setCurrentPage(Math.max(1, Math.min(page, totalPages)));
  };

  const viewListDetails = (list: ContactList) => {
    setSelectedList(list);
  };

  const closeDetailsModal = () => {
    setSelectedList(null);
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="p-4 sm:p-6 md:p-8 max-w-7xl mx-auto space-y-6">
        
        {/* Header Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.back()}
              className="w-9 h-9 rounded-lg border border-border bg-card hover:bg-muted flex items-center justify-center transition text-muted-foreground hover:text-foreground"
              title="Go back"
            >
              <ArrowLeft size={18} />
            </button>
            <div>
              <h1 className="text-xl md:text-2xl font-bold tracking-tight text-foreground">
                Contact Lists
              </h1>
              <p className="text-xs text-muted-foreground">
                Manage and view all your imported contact lists
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            {selectedIds.length > 0 && (
              <button
                onClick={handleBulkDelete}
                disabled={isDeleting}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-destructive hover:bg-destructive/10 border border-destructive/30 rounded-lg transition h-8 disabled:opacity-50"
              >
                <Trash2 size={14} />
                <span>Delete Selected ({selectedIds.length})</span>
              </button>
            )}
            <button
              onClick={fetchContactLists}
              disabled={isLoading}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-foreground bg-card hover:bg-muted border border-border rounded-lg transition h-8 disabled:opacity-50"
            >
              <RefreshCcw size={14} className={isLoading ? 'animate-spin' : ''} />
              <span>{isLoading ? 'Refreshing...' : 'Refresh'}</span>
            </button>
          </div>
        </div>

        {/* Stats Summary */}
        {!isLoading && !error && lists.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-card rounded-xl p-4 border border-border shadow-xs flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Total Lists</p>
                <p className="text-2xl font-bold text-foreground mt-1">{lists.length}</p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                <FileText size={20} />
              </div>
            </div>
            
            <div className="bg-card rounded-xl p-4 border border-border shadow-xs flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Total Contacts</p>
                <p className="text-2xl font-bold text-foreground mt-1">
                  {lists.reduce((sum, list) => sum + (getContactListStats(list).total ?? 0), 0).toLocaleString()}
                </p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-accent/10 text-accent flex items-center justify-center">
                <Users size={20} />
              </div>
            </div>

            <div className="bg-card rounded-xl p-4 border border-border shadow-xs flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Files Processed</p>
                <p className="text-2xl font-bold text-foreground mt-1">{lists.length}</p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-primary/10 text-[var(--color-primary)] flex items-center justify-center">
                <Calendar size={20} />
              </div>
            </div>
          </div>
        )}

        {/* Main Table Container */}
        <div className="bg-card rounded-xl border border-border shadow-xs overflow-hidden">
          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-3"></div>
                <p className="text-xs text-muted-foreground">Loading contact lists...</p>
              </div>
            </div>
          ) : error ? (
            <div className="flex items-center justify-center py-16 px-4 text-center">
              <div>
                <div className="w-10 h-10 bg-destructive/10 text-destructive rounded-full flex items-center justify-center mx-auto mb-3">
                  <X size={20} />
                </div>
                <p className="text-destructive font-medium text-sm mb-1">{error}</p>
                <p className="text-xs text-muted-foreground mb-4">Please check your connection and try again</p>
                <button
                  onClick={fetchContactLists}
                  className="px-3.5 py-1.5 bg-primary text-primary-foreground text-xs font-semibold rounded-lg hover:opacity-90 transition"
                >
                  Try Again
                </button>
              </div>
            </div>
          ) : lists.length === 0 ? (
            <div className="flex items-center justify-center py-16 px-4 text-center">
              <div>
                <FileText size={36} className="text-muted-foreground/40 mx-auto mb-3" />
                <p className="text-foreground font-semibold text-base">No contact lists found</p>
                <p className="text-xs text-muted-foreground mt-1 mb-4">Import contacts to automatically generate list records</p>
                <button
                  onClick={() => router.push('/user/contacts')}
                  className="px-4 py-2 bg-primary text-primary-foreground text-xs font-semibold rounded-lg hover:opacity-90 transition"
                >
                  Go to Contacts
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Desktop Table View */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-xs text-left" aria-label="Contact lists">
                  <thead className="border-b border-border bg-muted/70 uppercase text-[11px] text-muted-foreground tracking-wider font-semibold">
                    <tr>
                      <th className="w-10 px-3.5 py-3 text-center">
                        <input
                          type="checkbox"
                          checked={selectedIds.length === paginatedLists.length && paginatedLists.length > 0}
                          onChange={toggleSelectAll}
                          className="w-3.5 h-3.5 accent-primary rounded cursor-pointer"
                        />
                      </th>
                      <th className="px-3.5 py-3">S.No</th>
                      <th className="px-3.5 py-3">List Name</th>
                      <th className="px-3.5 py-3">Created At</th>
                      <th className="px-3.5 py-3">Total Contacts</th>
                      <th className="px-3.5 py-3">File Name</th>
                      <th className="px-3.5 py-3 text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {paginatedLists.map((list, index) => {
                      const stats = getContactListStats(list);
                      const globalIndex = startIndex + index + 1;
                      const isSelected = selectedIds.includes(list.id);
                      
                      return (
                        <tr key={list.id} className={`hover:bg-muted/40 transition-colors ${isSelected ? 'bg-accent/5' : ''}`}>
                          <td className="w-10 px-3.5 py-3 text-center">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleSelect(list.id)}
                              className="w-3.5 h-3.5 accent-primary rounded cursor-pointer"
                            />
                          </td>
                          <td className="px-3.5 py-3 text-muted-foreground font-mono">
                            {globalIndex}
                          </td>
                          <td className="px-3.5 py-3 font-semibold text-foreground">
                            {list.name}
                          </td>
                          <td className="px-3.5 py-3 text-muted-foreground whitespace-nowrap">
                            {formatDate(list.created_at)}
                          </td>
                          <td className="px-3.5 py-3 whitespace-nowrap">
                            <span className="px-2.5 py-0.5 bg-muted border border-border text-foreground rounded-md text-[11px] font-medium">
                              {formatListCount(stats.total)} {stats.total === 1 ? 'contact' : 'contacts'}
                            </span>
                          </td>
                          <td className="px-3.5 py-3 text-muted-foreground max-w-[200px] truncate font-mono">
                            {list.file_name || '—'}
                          </td>
                          <td className="px-3.5 py-3 whitespace-nowrap">
                            <div className="flex items-center justify-center gap-1.5">
                              <button
                                onClick={() => viewListDetails(list)}
                                className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition"
                                title="View Details"
                                aria-label={`View details for ${list.name}`}
                              >
                                <Eye size={14} />
                              </button>
                              <button
                                onClick={() => handleDeleteList(list.id, list.name)}
                                disabled={isDeleting}
                                className="p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition disabled:opacity-50"
                                title="Delete List"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Mobile Card View */}
              <div className="md:hidden divide-y divide-border">
                {paginatedLists.map((list, index) => {
                  const stats = getContactListStats(list);
                  const globalIndex = startIndex + index + 1;
                  const isSelected = selectedIds.includes(list.id);
                  
                  return (
                    <div key={list.id} className={`p-4 ${isSelected ? 'bg-accent/5' : ''}`}>
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleSelect(list.id)}
                            className="w-3.5 h-3.5 accent-primary rounded cursor-pointer"
                          />
                          <span className="text-xs text-muted-foreground font-mono">#{globalIndex}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => viewListDetails(list)}
                            aria-label={`View details for ${list.name}`}
                            className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition"
                          >
                            <Eye size={14} />
                          </button>
                          <button
                            onClick={() => handleDeleteList(list.id, list.name)}
                            disabled={isDeleting}
                            className="p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition disabled:opacity-50"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                      <div className="space-y-1">
                        <p className="font-semibold text-sm text-foreground">{list.name}</p>
                        <p className="text-xs text-muted-foreground">Created: {formatDate(list.created_at)}</p>
                        <div className="flex justify-between items-center pt-2">
                          <span className="px-2 py-0.5 bg-muted border border-border text-foreground rounded text-[10px] font-medium">
                            {formatListCount(stats.total)} contacts
                          </span>
                          <span className="text-[11px] text-muted-foreground font-mono truncate max-w-[140px]">
                            {list.file_name || 'N/A'}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="px-4 py-3 border-t border-border bg-muted/30 flex items-center justify-between text-xs">
                  <div className="text-muted-foreground">
                    Showing {startIndex + 1}–{Math.min(endIndex, lists.length)} of {lists.length} lists
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => goToPage(currentPage - 1)}
                      disabled={currentPage === 1}
                      className="p-1.5 rounded-md border border-border hover:bg-muted disabled:opacity-40 transition"
                    >
                      <ChevronLeft size={14} />
                    </button>
                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                      let pageNum;
                      if (totalPages <= 5) pageNum = i + 1;
                      else if (currentPage <= 3) pageNum = i + 1;
                      else if (currentPage >= totalPages - 2) pageNum = totalPages - 4 + i;
                      else pageNum = currentPage - 2 + i;
                      
                      return (
                        <button
                          key={pageNum}
                          onClick={() => goToPage(pageNum)}
                          className={`w-7 h-7 rounded-md font-medium text-xs transition ${
                            currentPage === pageNum
                              ? 'bg-primary text-primary-foreground font-semibold shadow-xs'
                              : 'border border-border hover:bg-muted text-foreground'
                          }`}
                        >
                          {pageNum}
                        </button>
                      );
                    })}
                    <button
                      onClick={() => goToPage(currentPage + 1)}
                      disabled={currentPage === totalPages}
                      className="p-1.5 rounded-md border border-border hover:bg-muted disabled:opacity-40 transition"
                    >
                      <ChevronRight size={14} />
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* List Details Modal */}
      {selectedList && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[60] p-4 backdrop-blur-sm" onClick={closeDetailsModal}>
          <div role="dialog" aria-modal="true" aria-labelledby="list-details-title" className="bg-surface rounded-[16px] w-full max-w-2xl shadow-[0_30px_70px_-22px_rgba(var(--color-primary-rgb),0.3)] overflow-hidden flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>
            <div 
              className="px-[24px] py-[18px] flex items-center justify-between text-white shrink-0"
              style={{ background: 'linear-gradient(135deg, var(--color-primary) 0%, var(--color-primary) 100%)' }}
            >
              <h3 id="list-details-title" className="text-base font-semibold tracking-tight">List Details</h3>
              <button
                onClick={closeDetailsModal}
                aria-label="Close list details"
                className="w-7 h-7 rounded-full text-white flex items-center justify-center hover:opacity-80 transition"
                style={{ backgroundColor: 'color-mix(in oklab, var(--color-primary-foreground) 16%, transparent)' }}
              >
                <X size={14} />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto space-y-4 text-xs">
              <ContactListDetails list={selectedList} formatDate={formatDate} />
            </div>

            <div className="px-6 py-3 border-t border-border bg-surface-muted flex justify-end shrink-0">
              <button
                onClick={closeDetailsModal}
                className="px-4 py-1.5 text-xs font-semibold text-white rounded-lg transition shadow-xs hover:brightness-105"
                style={{ background: 'linear-gradient(135deg, var(--color-primary), var(--color-primary))' }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
