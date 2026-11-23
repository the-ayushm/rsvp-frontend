// /* eslint-disable @typescript-eslint/no-unused-vars */
// "use client";

// import { useState } from "react";
// import { 
//     Pencil, PlusCircle, Info, Settings, Zap, 
//     Webhook, BookOpen, Loader2,
//     CheckSquare, Square, Save, XCircle, CheckCircle, Bell // Added icons for Event Catalog and Notifications
// } from "lucide-react";
// import { soft7AxiosInstance } from "@/lib/axiosInstance";

// interface Notification {
//     message: string;
//     type: 'error' | 'success';
// }

// /**
//  * Custom Notification Toast Component
//  */
// const NotificationToast = ({ notification }: { notification: Notification | null }) => {
//     if (!notification) return null;

//     return (
//         <div 
//             className={`fixed top-4 right-4 p-4 rounded-xl shadow-2xl flex items-center space-x-3 z-50 transition-all duration-300 
//                 ${notification.type === 'success' ? 'bg-[#ecfdf3] border-[#abefc6] text-[#067647]' : 'bg-[#fff1ef] border-[#fecdca] text-[#b42318]'}
//             `}
//             role="alert"
//         >
//             {notification.type === 'success' ? <CheckCircle className="w-5 h-5" /> : <XCircle className="w-5 h-5" />}
//             <p className="text-sm font-medium">{notification.message}</p>
//         </div>
//     );
// };


// /**
//  * --- Start of Endpoints Tab Component ---
//  * This component handles the Webhook Endpoint Configuration view.
//  */
// const EndpointsTab = ({ onNavigateToCatalog }: { onNavigateToCatalog: () => void }) => {
//     // Mock data for a realistic look
//     const [endpointUrl, setEndpointUrl] = useState("https://your-server.com/webhooks/whatsapp-handler");
//     const subscribedEventCount = 3; // Mocking a count > 0
//     const isActive = true; // Mock status
//     const [loading, setLoading] = useState(false); // To demonstrate future loading states

//     // Mock function for editing the endpoint (placeholder for a future modal)
//     const handleEditClick = () => {
//         // In a real app, this would open a modal to change the URL
//         console.log("Edit Endpoint clicked. This action typically opens a modal.");
//     };
    
//     return (
//         <div className="p-8 pt-0">
//             {/* Main Content */}
//             <h1 className="text-3xl font-extrabold text-[#101828] flex items-center mb-2">
//                 <Settings className="w-7 h-7 mr-3 text-[#e4663f]" /> Endpoint Configuration
//             </h1>
//             <p className="text-[#667085] mb-8">
//                 Manage your single webhook endpoint and configure the events you are subscribed to.
//             </p>

//             {/* Webhook Endpoint Info Card */}
//             <div className="
//   bg-[#fffdf9] dark:bg-[#2b2621]
//   border border-[#ddd3c7] dark:border-[#51483f]
//   rounded-2xl p-6 mb-10 shadow-lg
// ">

//                 <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 border-b pb-4">
//                     <h2 className="text-xl font-bold text-[#344054] flex items-center gap-2">
//                         <Zap className="w-5 h-5 text-[#e4663f]" /> Current Endpoint
//                     </h2>
//                     <div className="flex items-center gap-3 mt-3 sm:mt-0">
//                         {/* Status Badge */}
//                         <span 
//                             className={`px-3 py-1 text-xs font-semibold rounded-full ${
//                                 isActive ? 'bg-[#ecfdf3] text-[#067647]' : 'bg-[#fff1ef] text-[#b42318]'
//                             }`}
//                         >
//                             {isActive ? 'Active' : 'Inactive'}
//                         </span>
                        
//                         {/* Edit Button */}
//                         <button 
//                             onClick={handleEditClick}
//                             className="flex items-center gap-1 text-sm text-[#e4663f] font-medium hover:text-[#d95731] transition"
//                         >
//                             <Pencil className="w-4 h-4" /> Edit URL
//                         </button>
//                     </div>
//                 </div>

