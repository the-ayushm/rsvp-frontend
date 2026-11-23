"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import {
  Bell,
  BookOpen,
  Bot,
  Bug,
  Building2,
  CalendarDays,
  Car,
  CirclePlay,
  CreditCard,
  Gift,
  GraduationCap,
  Headset,
  House,
  Keyboard,
  ListChecks,
  MapPin,
  MessageSquare,
  MousePointerClick,
  Package,
  Phone,
  Rocket,
  RotateCcw,
  Search,
  SearchX,
  Settings,
  ShoppingCart,
  Sparkles,
  Stethoscope,
  Tag,
  TrendingUp,
  Trophy,
  Truck,
  Video,
  X,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { flowsApi } from "../../api";
import styles from "./templates.module.css";
import {
  fetchChatbotTemplateCategories,
  fetchChatbotTemplates,
  type ChatbotTemplate,
  type TemplateCategory,
  type TemplateFlowStep,
} from "./templateData";

const VISIBLE_CATEGORY_COUNT = 7;

const FEATURE_ICONS: Record<string, LucideIcon> = {
  headset: Headset,
  bug: Bug,
  settings: Settings,
  home: House,
  search: Search,
  phone: Phone,
  building: Building2,
  video: Video,
  calendar: CalendarDays,
  package: Package,
  rotate: RotateCcw,
  truck: Truck,
  cart: ShoppingCart,
  tag: Tag,
  card: CreditCard,
  graduation: GraduationCap,
  book: BookOpen,
  car: Car,
  map: MapPin,
  rocket: Rocket,
  play: CirclePlay,
  gift: Gift,
  trophy: Trophy,
  stethoscope: Stethoscope,
  bell: Bell,
};

const STEP_ICONS: Record<TemplateFlowStep["type"], LucideIcon> = {
  trigger: Zap,
  message: MessageSquare,
  buttons: MousePointerClick,
  list: ListChecks,
  input: Keyboard,
  action: Settings,
};

const STEP_LABELS: Record<TemplateFlowStep["type"], string> = {
  trigger: "Trigger",
  message: "Message",
  buttons: "Quick Reply Buttons",
  list: "List Message",
  input: "Ask Question",
  action: "Action",
};

type ModalState = { template: ChatbotTemplate; mode: "preview" | "demo" } | null;

