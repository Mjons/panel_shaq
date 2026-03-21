import React, { useState, useRef, useEffect } from "react";
import {
  Search,
  Plus,
  MoreVertical,
  ArrowRight,
  Sparkles,
  PlusCircle,
  Upload,
  Trash2,
  Edit2,
  X,
} from "lucide-react";

import { BottomSheet } from "../components/BottomSheet";

export type VaultCategory = "Character" | "Environment" | "Prop" | "Vehicle";

export interface VaultEntry {
  id: string;
  type: VaultCategory;
  name: string;
  image: string;
  description: string;
  personality?: string;
  visualLook?: string;
}

interface VaultProps {
  entries: VaultEntry[];
  setEntries: React.Dispatch<React.SetStateAction<VaultEntry[]>>;
}

export const VaultScreen: React.FC<VaultProps> = ({ entries, setEntries }) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<VaultCategory | "All">(
    "All",
  );
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<VaultEntry | null>(null);
  const [showOnboarding, setShowOnboarding] = useState(
    () => !localStorage.getItem("panelshaq_vault_onboarding_dismissed"),
  );

  // Form State
  const [formData, setFormData] = useState<Partial<VaultEntry>>({
    type: "Character",
    name: "",
    description: "",
    personality: "",
    visualLook: "",
    image: "",
  });

  const fileInputRef = useRef<HTMLInputElement>(null);

  const filteredEntries = entries.filter((entry) => {
    const matchesSearch =
      entry.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      entry.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory =
      activeCategory === "All" || entry.type === activeCategory;
    return matchesSearch && matchesCategory;
  });

  const handleOpenModal = (entry?: VaultEntry) => {
    if (entry) {
      setEditingEntry(entry);
      setFormData(entry);
    } else {
      setEditingEntry(null);
      setFormData({
        type: "Character",
        name: "",
        description: "",
        personality: "",
        visualLook: "",
        image: "",
      });
    }
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingEntry(null);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData((prev) => ({ ...prev, image: reader.result as string }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.image) return;

    if (editingEntry) {
      setEntries((prev) =>
        prev.map((entry) =>
          entry.id === editingEntry.id
            ? ({ ...entry, ...formData } as VaultEntry)
            : entry,
        ),
      );
    } else {
      const newEntry: VaultEntry = {
        ...formData,
        id: crypto.randomUUID(),
      } as VaultEntry;
      setEntries((prev) => [newEntry, ...prev]);
    }
    handleCloseModal();
  };

  const handleDelete = (id: string) => {
    if (window.confirm("Are you sure you want to delete this entry?")) {
      setEntries((prev) => prev.filter((entry) => entry.id !== id));
    }
  };

  return (
    <div className="pt-24 px-6 max-w-7xl mx-auto pb-40">
      {/* Header Section */}
      <header className="mb-12 flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <span className="font-label text-primary uppercase tracking-[0.2em] text-[10px] mb-2 block">
            Archives & Assets
          </span>
          <h2 className="font-headline text-5xl font-bold text-accent tracking-tighter">
            World Vault
          </h2>
        </div>
        <div className="flex gap-3">
          <div className="bg-surface-container px-4 py-2 rounded-lg flex items-center gap-3 border border-outline/20">
            <Search size={18} className="text-accent/50" />
            <input
              className="bg-transparent border-none focus:ring-0 text-sm text-accent placeholder-accent/30 w-48 outline-none"
              placeholder="Search entries..."
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <button
            onClick={() => handleOpenModal()}
            className="bg-secondary text-background w-12 h-12 flex items-center justify-center rounded-lg hover:opacity-90 active:scale-95 transition-all"
          >
            <Plus size={24} />
          </button>
        </div>
      </header>

      {/* Category Toggle */}
      <div className="flex gap-4 mb-10 overflow-x-auto pb-2 no-scrollbar">
        {["All", "Character", "Environment", "Prop", "Vehicle"].map((cat) => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat as any)}
            className={`px-6 py-2 rounded-full text-sm font-bold whitespace-nowrap transition-all border ${
              activeCategory === cat
                ? "bg-primary text-background border-primary"
                : "bg-surface-container text-accent/60 hover:text-accent border-outline/20"
            }`}
          >
            {cat === "All" ? "All Assets" : cat + "s"}
          </button>
        ))}
      </div>

      {showOnboarding && (
        <div className="mb-8 p-5 bg-surface-container/50 border-l-4 border-primary/60 rounded-r-xl relative">
          <button
            onClick={() => {
              setShowOnboarding(false);
              localStorage.setItem("panelshaq_vault_onboarding_dismissed", "1");
            }}
            className="absolute top-3 right-3 text-accent/30 hover:text-accent/60 transition-colors"
          >
            <X size={16} />
          </button>
          <p className="font-label text-primary uppercase tracking-[0.2em] text-[10px] font-bold mb-2">
            Your World Bible
          </p>
          <p className="text-accent/70 text-sm leading-relaxed mb-3">
            The World Vault stores everything in your comic's universe. Add
            characters, environments, props, and vehicles with reference images
            so the AI can keep them consistent across panels.
          </p>
          <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-accent/40">
            <span>• Upload reference images for visual consistency</span>
            <span>• Add descriptions, personality traits & visual details</span>
            <span>• Assets are auto-matched to panels during generation</span>
            <span>• Use the + button to create new entries</span>
          </div>
        </div>
      )}

      {/* Bento Grid */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
        {filteredEntries.map((entry, index) => {
          const isHero = index === 0 && activeCategory === "All";

          if (isHero) {
            return (
              <div
                key={entry.id}
                className="md:col-span-8 group relative overflow-hidden rounded-lg bg-surface-container hover:bg-surface-container-high transition-colors border border-outline/20"
              >
                <div className="flex flex-col md:flex-row h-full">
                  <div className="w-full md:w-1/2 h-64 md:h-auto overflow-hidden">
                    <img
                      alt={entry.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                      src={entry.image}
                    />
                  </div>
                  <div className="p-8 flex flex-col justify-between flex-1">
                    <div>
                      <div className="flex justify-between items-start mb-4">
                        <span className="bg-primary/20 text-primary text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-widest border border-primary/30">
                          Featured {entry.type}
                        </span>
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleOpenModal(entry)}
                            className="p-2 hover:bg-accent/10 rounded-full transition-colors"
                          >
                            <Edit2 size={16} className="text-accent/50" />
                          </button>
                          <button
                            onClick={() => handleDelete(entry.id)}
                            className="p-2 hover:bg-red-500/10 rounded-full transition-colors"
                          >
                            <Trash2 size={16} className="text-red-500/50" />
                          </button>
                        </div>
                      </div>
                      <h3 className="font-headline text-3xl font-bold text-accent mb-4">
                        {entry.name}
                      </h3>
                      <div className="space-y-4">
                        {entry.personality && (
                          <div>
                            <label className="text-[10px] font-bold text-secondary uppercase tracking-widest block mb-1">
                              Personality
                            </label>
                            <p className="text-accent/60 text-sm leading-relaxed">
                              {entry.personality}
                            </p>
                          </div>
                        )}
                        {entry.visualLook && (
                          <div>
                            <label className="text-[10px] font-bold text-secondary uppercase tracking-widest block mb-1">
                              Visual Look
                            </label>
                            <p className="text-accent/60 text-sm leading-relaxed">
                              {entry.visualLook}
                            </p>
                          </div>
                        )}
                        {!entry.personality && !entry.visualLook && (
                          <p className="text-accent/60 text-sm leading-relaxed">
                            {entry.description}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="mt-8 flex gap-2">
                      <button className="text-primary text-xs font-bold uppercase tracking-widest flex items-center gap-2 hover:translate-x-1 transition-transform">
                        View Portfolio <ArrowRight size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          }

          return (
            <div
              key={entry.id}
              className="md:col-span-4 group bg-surface-container rounded-lg overflow-hidden hover:bg-surface-container-high transition-colors border border-outline/20 flex flex-col"
            >
              <div className="h-48 relative overflow-hidden">
                <img
                  alt={entry.name}
                  className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                  src={entry.image}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-surface-container to-transparent opacity-60"></div>
                <div className="absolute top-4 left-4 right-4 flex justify-between items-center">
                  <span className="bg-secondary/20 text-secondary text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-widest border border-secondary/30 backdrop-blur-sm">
                    {entry.type}
                  </span>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => handleOpenModal(entry)}
                      className="p-1.5 bg-background/80 hover:bg-background rounded-full transition-colors backdrop-blur-sm"
                    >
                      <Edit2 size={12} className="text-accent" />
                    </button>
                    <button
                      onClick={() => handleDelete(entry.id)}
                      className="p-1.5 bg-background/80 hover:bg-red-500 rounded-full transition-colors backdrop-blur-sm group/del"
                    >
                      <Trash2
                        size={12}
                        className="text-accent group-hover/del:text-white"
                      />
                    </button>
                  </div>
                </div>
              </div>
              <div className="p-6 flex-1 flex flex-col">
                <h3 className="font-headline text-xl font-bold text-accent mb-2">
                  {entry.name}
                </h3>
                <p className="text-accent/60 text-xs leading-relaxed line-clamp-3 mb-4">
                  {entry.description}
                </p>
                {entry.visualLook && (
                  <div className="mt-auto pt-4 border-t border-outline/10">
                    <label className="text-[8px] font-bold text-secondary uppercase tracking-widest block mb-1">
                      Visual Look
                    </label>
                    <p className="text-accent/40 text-[10px] leading-relaxed line-clamp-2 italic">
                      {entry.visualLook}
                    </p>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Empty State */}
      {filteredEntries.length === 0 && (
        <div className="mt-16 py-20 border-2 border-dashed border-primary/20 rounded-lg flex flex-col items-center justify-center text-center opacity-60 hover:opacity-100 transition-opacity">
          <Sparkles size={60} className="mb-4 text-secondary" />
          <h4 className="font-headline text-2xl font-bold text-accent">
            No entries found
          </h4>
          <p className="text-accent/60 text-sm mt-2 max-w-xs">
            Try adjusting your search or category filter, or create a new entry.
          </p>
          <button
            onClick={() => handleOpenModal()}
            className="mt-6 text-primary font-bold uppercase tracking-widest text-xs flex items-center gap-2 hover:scale-105 transition-transform"
          >
            New Entry <PlusCircle size={16} />
          </button>
        </div>
      )}

      <BottomSheet
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        title={editingEntry ? "Edit Entry" : "New Vault Entry"}
      >
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Image Upload */}
            <div className="space-y-4">
              <label className="text-[10px] font-bold text-secondary uppercase tracking-widest block">
                Entry Image
              </label>
              <div
                onClick={() => fileInputRef.current?.click()}
                className="aspect-[4/5] bg-surface-container-highest rounded-xl border-2 border-dashed border-outline/20 flex flex-col items-center justify-center cursor-pointer hover:border-primary/50 transition-colors overflow-hidden relative group"
              >
                {formData.image ? (
                  <>
                    <img
                      src={formData.image}
                      alt="Preview"
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                      <Upload size={32} className="text-white" />
                    </div>
                  </>
                ) : (
                  <>
                    <Upload size={32} className="text-accent/20 mb-2" />
                    <span className="text-xs text-accent/40">Upload Image</span>
                  </>
                )}
              </div>
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleImageUpload}
                className="hidden"
                accept="image/*"
              />
            </div>

            {/* Basic Info */}
            <div className="space-y-6">
              <div>
                <label className="text-[10px] font-bold text-secondary uppercase tracking-widest block mb-2">
                  Category
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {["Character", "Environment", "Prop", "Vehicle"].map(
                    (cat) => (
                      <button
                        key={cat}
                        type="button"
                        onClick={() =>
                          setFormData((prev) => ({
                            ...prev,
                            type: cat as VaultCategory,
                          }))
                        }
                        className={`py-2 px-3 rounded-lg text-xs font-bold border transition-all ${
                          formData.type === cat
                            ? "bg-primary text-background border-primary"
                            : "bg-surface-container-highest text-accent/60 border-outline/10"
                        }`}
                      >
                        {cat}
                      </button>
                    ),
                  )}
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold text-secondary uppercase tracking-widest block mb-2">
                  Name
                </label>
                <input
                  required
                  className="w-full bg-surface-container-highest border border-outline/10 rounded-lg px-4 py-3 text-accent placeholder-accent/20 outline-none focus:border-primary/50 transition-colors"
                  placeholder="e.g. Commander Vex"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      name: e.target.value,
                    }))
                  }
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-secondary uppercase tracking-widest block mb-2">
                  Brief Description
                </label>
                <textarea
                  required
                  rows={3}
                  className="w-full bg-surface-container-highest border border-outline/10 rounded-lg px-4 py-3 text-accent placeholder-accent/20 outline-none focus:border-primary/50 transition-colors resize-none"
                  placeholder="A short summary of this entry..."
                  value={formData.description}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      description: e.target.value,
                    }))
                  }
                />
              </div>
            </div>
          </div>

          {/* Detailed Info */}
          <div className="space-y-6 pt-6 border-t border-outline/10">
            <div>
              <label className="text-[10px] font-bold text-secondary uppercase tracking-widest block mb-2">
                Personality / Lore (Optional)
              </label>
              <textarea
                rows={3}
                className="w-full bg-surface-container-highest border border-outline/10 rounded-lg px-4 py-3 text-accent placeholder-accent/20 outline-none focus:border-primary/50 transition-colors resize-none"
                placeholder="Describe their behavior, history, or purpose..."
                value={formData.personality}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    personality: e.target.value,
                  }))
                }
              />
            </div>

            <div>
              <label className="text-[10px] font-bold text-secondary uppercase tracking-widest block mb-2">
                Visual Details (Optional)
              </label>
              <textarea
                rows={3}
                className="w-full bg-surface-container-highest border border-outline/10 rounded-lg px-4 py-3 text-accent placeholder-accent/20 outline-none focus:border-primary/50 transition-colors resize-none"
                placeholder="Clothing, materials, lighting, distinct features..."
                value={formData.visualLook}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    visualLook: e.target.value,
                  }))
                }
              />
            </div>
          </div>

          <div className="pt-6">
            <button
              type="submit"
              disabled={!formData.name || !formData.image}
              className="w-full py-4 bg-primary text-background font-headline font-bold rounded-xl shadow-lg active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {editingEntry ? "Save Changes" : "Create Vault Entry"}
            </button>
          </div>
        </form>
      </BottomSheet>
    </div>
  );
};