//                 <div>
//                     <label className="block text-[#344054] font-semibold mb-2">Endpoint URL</label>
//                     <div className="relative">
//                         <input
//                             type="url"
//                             value={endpointUrl}
//                             className="w-full border border-[#cfc5b8] rounded-xl px-5 py-3 text-[#344054] bg-[#f7f1e8] font-mono text-sm pr-12"
//                             readOnly
//                         />
//                         <span
//                             className="absolute right-4 top-1/2 -translate-y-1/2"
//                             title="This is the URL where all your subscribed events will be delivered via HTTP POST."
//                         >
//                             <Info className="w-4 h-4 text-[#98a2b3] cursor-help" />
//                         </span>
//                     </div>
//                     <p className="text-xs text-[#667085] mt-1">This endpoint receives all events for your account. Click &apos;Edit URL&apos; to change it.</p>
//                 </div>
//             </div>

//             {/* Subscribed Events Section */}
//             <div className="
//   mb-10 p-6
//   bg-[#fffdf9] dark:bg-[#2b2621]
//   border border-[#ead7c8] dark:border-[#51483f]
//   rounded-2xl
// ">

// <h2 className="text-xl font-bold text-[#344054] dark:text-[#fff8ef] mb-4 flex items-center gap-2">
//   Subscribed Events ({subscribedEventCount})
// </h2>

                
//                 {subscribedEventCount > 0 ? (
//                <div className="
//                text-[#344054] dark:text-[#c4cbd3]
//                text-sm p-4
//                bg-[#f7f1e8] dark:bg-[#211d19]
//              ">
             
                
//                         You are currently subscribed to <span className="font-bold text-[#e4663f]">{subscribedEventCount}</span> different event types. Notifications for these events will be sent to your configured endpoint URL.
//                     </div>
//                 ) : (
//                     <div className="
//                     border border-[#cfc5b8] dark:border-[#51483f]
//                     rounded-xl p-6 text-center
//                     text-[#667085] dark:text-[#98a2b3]
//                     bg-transparent
//                   ">
                  
//                         No events subscribed. Click &quot;Configure Events&quot; below to start receiving notifications.
//                     </div>
//                 )}
//             </div>

//             {/* Actions and Tip */}
//             <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6">
//                 {/* Configure Button - uses prop for navigation */}
//                 <button 
//                     onClick={onNavigateToCatalog}
//                     disabled={loading}
//                     className="flex items-center gap-2 bg-[#e4663f] text-white text-white px-6 py-3 rounded-xl font-semibold text-lg shadow-xl hover:bg-[#d95731] transition-all transform hover:scale-[1.01] shadow-[#e4663f]/25 w-full sm:w-auto disabled:opacity-50"
//                 >
//                     <PlusCircle className="w-5 h-5" /> Configure Events
//                 </button>

//                 {/* Tip */}
//                 <div className="
//   flex items-start gap-3
//   text-[#475467] dark:text-[#c4cbd3]
//   text-sm max-w-sm p-3
//   bg-[#fffdf9] dark:bg-[#2b2621]
//   border border-[#f2dfb5] dark:border-[#51483f]
//   rounded-xl
// ">


// <Info className="w-5 h-5 mt-0.5 text-[#b54708] dark:text-yellow-400 flex-shrink-0" />

//                     <p>
//                         💡 Tip: Check out the 
//                         <span 
//                             onClick={onNavigateToCatalog}
//                             className="text-[#e4663f] font-medium underline cursor-pointer hover:text-[#d95731] transition ml-1"
//                         >
//                             Event Catalog
//                         </span> 
//                         to see all available events you can subscribe to.
//                     </p>
//                 </div>
//             </div>
//         </div>
//     );
// }
// /**
//  * --- End of Endpoints Tab Component ---
//  */


// /**
//  * --- Start of Event Catalog Tab Component (FULL IMPLEMENTATION) ---
//  */
// const EventCatalogTab = () => {
//     const [selectedEvents, setSelectedEvents] = useState<string[]>([]);
//     const [loading, setLoading] = useState(false);
//     const [notification, setNotification] = useState<Notification | null>(null);

//     // Function to show transient notifications
//     const showNotification = (message: string, type: 'error' | 'success') => {
//         setNotification({ message, type });
//         setTimeout(() => setNotification(null), 3000);
//     };

