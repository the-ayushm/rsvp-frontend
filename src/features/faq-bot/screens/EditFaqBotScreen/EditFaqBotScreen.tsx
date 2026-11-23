/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { ArrowLeft, Save, Loader2, Plus, X, Image, Video, FileText, MousePointer } from 'lucide-react';
import { useState } from 'react';

interface FaqEntry {
  id: string;
  intent: string;
  questions: string[];
  answerType: 'text' | 'image' | 'video' | 'document' | 'interactive';
  answerData: {
    text: string;
    imageUrl: string;
    imageCaption: string;
    videoUrl: string;
    videoCaption: string;
    documentUrl: string;
    documentCaption: string;
    documentFilename: string;
    interactiveType: string;
  };
}

export default function EditFaqBotPage() {
  const [loading] = useState(false);
  const [saving, setSaving] = useState(false);
  
  const [faqEntries, setFaqEntries] = useState<FaqEntry[]>([
    {
      id: '1',
      intent: 'Product Information',
      questions: ['pricing', 'cost', 'how much'],
      answerType: 'text',
      answerData: {
        text: 'Our pricing starts at $29/month for the basic plan.',
        imageUrl: '',
        imageCaption: '',
        videoUrl: '',
        videoCaption: '',
        documentUrl: '',
        documentCaption: '',
        documentFilename: '',
        interactiveType: '',
      }
    }
  ]);

  const [questionInputs, setQuestionInputs] = useState<{ [key: string]: string }>({});

  const handleAddFaqEntry = () => {
    const newEntry: FaqEntry = {
      id: Date.now().toString(),
      intent: '',
      questions: [],
      answerType: 'text',
      answerData: {
        text: '',
        imageUrl: '',
        imageCaption: '',
        videoUrl: '',
        videoCaption: '',
        documentUrl: '',
        documentCaption: '',
        documentFilename: '',
        interactiveType: '',
      }
    };
    setFaqEntries([...faqEntries, newEntry]);
  };

  const handleRemoveEntry = (id: string) => {
    const confirmDelete = confirm("Are you sure you want to delete this FAQ entry?");
    if (!confirmDelete) return;
    setFaqEntries(faqEntries.filter(entry => entry.id !== id));
  };

  const updateEntry = (id: string, updates: Partial<FaqEntry>) => {
    setFaqEntries(faqEntries.map(entry => 
      entry.id === id ? { ...entry, ...updates } : entry
    ));
  };

  const addQuestion = (entryId: string) => {
    const input = questionInputs[entryId]?.trim();
    if (!input) return;
    
    const entry = faqEntries.find(e => e.id === entryId);
    if (entry) {
      updateEntry(entryId, {
        questions: [...entry.questions, input]
      });
      setQuestionInputs({ ...questionInputs, [entryId]: '' });
    }
  };

  const removeQuestion = (entryId: string, question: string) => {
    const entry = faqEntries.find(e => e.id === entryId);
    if (entry) {
      updateEntry(entryId, {
        questions: entry.questions.filter(q => q !== question)
      });
    }
  };

  const saveChanges = () => {
    setSaving(true);
    // Replace with actual API call
    console.log("Saving FAQ entries:", faqEntries);
    setTimeout(() => setSaving(false), 1500);
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-gradient-to-br from-primary-lighter to-primary-light">
        <Loader2 className="animate-spin text-primary-text" size={40} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-lighter via-primary-lighter to-primary-lighter">
      {/* Header */}
      <div className="bg-surface border-b border-primary-soft shadow-sm">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => window.history.back()}
              className="p-2 rounded-lg hover:bg-primary-lighter text-primary-text transition-colors"
            >
              <ArrowLeft size={20} />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Edit FAQ Bot</h1>
              <p className="text-sm text-muted-foreground mt-0.5">Manage your chatbot FAQ responses</p>
            </div>
          </div>
          
          <button
            onClick={saveChanges}
            disabled={saving}
            className="flex items-center gap-2 bg-primary hover:bg-primary-hover text-primary-foreground px-6 py-2.5 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
          >
            {saving ? (
              <>
                <Loader2 className="animate-spin" size={18} />
                Saving...
              </>
            ) : (
              <>
                <Save size={18} />
                Save Changes
              </>
            )}
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-6xl mx-auto px-6 py-8">
        <div className="space-y-8">
          {faqEntries.map((entry, index) => (
            <div key={entry.id} className="space-y-6">
              {/* Entry Header */}
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-foreground">
                  FAQ Entry {index + 1}
                </h2>
              </div>

              {/* Intent Card */}
              <div className="bg-surface rounded-xl shadow-sm border border-primary-soft p-6">
                <label className="block text-sm font-semibold text-secondary-foreground mb-2">
                  Intent Name
                </label>
                <input
                  value={entry.intent}
                  onChange={(e) => updateEntry(entry.id, { intent: e.target.value })}
                  className="w-full px-4 py-3 rounded-lg border border-primary-soft focus:border-primary focus:ring-2 focus:ring-primary-soft outline-none transition-all"
                  placeholder="e.g., greeting, help, pricing"
                />
                <p className="text-xs text-muted-foreground mt-2">The main category or purpose of this FAQ</p>
                {!entry.intent && (
                  <p className="text-xs text-error mt-1">Intent is required</p>
                )}
              </div>

              {/* Questions Card */}
              <div className="bg-surface rounded-xl shadow-sm border border-primary-soft p-6">
                <label className="block text-sm font-semibold text-secondary-foreground mb-3">
                  Questions/Keywords
                </label>
                
                <div className="flex flex-wrap gap-2 mb-4">
                  {entry.questions.map((q) => (
                    <span
                      key={q}
                      className="inline-flex items-center gap-2 bg-primary-lighter text-primary-text px-3 py-1.5 rounded-full text-sm font-medium border border-primary-soft"
                    >
                      {q}
                      <button
                        onClick={() => removeQuestion(entry.id, q)}
                        className="hover:bg-[var(--color-primary-light)] rounded-full p-0.5 transition-colors"
                      >
                        <X size={14} />
                      </button>
                    </span>
                  ))}
                </div>

                <div className="flex gap-2">
                  <input
                    value={questionInputs[entry.id] || ''}
                    onChange={(e) => setQuestionInputs({ ...questionInputs, [entry.id]: e.target.value })}
                    onKeyPress={(e) => e.key === 'Enter' && addQuestion(entry.id)}
                    className="flex-1 px-4 py-2.5 border border-primary-soft rounded-lg focus:border-primary focus:ring-2 focus:ring-primary-soft outline-none transition-all"
                    placeholder="Add question/keyword"
                  />
                  <button
                    onClick={() => addQuestion(entry.id)}
                    className="bg-primary hover:bg-primary text-primary-foreground px-5 rounded-lg font-medium transition-colors flex items-center gap-2"
                  >
                    Add
                  </button>
                </div>
                <p className="text-xs text-muted-foreground mt-2">Add keywords that will trigger this FAQ response</p>
              </div>

              {/* Answer Type Card */}
              <div className="bg-surface rounded-xl shadow-sm border border-primary-soft p-6">
                <label className="block text-sm font-semibold text-secondary-foreground mb-4">
                  Answer Type
                </label>
                
                <div className="flex gap-3">
                  {[
                    { type: 'text', icon: FileText, label: 'Text' },
                    { type: 'image', icon: Image, label: 'Image' },
                    { type: 'video', icon: Video, label: 'Video' },
                    { type: 'document', icon: FileText, label: 'Document' },
                    { type: 'interactive', icon: MousePointer, label: 'Interactive' },
                  ].map(({ type, icon: Icon, label }) => (
                    <label key={type} className="flex-1">
                      <input
                        type="radio"
                        name={`answerType-${entry.id}`}
                        checked={entry.answerType === type}
                        onChange={() => updateEntry(entry.id, { answerType: type as any })}
                        className="sr-only"
                      />
                      <div className={`flex flex-col items-center gap-2 p-4 rounded-lg border-2 cursor-pointer transition-all ${
                        entry.answerType === type
                          ? 'border-primary bg-primary-lighter text-primary-text'
                          : 'border-border hover:border-primary-soft text-secondary-foreground hover:bg-primary-lighter/50'
                      }`}>
                        <Icon size={20} />
                        <span className="text-sm font-medium">{label}</span>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              {/* Answer Content Card */}
              <div className="bg-surface rounded-xl shadow-sm border border-primary-soft p-6">
                <label className="block text-sm font-semibold text-secondary-foreground mb-4">
                  Answer Text
                </label>

                {entry.answerType === 'text' && (
                  <textarea
                    rows={6}
                    value={entry.answerData.text}
                    onChange={(e) => updateEntry(entry.id, {
                      answerData: { ...entry.answerData, text: e.target.value }
                    })}
                    className="w-full px-4 py-3 border border-primary-soft rounded-lg focus:border-primary focus:ring-2 focus:ring-primary-soft outline-none transition-all resize-none"
                    placeholder="Enter your response text here..."
                  />
                )}

                {entry.answerType === 'image' && (
                  <div className="space-y-4">
                    <input
                      type="text"
                      placeholder="https://example.com/image.jpg"
                      className="w-full px-4 py-2.5 border border-primary-soft rounded-lg focus:border-primary focus:ring-2 focus:ring-primary-soft outline-none transition-all"
                      value={entry.answerData.imageUrl}
                      onChange={(e) => updateEntry(entry.id, {
                        answerData: { ...entry.answerData, imageUrl: e.target.value }
                      })}
                    />
                    <input
                      type="text"
                      placeholder="Image description or caption (optional)"
                      className="w-full px-4 py-2.5 border border-primary-soft rounded-lg focus:border-primary focus:ring-2 focus:ring-primary-soft outline-none transition-all"
                      value={entry.answerData.imageCaption}
                      onChange={(e) => updateEntry(entry.id, {
                        answerData: { ...entry.answerData, imageCaption: e.target.value }
                      })}
                    />
                  </div>
                )}

                {entry.answerType === 'video' && (
                  <div className="space-y-4">
                    <input
                      type="text"
                      placeholder="https://youtube.com/watch?v=..."
                      className="w-full px-4 py-2.5 border border-primary-soft rounded-lg focus:border-primary focus:ring-2 focus:ring-primary-soft outline-none transition-all"
                      value={entry.answerData.videoUrl}
                      onChange={(e) => updateEntry(entry.id, {
                        answerData: { ...entry.answerData, videoUrl: e.target.value }
                      })}
                    />
                    <input
                      type="text"
                      placeholder="Video description or caption (optional)"
                      className="w-full px-4 py-2.5 border border-primary-soft rounded-lg focus:border-primary focus:ring-2 focus:ring-primary-soft outline-none transition-all"
                      value={entry.answerData.videoCaption}
                      onChange={(e) => updateEntry(entry.id, {
                        answerData: { ...entry.answerData, videoCaption: e.target.value }
                      })}
                    />
                  </div>
                )}

                {entry.answerType === 'document' && (
                  <div className="space-y-4">
                    <input
                      type="text"
                      placeholder="https://example.com/document.pdf"
                      className="w-full px-4 py-2.5 border border-primary-soft rounded-lg focus:border-primary focus:ring-2 focus:ring-primary-soft outline-none transition-all"
                      value={entry.answerData.documentUrl}
                      onChange={(e) => updateEntry(entry.id, {
                        answerData: { ...entry.answerData, documentUrl: e.target.value }
                      })}
                    />
                    <input
                      type="text"
                      placeholder="document.pdf"
                      className="w-full px-4 py-2.5 border border-primary-soft rounded-lg focus:border-primary focus:ring-2 focus:ring-primary-soft outline-none transition-all"
                      value={entry.answerData.documentFilename}
                      onChange={(e) => updateEntry(entry.id, {
                        answerData: { ...entry.answerData, documentFilename: e.target.value }
                      })}
                    />
                    <input
                      type="text"
                      placeholder="Document description (optional)"
                      className="w-full px-4 py-2.5 border border-primary-soft rounded-lg focus:border-primary focus:ring-2 focus:ring-primary-soft outline-none transition-all"
                      value={entry.answerData.documentCaption}
                      onChange={(e) => updateEntry(entry.id, {
                        answerData: { ...entry.answerData, documentCaption: e.target.value }
                      })}
                    />
                  </div>
                )}

                {entry.answerType === 'interactive' && (
                  <select
                    value={entry.answerData.interactiveType}
                    onChange={(e) => updateEntry(entry.id, {
                      answerData: { ...entry.answerData, interactiveType: e.target.value }
                    })}
                    className="w-full px-4 py-2.5 border border-primary-soft rounded-lg focus:border-primary focus:ring-2 focus:ring-primary-soft outline-none transition-all bg-surface"
                  >
                    <option value="">Select interactive type</option>
                    <option value="button">Button</option>
                    <option value="list">List</option>
                    <option value="product">Product</option>
                    <option value="cta">CTA URL</option>
                    <option value="location">Location Request</option>
                  </select>
                )}

                {/* Remove Entry Button */}
                <div className="mt-6 flex justify-start">
                  <button
                    onClick={() => handleRemoveEntry(entry.id)}
                    className="flex items-center gap-2 bg-error hover:bg-error text-white px-5 py-2.5 rounded-lg text-sm font-medium transition-colors"
                  >
                    <X size={16} />
                    Remove Entry
                  </button>
                </div>
              </div>

              {/* Separator */}
              {index < faqEntries.length - 1 && (
                <div className="border-t border-border my-8"></div>
              )}
            </div>
          ))}

          {/* Add FAQ Entry Button */}
          <div className="bg-surface rounded-xl shadow-sm border border-primary-soft p-6">
            <button
              onClick={handleAddFaqEntry}
              className="flex items-center gap-2 bg-inverse hover:opacity-90 text-inverse-foreground px-5 py-2.5 rounded-lg text-sm font-medium transition-colors"
            >
              <Plus size={16} />
              Add FAQ Entry
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}