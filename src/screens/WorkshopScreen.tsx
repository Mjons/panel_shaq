import React, { useState, useRef } from "react";
import {
  Edit3,
  PlusCircle,
  UserPlus,
  Palette,
  ArrowRight,
  Sparkles,
  Loader2,
  X,
  Upload,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import {
  polishStory,
  generatePanelPrompts,
  analyzeCharacterImage,
  PanelPrompt,
} from "../services/geminiService";
import { useConfirm } from "../components/ConfirmDialog";
import { Character } from "../App";

interface WorkshopProps {
  projectName: string;
  setProjectName: (name: string) => void;
  story: string;
  setStory: (story: string) => void;
  characters: Character[];
  setCharacters: React.Dispatch<React.SetStateAction<Character[]>>;
  panels: PanelPrompt[];
  setPanels: (panels: PanelPrompt[]) => void;
  styleReferenceImage: string | null;
  setStyleReferenceImage: (img: string | null) => void;
  styleNotes: string;
  setStyleNotes: (notes: string) => void;
  onGenerateSuccess: () => void;
}

export const WorkshopScreen: React.FC<WorkshopProps> = ({
  projectName,
  setProjectName,
  story,
  setStory,
  characters,
  setCharacters,
  panels,
  setPanels,
  styleReferenceImage,
  setStyleReferenceImage,
  styleNotes,
  setStyleNotes,
  onGenerateSuccess,
}) => {
  const { confirm } = useConfirm();
  const [isPolishing, setIsPolishing] = useState(false);
  const [isGeneratingPanels, setIsGeneratingPanels] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [editingCharacter, setEditingCharacter] = useState<Character | null>(
    null,
  );
  const fileInputRef = useRef<HTMLInputElement>(null);
  const styleInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Check which characters are mentioned in the story
  const getCharacterMentions = () => {
    const lower = story.toLowerCase();
    return characters.map((c) => ({
      ...c,
      mentioned: lower.includes(c.name.toLowerCase()),
    }));
  };

  const insertCharacterName = (name: string) => {
    const textarea = textareaRef.current;
    if (!textarea) {
      setStory(story ? `${story} ${name}` : name);
      return;
    }
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const before = story.substring(0, start);
    const after = story.substring(end);
    const needsSpace =
      before.length > 0 && !before.endsWith(" ") && !before.endsWith("\n");
    const newText = `${before}${needsSpace ? " " : ""}${name}${after}`;
    setStory(newText);
    // Restore cursor after the inserted name
    requestAnimationFrame(() => {
      const pos = start + (needsSpace ? 1 : 0) + name.length;
      textarea.setSelectionRange(pos, pos);
      textarea.focus();
    });
  };

  // Build story with character anchors for Gemini
  const buildAnchoredStory = () => {
    let anchored = story;
    characters.forEach((c) => {
      const regex = new RegExp(
        `\\b${c.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`,
        "gi",
      );
      if (regex.test(anchored)) {
        anchored = anchored.replace(
          regex,
          `[CHARACTER: ${c.name} — ${c.description || "A character"}]`,
        );
      }
    });
    return anchored;
  };

  const handlePolish = async () => {
    if (!story.trim() || isPolishing) return;
    setIsPolishing(true);
    const polished = await polishStory(story, characters);
    setStory(polished);
    setIsPolishing(false);
  };

  const handleGeneratePanels = async () => {
    if (!story.trim() || isGeneratingPanels) return;

    // Warn if panels with images already exist
    const panelsWithImages = panels.filter((p) => p.image).length;
    const shouldWarn = (() => {
      try {
        const s = localStorage.getItem("panelshaq_settings");
        return s ? JSON.parse(s).showRegenWarnings !== false : true;
      } catch {
        return true;
      }
    })();
    if (panelsWithImages > 0 && shouldWarn) {
      const ok = await confirm({
        title: "Replace Existing Panels",
        message: `You have ${panelsWithImages} panel${panelsWithImages > 1 ? "s" : ""} with generated images. Creating new panels will replace them all. Download your images first if you want to keep them.`,
        confirmText: "Replace Panels",
        danger: true,
      });
      if (!ok) return;
    }

    setIsGeneratingPanels(true);
    try {
      const anchoredStory = buildAnchoredStory();
      const generatedPanels = await generatePanelPrompts(
        anchoredStory,
        characters,
      );
      if (generatedPanels.length > 0) {
        setPanels(generatedPanels);
        onGenerateSuccess();
      }
    } catch (error) {
      console.error("Error generating panels:", error);
    } finally {
      setIsGeneratingPanels(false);
    }
  };

  const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

  const handleAddCharacter = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > MAX_FILE_SIZE) {
        alert("Image too large. Please use an image under 5MB.");
        if (e.target) e.target.value = "";
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        const newChar: Character = {
          id: Date.now().toString(),
          type: "Character",
          name: `New Character ${characters.length + 1}`,
          image: reader.result as string,
          description: "A new character in your story.",
        };
        setCharacters([...characters, newChar]);
      };
      reader.readAsDataURL(file);
    }
    // Reset input
    if (e.target) e.target.value = "";
  };

  const handleAddStyleRef = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > MAX_FILE_SIZE) {
        alert("Image too large. Please use an image under 5MB.");
        if (e.target) e.target.value = "";
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setStyleReferenceImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
    if (e.target) e.target.value = "";
  };

  const removeCharacter = (id: string) => {
    setCharacters(characters.filter((c) => c.id !== id));
  };

  return (
    <div className="pt-28 px-6 max-w-5xl mx-auto pb-32">
      <section className="mb-12">
        <input
          type="text"
          value={projectName}
          onChange={(e) => setProjectName(e.target.value)}
          className="bg-transparent border-none outline-none font-headline text-5xl md:text-7xl font-bold text-accent tracking-tighter mb-3 w-full placeholder:text-accent/20"
          placeholder="Untitled Project"
        />
        <p className="text-accent/60 font-body text-lg max-w-2xl leading-relaxed">
          Craft the narrative spark that will ignite your visual journey.
        </p>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Writing Area */}
        <div className="lg:col-span-8 flex flex-col gap-6">
          <div className="bg-surface-container rounded-lg p-0.5 shadow-xl border border-outline/20">
            <div className="bg-background rounded-lg p-6 min-h-[450px] flex flex-col">
              <div className="flex items-center justify-between mb-6">
                <label className="font-headline text-xs uppercase tracking-[0.2em] text-secondary flex items-center gap-2 font-bold">
                  <Edit3 size={18} className="text-secondary" />
                  Writing Studio
                </label>
                <span className="text-accent/40 text-[10px] uppercase font-bold tracking-widest bg-surface-container px-2 py-1 rounded">
                  {story.length} / 2000 Characters
                </span>
              </div>
              {/* Character Tag Bar */}
              {characters.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5 mb-4 pb-3 border-b border-outline/10">
                  <span className="text-[8px] font-bold uppercase tracking-widest text-accent/30 mr-1">
                    Cast:
                  </span>
                  {getCharacterMentions().map((c) => (
                    <button
                      key={c.id}
                      onClick={() =>
                        !c.mentioned && insertCharacterName(c.name)
                      }
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold transition-all ${
                        c.mentioned
                          ? "bg-primary/20 text-primary border border-primary/30"
                          : "bg-surface-container text-accent/40 border border-outline/10 hover:border-primary/30 hover:text-accent/70 active:scale-95 cursor-pointer"
                      }`}
                      title={
                        c.mentioned
                          ? `"${c.name}" found in story`
                          : `Tap to insert "${c.name}"`
                      }
                    >
                      {c.image &&
                        ![
                          "Cartoon",
                          "Manga",
                          "Comic Book",
                          "Realistic",
                          "Watercolor",
                          "Pixel Art",
                        ].includes(c.image) && (
                          <img
                            src={c.image}
                            alt=""
                            className="w-4 h-4 rounded-full object-cover"
                          />
                        )}
                      {c.name}
                      {c.mentioned && (
                        <span className="text-[8px] opacity-60">✓</span>
                      )}
                    </button>
                  ))}
                </div>
              )}

              <textarea
                ref={textareaRef}
                className="flex-grow bg-transparent border-none focus:ring-0 text-accent font-body text-lg leading-relaxed resize-none placeholder:text-accent/20 outline-none"
                placeholder="A neon-drenched city breathes in the rain, as a lone figure adjusts their metallic mask..."
                value={story}
                onChange={(e) => setStory(e.target.value)}
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-3 px-2">
            <button
              onClick={handlePolish}
              disabled={isPolishing || !story.trim()}
              className="bg-surface px-5 py-2.5 rounded-lg border border-primary/20 flex items-center gap-3 hover:bg-primary/10 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isPolishing ? (
                <Loader2 size={18} className="text-primary animate-spin" />
              ) : (
                <Sparkles size={18} className="text-primary" />
              )}
              <span className="text-xs font-bold uppercase tracking-widest text-accent">
                AI Polish
              </span>
            </button>
          </div>
        </div>

        {/* Right Column: Sidebar */}
        <aside className="lg:col-span-4 flex flex-col gap-6">
          <div className="bg-surface-container p-6 rounded-lg border-t-2 border-primary shadow-2xl">
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-headline text-lg font-bold text-accent uppercase tracking-tight">
                Characters
              </h3>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="text-primary hover:rotate-90 transition-transform duration-300"
              >
                <PlusCircle size={24} />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <AnimatePresence>
                {characters.map((char) => (
                  <motion.div
                    layout
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    key={char.id}
                    className="group cursor-pointer relative"
                    onClick={() => setEditingCharacter(char)}
                  >
                    <div className="aspect-square rounded-lg overflow-hidden bg-surface border border-outline/30 group-hover:border-primary transition-all">
                      <img
                        className={`w-full h-full object-cover transition-all duration-500 ${styleReferenceImage === char.image ? "grayscale-0 opacity-100" : "grayscale opacity-60 group-hover:grayscale-0 group-hover:opacity-100"}`}
                        src={char.image}
                        alt={char.name}
                      />
                      {styleReferenceImage === char.image && (
                        <div className="absolute inset-0 border-2 border-primary rounded-lg pointer-events-none">
                          <div className="absolute top-2 left-2 bg-primary text-background p-1 rounded-md">
                            <Palette size={12} />
                          </div>
                        </div>
                      )}
                    </div>
                    <div className="absolute top-1 left-1 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setStyleReferenceImage(
                            styleReferenceImage === char.image
                              ? null
                              : char.image,
                          );
                        }}
                        className={`p-1.5 rounded-full border border-outline/20 transition-colors ${styleReferenceImage === char.image ? "bg-primary text-background" : "bg-background text-accent hover:text-primary"}`}
                        title="Set as Style Reference"
                      >
                        <Palette size={12} />
                      </button>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        removeCharacter(char.id);
                      }}
                      className="absolute -top-1 -right-1 bg-background text-accent p-1 rounded-full border border-outline/20 opacity-0 group-hover:opacity-100 transition-opacity hover:text-primary"
                    >
                      <X size={10} />
                    </button>
                    <p className="mt-2 text-[10px] font-bold uppercase tracking-widest text-accent/50 group-hover:text-primary text-center truncate px-1">
                      {char.name}
                    </p>
                  </motion.div>
                ))}
              </AnimatePresence>

              <div
                onClick={() => fileInputRef.current?.click()}
                className="aspect-square rounded-lg border-2 border-dashed border-outline/30 flex items-center justify-center hover:bg-white/5 transition-colors cursor-pointer group"
              >
                <UserPlus
                  size={24}
                  className="text-outline group-hover:text-primary transition-colors"
                />
              </div>
            </div>

            <input
              type="file"
              ref={fileInputRef}
              onChange={handleAddCharacter}
              className="hidden"
              accept="image/*"
            />
          </div>

          <div className="bg-surface-container p-5 rounded-lg border border-outline/20">
            <div className="flex items-center justify-between mb-4">
              <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-accent/40">
                Art Style
              </label>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
              {[
                { name: "Cartoon", desc: "Bold outlines • Bright colors" },
                { name: "Manga", desc: "Japanese style • Dynamic lines" },
                { name: "Comic Book", desc: "Western comics • Heavy inks" },
                { name: "Realistic", desc: "Photo-real • Detailed" },
                { name: "Watercolor", desc: "Soft washes • Painterly" },
                { name: "Pixel Art", desc: "Retro • 8-bit style" },
              ].map((style) => (
                <button
                  key={style.name}
                  onClick={() => setStyleReferenceImage(style.name)}
                  className={`min-h-[48px] px-3 py-3 rounded-xl text-left border transition-all active:scale-95 ${
                    styleReferenceImage === style.name
                      ? "bg-primary text-background border-primary shadow-[0_2px_10px_rgba(255,145,0,0.3)]"
                      : !styleReferenceImage ||
                          [
                            "Cartoon",
                            "Manga",
                            "Comic Book",
                            "Realistic",
                            "Watercolor",
                            "Pixel Art",
                          ].includes(styleReferenceImage)
                        ? "bg-background text-accent/60 border-outline/20 hover:border-primary/50"
                        : "bg-background text-accent/40 border-outline/10"
                  }`}
                >
                  <span className="text-sm font-bold block">{style.name}</span>
                  <span className="text-[9px] opacity-60">{style.desc}</span>
                </button>
              ))}
              <button
                onClick={() => styleInputRef.current?.click()}
                className={`min-h-[48px] px-3 py-3 rounded-xl text-left border transition-all active:scale-95 col-span-2 ${
                  styleReferenceImage &&
                  ![
                    "Cartoon",
                    "Manga",
                    "Comic Book",
                    "Realistic",
                    "Watercolor",
                    "Pixel Art",
                  ].includes(styleReferenceImage)
                    ? "bg-primary text-background border-primary shadow-[0_2px_10px_rgba(255,145,0,0.3)]"
                    : "bg-background text-accent/60 border-outline/20 hover:border-primary/50"
                }`}
              >
                <span className="text-sm font-bold block flex items-center gap-1.5">
                  <Upload size={14} /> Custom Upload
                </span>
                <span className="text-[9px] opacity-60">
                  Use your own reference image
                </span>
              </button>
            </div>
            {styleReferenceImage &&
              ![
                "Cartoon",
                "Manga",
                "Comic Book",
                "Realistic",
                "Watercolor",
                "Pixel Art",
              ].includes(styleReferenceImage) && (
                <div className="flex items-center gap-3 bg-background p-3 rounded-lg border border-primary/20 relative group">
                  <div className="w-10 h-10 rounded overflow-hidden border border-primary">
                    <img
                      src={styleReferenceImage}
                      className="w-full h-full object-cover"
                      alt="Custom Style"
                    />
                  </div>
                  <div className="flex-1">
                    <p className="text-xs font-bold text-accent">
                      Custom Reference
                    </p>
                    <p className="text-[8px] text-accent/40">Uploaded image</p>
                  </div>
                  <button
                    onClick={() => setStyleReferenceImage("Cartoon")}
                    className="p-1 text-accent/30 hover:text-red-500 transition-colors"
                  >
                    <X size={14} />
                  </button>
                </div>
              )}
            <div className="mt-3">
              <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-accent/40 mb-1.5 block">
                Style Notes
              </label>
              <textarea
                value={styleNotes}
                onChange={(e) => setStyleNotes(e.target.value)}
                className="w-full bg-background border border-outline/20 rounded-lg px-3 py-2 text-sm text-accent focus:border-primary outline-none transition-colors resize-none h-16 placeholder:text-accent/20"
                placeholder="e.g. cute, round shapes, soft pastel colors, thick outlines..."
                maxLength={200}
              />
              <p className="text-[8px] text-accent/30 mt-1">
                Describe the visual style to reinforce during generation
              </p>
            </div>
            <input
              type="file"
              ref={styleInputRef}
              onChange={handleAddStyleRef}
              className="hidden"
              accept="image/*"
            />
          </div>

          <div className="mt-2">
            <button
              onClick={handleGeneratePanels}
              disabled={isGeneratingPanels || !story.trim()}
              className="panel-shaq-gradient w-full py-5 rounded-lg flex items-center justify-center gap-3 group shadow-[0_10px_30px_rgba(255,145,0,0.2)] hover:shadow-[0_15px_40px_rgba(255,145,0,0.4)] transition-all active:scale-95 disabled:opacity-50"
            >
              <span className="font-headline font-black text-background text-lg uppercase tracking-tight">
                {isGeneratingPanels ? "Generating..." : "Generate Panels"}
              </span>
              {isGeneratingPanels ? (
                <Loader2 size={24} className="text-background animate-spin" />
              ) : (
                <ArrowRight
                  size={24}
                  className="text-background group-hover:translate-x-2 transition-transform"
                />
              )}
            </button>
            <p className="text-center mt-4 text-[10px] text-accent/40 font-bold uppercase tracking-[0.25em]">
              Estimated: {Math.ceil(story.split(" ").length / 50) || 4} Story
              Panels
            </p>
          </div>
        </aside>
      </div>
      <AnimatePresence>
        {editingCharacter && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-background/80 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-surface-container border border-outline/20 rounded-2xl p-8 max-w-md w-full shadow-2xl"
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="font-headline text-2xl font-bold text-accent">
                  Edit <span className="text-primary italic">Character</span>
                </h3>
                <button
                  onClick={() => setEditingCharacter(null)}
                  className="p-2 hover:bg-white/5 rounded-full transition-colors"
                >
                  <X size={20} className="text-accent/40" />
                </button>
              </div>

              <div className="space-y-6">
                <div className="flex justify-center">
                  <div className="w-32 h-32 rounded-xl overflow-hidden border-2 border-primary/20 shadow-lg">
                    <img
                      src={editingCharacter.image}
                      className="w-full h-full object-cover"
                      alt={editingCharacter.name}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-accent/40">
                    Name
                  </label>
                  <input
                    type="text"
                    value={editingCharacter.name}
                    onChange={(e) =>
                      setEditingCharacter({
                        ...editingCharacter,
                        name: e.target.value,
                      })
                    }
                    className="w-full bg-background border border-outline/20 rounded-lg px-4 py-3 text-accent focus:border-primary outline-none transition-colors"
                    placeholder="Character Name"
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-accent/40">
                      Appearance & Role
                    </label>
                    {editingCharacter.image &&
                      editingCharacter.image.startsWith("data:image/") && (
                        <button
                          onClick={async () => {
                            setIsAnalyzing(true);
                            const description = await analyzeCharacterImage(
                              editingCharacter.image,
                            );
                            if (description) {
                              setEditingCharacter({
                                ...editingCharacter,
                                description,
                              });
                            }
                            setIsAnalyzing(false);
                          }}
                          disabled={isAnalyzing}
                          className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-primary/20 hover:bg-primary/10 transition-all text-[10px] font-bold uppercase tracking-widest text-primary disabled:opacity-50"
                        >
                          {isAnalyzing ? (
                            <Loader2 size={12} className="animate-spin" />
                          ) : (
                            <Sparkles size={12} />
                          )}
                          {isAnalyzing ? "Analyzing..." : "Auto-Describe"}
                        </button>
                      )}
                  </div>
                  <textarea
                    value={editingCharacter.description}
                    onChange={(e) =>
                      setEditingCharacter({
                        ...editingCharacter,
                        description: e.target.value,
                      })
                    }
                    className="w-full bg-background border border-outline/20 rounded-lg px-4 py-3 text-accent focus:border-primary outline-none transition-colors h-32 resize-none text-sm leading-relaxed"
                    placeholder="Describe their look, outfit, and key features..."
                  />
                </div>

                <button
                  onClick={() => {
                    setCharacters((prev) =>
                      prev.map((c) =>
                        c.id === editingCharacter.id ? editingCharacter : c,
                      ),
                    );
                    setEditingCharacter(null);
                  }}
                  className="w-full bg-primary text-background font-bold uppercase tracking-widest py-4 rounded-xl hover:bg-primary/90 transition-all active:scale-95 shadow-lg shadow-primary/20"
                >
                  Save Changes
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