//     const allEvents = [
//         {
//             id: "messages",
//             name: "messages",
//             description: "Receive events when messages occur (incoming, outbound, status updates).",
//             category: "whatsapp",
//         },
//         {
//             id: "status_updates",
//             name: "status_updates",
//             description: "Receive events for template and message status changes.",
//             category: "whatsapp",
//         },
//         {
//             id: "contacts",
//             name: "contacts",
//             description: "Receive events when contact information changes.",
//             category: "whatsapp",
//         },
//         // Added more events for a realistic feel
//     ];

//     const toggleSelectAll = () => {
//         if (selectedEvents.length === allEvents.length) {
//             setSelectedEvents([]);
//         } else {
//             setSelectedEvents(allEvents.map((e) => e.id));
//         }
//     };

//     const toggleEvent = (id: string) => {
//         setSelectedEvents((prev) =>
//             prev.includes(id) ? prev.filter((e) => e !== id) : [...prev, id]
//         );
//     };

//     const handleSave = async () => {
//         setLoading(true);
//         try {
//             // Mock API Call
//             await soft7AxiosInstance.post("/api/webhooks/subscribe", { subscribedEvents: selectedEvents });

//             showNotification("Webhook subscription updated successfully!", 'success');
//         } catch (error) {
//             console.error(error);
//             showNotification("Network error. Could not save subscription.", 'error');
//         } finally {
//             setLoading(false);
//         }
//     };

//     return (
//         <div className="p-8 pt-0">
//             <NotificationToast notification={notification} />

//             <h1 className="text-3xl font-extrabold text-[#101828] mb-2 flex items-center">
//                 <BookOpen className="w-7 h-7 mr-3 text-[#e4663f]" /> Event Catalog
//             </h1>
//             <p className="text-[#667085] mb-8">
//                 Subscribe to webhook events by selecting the notifications you wish to receive at your registered endpoint.
//             </p>

//             {/* Category Grouping */}
//             <div className="mb-6">
//                 <h2 className="text-xl font-bold text-[#e4663f] mb-4 flex items-center">
//                     <span className="bg-[#fff1e8] text-[#d95731] px-3 py-1 rounded-full text-sm">WhatsApp</span> Events
//                 </h2>
//             </div>

//             {/* Select All */}
//             <div className="p-4 bg-[#fffdf9] dark:bg-[#2b2621] border border-[#ddd3c7] dark:border-[#51483f] rounded-xl mb-6">

//                 <div
//                     onClick={toggleSelectAll}
//                     className="flex items-center gap-3 cursor-pointer select-none"
//                 >
//                     {selectedEvents.length === allEvents.length ? (
//                         <CheckSquare className="w-6 h-6 text-[#e4663f] flex-shrink-0" />
//                     ) : (
//                         <Square className="w-6 h-6 text-[#e99a7c] flex-shrink-0" />
//                     )}
//                     <span className="text-[#344054] font-bold text-lg">Select All Events</span>
//                     <span className="text-[#e4663f] text-sm ml-auto">{selectedEvents.length} of {allEvents.length} Selected</span>
//                 </div>
//             </div>


//             {/* Event List */}
//             <div className="space-y-3">
//                 {allEvents.map((event) => {
//                     const isSelected = selectedEvents.includes(event.id);
//                     return (
//                         <div
//                             key={event.id}
//                             onClick={() => toggleEvent(event.id)}
//                             className={`border rounded-xl p-4 flex items-start gap-4 cursor-pointer shadow-sm
//                                 ${
//                                   isSelected
//                                     ? "border-[#e4663f] bg-[#fffdf9] dark:bg-[#2b2621]"
//                                     : "border-[#ddd3c7] bg-[#fffdf9] dark:bg-[#2b2621]"
//                                 }`}
                              
//                         >
//                             {isSelected ? (
//                                 <CheckSquare className="w-5 h-5 text-[#e4663f] mt-1 flex-shrink-0" />
//                             ) : (
//                                 <Square className="w-5 h-5 text-[#98a2b3] mt-1 flex-shrink-0" />
//                             )}
//                             <div>
//                                 <h3 className="font-semibold text-[#101828] capitalize">{event.name.replace('_', ' ')}</h3>
//                                 <p className="text-[#667085] text-sm">{event.description}</p>
//                             </div>
//                         </div>
//                     );
//                 })}
//             </div>