export default function FlowTemplatesTab() {
  const router = useRouter();

  const [templates, setTemplates] = useState<ChatbotTemplate[]>([]);
  const [categories, setCategories] = useState<TemplateCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState("all");
  const [search, setSearch] = useState("");
  const [showAllCategories, setShowAllCategories] = useState(false);
  const [modal, setModal] = useState<ModalState>(null);
  const [usingId, setUsingId] = useState<string | null>(null);

  useEffect(() => {
    loadTemplates();
  }, []);

  async function loadTemplates() {
    setLoading(true);
    try {
      const [categoryList, templateList] = await Promise.all([
        fetchChatbotTemplateCategories(),
        fetchChatbotTemplates(),
      ]);
      setCategories(categoryList);
      setTemplates(templateList);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load templates");
    } finally {
      setLoading(false);
    }
  }

  async function handleUseTemplate(template: ChatbotTemplate) {
    setUsingId(template.id);
    try {
      // TODO: create the flow from template.id once the templates API is available
      const flow = await flowsApi.create(template.name);
      toast.success(`"${template.name}" added to your flows`);
      router.push(`/user/flows/builder/${flow.id}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to use template");
      setUsingId(null);
    }
  }

  const filteredTemplates = useMemo(() => {
    const query = search.trim().toLowerCase();

    return templates.filter((template) => {
      if (activeCategory !== "all" && template.category !== activeCategory) {
        return false;
      }
      if (!query) return true;

      return [template.name, template.subtitle, template.description, ...template.tags]
        .join(" ")
        .toLowerCase()
        .includes(query);
    });
  }, [templates, activeCategory, search]);

  const activeHidden =
    categories.findIndex((category) => category.id === activeCategory) >=
    VISIBLE_CATEGORY_COUNT;
  const visibleCategories =
    showAllCategories || activeHidden
      ? categories
      : categories.slice(0, VISIBLE_CATEGORY_COUNT);
  const hasMoreCategories = categories.length > VISIBLE_CATEGORY_COUNT;

  return (
    <div>
      <div className={styles.templateSearch}>
        <Search size={18} className={styles.templateSearchIcon} />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search chatbot flow template"
          className={styles.templateSearchInput}
          aria-label="Search chatbot flow template"
        />
        {search && (
          <button
            type="button"
            onClick={() => setSearch("")}
            className={styles.templateSearchClear}
            aria-label="Clear search"
          >
            <X size={16} />
          </button>
        )}
      </div>

      <div className={styles.templateChips} role="tablist" aria-label="Template categories">
        <button
          type="button"
          role="tab"
          aria-selected={activeCategory === "all"}
          onClick={() => setActiveCategory("all")}
          className={`${styles.templateChip} ${activeCategory === "all" ? styles.active : ""}`}
        >
          All
        </button>

        {visibleCategories.map((category) => (
          <button
            key={category.id}
            type="button"
            role="tab"
            aria-selected={activeCategory === category.id}
            onClick={() => setActiveCategory(category.id)}
            className={`${styles.templateChip} ${
              activeCategory === category.id ? styles.active : ""
            }`}
          >
            {category.label}
          </button>
        ))}

        {hasMoreCategories && !activeHidden && (
          <button
            type="button"
            onClick={() => setShowAllCategories((prev) => !prev)}
            className={`${styles.templateChip} ${styles.more}`}
          >
            {showAllCategories ? "Show Less" : "+ More"}
          </button>
        )}
      </div>

      {loading ? (
        <div className={styles.templateState}>
          <div className={styles.templateSpinner} />
          <p>Loading templates...</p>
        </div>
      ) : filteredTemplates.length === 0 ? (
        <div className={styles.templateState}>
          <SearchX size={32} />
          <h3>No templates found</h3>
          <p>Try a different search or category</p>
        </div>
      ) : (
        <div className={styles.templateGrid}>
          {filteredTemplates.map((template) => (
            <TemplateCard
              key={template.id}
              template={template}
              onPreview={() => setModal({ template, mode: "preview" })}
              onDemo={() => setModal({ template, mode: "demo" })}
            />
          ))}
        </div>
      )}

      {modal && (
        <TemplateModal
          template={modal.template}
          mode={modal.mode}
          onModeChange={(mode) => setModal({ template: modal.template, mode })}
          onClose={() => setModal(null)}
          onUse={() => handleUseTemplate(modal.template)}
          isUsing={usingId === modal.template.id}
        />
      )}
    </div>
  );
}

function TemplateCard({
  template,
  onPreview,
  onDemo,
}: {
  template: ChatbotTemplate;
  onPreview: () => void;
  onDemo: () => void;
}) {
  return (
    <div className={styles.templateCard}>
      <div className={styles.templateCardHeader}>
        <div className={styles.templateCardInfo}>
          <h3 className={styles.templateCardTitle}>{template.name}</h3>
          <p className={styles.templateCardSubtitle}>{template.subtitle}</p>
        </div>
        <span className={`${styles.templateBadge} ${styles[template.badgeTone]}`}>
          {template.badge}
        </span>
      </div>

      <div className={styles.templateImpact}>
        <span className={styles.templateImpactValue}>{template.impact}%</span>
        <span className={styles.templateImpactLabel}>
          <TrendingUp size={16} />
          {template.impactLabel}
        </span>
      </div>

      <p className={styles.templateDesc}>{template.description}</p>

      <div className={styles.templateTags}>
        {template.tags.map((tag) => (
          <span key={tag} className={styles.templateTag}>
            {tag}
          </span>
        ))}
      </div>

      <div className={styles.templateFeatures}>
        {template.features.map((feature) => {
          const Icon = FEATURE_ICONS[feature.icon] ?? Sparkles;
          return (
            <div key={feature.label} className={styles.templateFeature}>
              <Icon size={22} />
              <span>{feature.label}</span>
            </div>
          );
        })}
      </div>

      <div className={styles.templateCardActions}>
        <button type="button" onClick={onPreview} className={styles.templateCardBtn}>
          Flow Preview
        </button>
        <button type="button" onClick={onDemo} className={styles.templateCardBtn}>
          Live Demo
        </button>
      </div>
    </div>
  );
}

function TemplateModal({
  template,
  mode,
  onModeChange,
  onClose,
  onUse,
  isUsing,
}: {
  template: ChatbotTemplate;
  mode: "preview" | "demo";
  onModeChange: (mode: "preview" | "demo") => void;
  onClose: () => void;
  onUse: () => void;
  isUsing: boolean;
}) {
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <div className={styles.templateOverlay} onClick={onClose}>
      <div
        className={styles.templateModal}
        role="dialog"
        aria-modal="true"
        aria-label={template.name}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={styles.templateModalHeader}>
          <div>
            <h2 className={styles.templateModalTitle}>{template.name}</h2>
            <p className={styles.templateModalSubtitle}>{template.description}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className={styles.templateModalClose}
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>

        <div className={styles.templateModalTabs}>
          <button
            type="button"
            onClick={() => onModeChange("preview")}
            className={`${styles.templateModalTab} ${mode === "preview" ? styles.active : ""}`}
          >
            Flow Preview
          </button>
          <button
            type="button"
            onClick={() => onModeChange("demo")}
            className={`${styles.templateModalTab} ${mode === "demo" ? styles.active : ""}`}
          >
            Live Demo
          </button>
        </div>

        <div className={styles.templateModalBody}>
          {mode === "preview" ? (
            <FlowPreview steps={template.flow} />
          ) : (
            <LiveDemo key={template.id} template={template} />
          )}
        </div>

        <div className={styles.templateModalFooter}>
          <button
            type="button"
            onClick={onClose}
            className={`${styles.templateModalBtn} ${styles.secondary}`}
          >
            Close
          </button>
          <button
            type="button"
            onClick={onUse}
            disabled={isUsing}
            className={`${styles.templateModalBtn} ${styles.primary}`}
          >
            <Sparkles size={16} />
            <span>{isUsing ? "Creating..." : "Use This Template"}</span>
          </button>
        </div>
      </div>
    </div>
  );
}

function FlowPreview({ steps }: { steps: TemplateFlowStep[] }) {
  return (
    <ol className={styles.flowSteps}>
      {steps.map((step, index) => {
        const Icon = STEP_ICONS[step.type];
        return (
          <li key={index} className={styles.flowStep}>
            <div className={`${styles.flowStepIcon} ${styles[step.type]}`}>
              <Icon size={16} />
            </div>
            <div className={styles.flowStepCard}>
              <div className={styles.flowStepMeta}>
                <span className={styles.flowStepType}>{STEP_LABELS[step.type]}</span>
                <span className={styles.flowStepNumber}>Step {index + 1}</span>
              </div>
              <div className={styles.flowStepTitle}>{step.title}</div>
              <p className={styles.flowStepContent}>{step.content}</p>
              {step.options && (
                <div className={styles.flowStepOptions}>
                  {step.options.map((option) => (
                    <span key={option} className={styles.flowStepOption}>
                      {option}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

function LiveDemo({ template }: { template: ChatbotTemplate }) {
  const [visibleCount, setVisibleCount] = useState(0);
  const isDone = visibleCount >= template.demo.length;

  useEffect(() => {
    if (isDone) return;
    const timer = setTimeout(() => setVisibleCount((count) => count + 1), 900);
    return () => clearTimeout(timer);
  }, [visibleCount, isDone]);

  return (
    <div className={styles.demoWrap}>
      <div className={styles.demoPhone}>
        <div className={styles.demoPhoneHeader}>
          <div className={styles.demoAvatar}>
            <Bot size={18} />
          </div>
          <div>
            <div className={styles.demoName}>{template.name}</div>
            <div className={styles.demoStatus}>{isDone ? "online" : "typing..."}</div>
          </div>
        </div>

        <div className={styles.demoChat}>
          {template.demo.slice(0, visibleCount).map((message, index) => (
            <div
              key={index}
              className={`${styles.demoBubble} ${
                message.from === "bot" ? styles.bot : styles.user
              }`}
            >
              <p>{message.text}</p>
              {message.options && (
                <div className={styles.demoOptions}>
                  {message.options.map((option) => (
                    <span key={option} className={styles.demoOption}>
                      {option}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      <button
        type="button"
        onClick={() => setVisibleCount(0)}
        disabled={!isDone}
        className={styles.demoReplay}
      >
        <RotateCcw size={14} />
        <span>Replay</span>
      </button>
    </div>
  );
}