//             {/* Save Button */}
//             <div className="mt-10 flex justify-end">
//                 <button
//                     onClick={handleSave}
//                     disabled={loading}
//                     className="flex items-center gap-2 bg-[#e4663f] text-white text-white px-8 py-3 rounded-xl font-semibold text-lg shadow-xl hover:bg-[#d95731] transition-all transform hover:scale-[1.01] disabled:opacity-50 disabled:cursor-not-allowed shadow-[#e4663f]/25"
//                 >
//                     {loading ? (
//                         <>
//                             <Loader2 className="w-5 h-5 animate-spin" /> Saving...
//                         </>
//                     ) : (
//                         <>
//                             <Save className="w-5 h-5" /> Save Subscription
//                         </>
//                     )}
//                 </button>
//             </div>
//         </div>
//     );
// }
// /**
//  * --- End of Event Catalog Tab Component (FULL IMPLEMENTATION) ---
//  */


// /**
//  * --- Main Webhooks Dashboard Component ---
//  */
// export default function WebhooksPage() {
//     const [activeTab, setActiveTab] = useState('endpoints');

//     const tabs = [
//         { id: "endpoints", name: "Endpoints", icon: Webhook, component: EndpointsTab },
//         { id: "catalog", name: "Event Catalog", icon: BookOpen, component: EventCatalogTab },
//     ];

//     // Function to handle navigation to the catalog tab (used by EndpointsTab component)
//     const handleNavigateToCatalog = () => {
//         setActiveTab('catalog');
//     }

//     // Determine which component to render
//     const ActiveComponent = tabs.find(t => t.id === activeTab)?.component;

//     return (
//         <div className="min-h-screen bg-[#fbf6ee] dark:bg-[#211d19] p-4 sm:p-6 md:p-10">

// <div className="
//   max-w-6xl mx-auto
//  bg-[#fffdf9] dark:bg-[#2b2621]
//   rounded-3xl shadow-2xl
//   border border-[#ddd3c7] dark:border-[#51483f]
// ">

                
//                 {/* Global Header */}
//                 <div className="px-6 py-6 border-b border-[#ddd3c7] sm:px-8">
//                 <h1 className="text-3xl font-extrabold text-[#101828] dark:text-[#fff8ef]">Webhooks Dashboard</h1>
//                 <p className="text-[#667085] dark:text-[#98a2b3] text-sm mt-1">

//                         Configure and manage your webhook endpoints and event subscriptions for real-time notifications.
//                     </p>
//                 </div>

//                 {/* Tabs Navigation */}
//                 <div className="flex border-b border-[#ddd3c7] px-6 sm:px-8">
//                     {tabs.map(({ id, name, icon: Icon }) => (
//                         <button
//                             key={id}
//                             onClick={() => setActiveTab(id)}
//                             className={`flex items-center gap-2 px-6 py-3 text-sm font-semibold -mb-px border-b-2 transition-all duration-200 
//                                 ${
//                                     activeTab === id
//                                         ? "border-[#e4663f] text-[#e4663f] bg-[#fff1e8] dark:bg-[#302a24]"

//                                         : "border-transparent text-[#475467] hover:text-[#e4663f] hover:border-[#cfc5b8]"
//                                 }`}
//                         >
//                             <Icon className="w-4 h-4" /> {name}
//                         </button>
//                     ))}
//                 </div>

//                 {/* Tab Content Area */}
//                 <div className="p-0">
//                     {ActiveComponent && (
//                         // Render the active component, passing the navigation handler if needed
//                         <ActiveComponent 
//                             onNavigateToCatalog={activeTab === 'endpoints' ? handleNavigateToCatalog : () => {}} 
//                         />
//                     )}
//                 </div>
//             </div>
//         </div>
//     );
// }

import { notFound } from "next/navigation";

// Webhooks UI is hidden until re-enabled; the original implementation is kept above.
export default function WebhooksPage() {
  notFound();
}
