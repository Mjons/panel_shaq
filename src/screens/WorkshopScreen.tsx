import React, { useState, useRef } from "react";
import {
  Edit3,
  PlusCircle,
  UserPlus,
  ArrowRight,
  Sparkles,
  Loader2,
  X,
  Upload,
  Palette,
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
  onGenerateSuccess: () => void;
  onNavigate?: (tab: string) => void;
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
  onGenerateSuccess,
  onNavigate,
}) => {
  const { confirm } = useConfirm();
  const [isPolishing, setIsPolishing] = useState(false);
  const [isGeneratingPanels, setIsGeneratingPanels] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [editingCharacter, setEditingCharacter] = useState<Character | null>(
    null,
  );
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [showOnboarding, setShowOnboarding] = useState(
    () => !localStorage.getItem("panelshaq_workshop_onboarding_dismissed"),
  );

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

    // First-time tip: remind user to fill out character descriptions
    const seenDescTip = localStorage.getItem("panelshaq_seen_desc_tip");
    if (!seenDescTip && characters.length > 0) {
      const missingDesc = characters.filter(
        (c) =>
          !c.description || c.description === "A new character in your story.",
      );
      const ok = await confirm({
        title: "Tip: Add Character Descriptions",
        message:
          missingDesc.length > 0
            ? `${missingDesc.length} of your ${characters.length} character${characters.length > 1 ? "s" : ""} ${missingDesc.length > 1 ? "are" : "is"} missing a description. Tap on each character in step 1 to fill out their appearance — this helps the AI generate more accurate images. You can also use the "Auto-Describe" button to analyze their image automatically.`
            : 'Make sure your character descriptions are filled out — the AI uses them to generate accurate images. Tap any character in step 1 to edit, or use "Auto-Describe" to fill it in automatically.',
        confirmText: "Got it, Generate",
      });
      localStorage.setItem("panelshaq_seen_desc_tip", "1");
      if (!ok) return;
    }

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
        message: `You have ${panelsWithImages} panel${panelsWithImages > 1 ? "s" : ""} with generated images. Creating new panels will replace them all.`,
        confirmText: "Replace Panels",
        danger: true,
        secondaryAction: {
          label: `Download ${panelsWithImages} Images`,
          onClick: () => {
            panels
              .filter((p) => p.image)
              .forEach((p, i) => {
                const link = document.createElement("a");
                link.download = `panel-${String(i + 1).padStart(2, "0")}.png`;
                link.href = p.image!;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
              });
          },
        },
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

  const removeCharacter = (id: string) => {
    setCharacters(characters.filter((c) => c.id !== id));
  };

  return (
    <div className="pt-28 px-6 max-w-5xl mx-auto pb-32">
      <section className="mb-8">
        <input
          type="text"
          value={projectName}
          onChange={(e) => setProjectName(e.target.value)}
          className="bg-transparent border-none outline-none font-headline text-4xl md:text-7xl font-bold text-accent tracking-tighter mb-1 w-full placeholder:text-accent/70"
          placeholder="Untitled Project"
        />
      </section>

      {showOnboarding && (
        <div className="mb-6 p-5 bg-surface-container/50 border-l-4 border-primary/60 rounded-r-xl">
          <p className="font-headline font-bold text-accent text-lg mb-2">
            Welcome to Panelhaus
          </p>
          <p className="text-accent/60 text-sm leading-relaxed mb-3">
            Create AI-generated comics in minutes. Upload character references,
            write a story, and let AI generate your panels.
          </p>
          <div className="flex flex-wrap gap-x-6 gap-y-2 text-xs text-accent/70">
            <div className="flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-primary/20 text-primary flex items-center justify-center text-[10px] font-bold shrink-0">
                5m
              </span>
              <span>
                Quick comic — upload a character, write a few lines, generate &
                export
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-secondary/20 text-secondary flex items-center justify-center text-[10px] font-bold shrink-0">
                30m
              </span>
              <span>
                Polished comic — detailed descriptions, camera angles, dialogue,
                custom layouts
              </span>
            </div>
          </div>
          <div className="mt-3 pt-3 border-t border-outline/10 flex flex-wrap gap-x-6 gap-y-1 text-[11px] text-accent/70">
            <span>
              <strong className="text-primary">1.</strong> Add characters with
              reference images
            </span>
            <span>
              <strong className="text-primary">2.</strong> Set your style
            </span>
            <span>
              <strong className="text-primary">3.</strong> Write your story
            </span>
            <span>
              <strong className="text-primary">4.</strong> Generate panels →
              arrange layouts → add dialogue → export
            </span>
          </div>
          <div className="mt-4 text-center">
            <button
              onClick={() => {
                setShowOnboarding(false);
                localStorage.setItem(
                  "panelshaq_workshop_onboarding_dismissed",
                  "1",
                );
              }}
              className="px-6 py-2 bg-secondary text-background font-headline font-bold text-sm rounded-lg hover:opacity-90 active:scale-95 transition-all"
            >
              Got it
            </button>
          </div>
        </div>
      )}

      <div className="flex flex-col lg:grid lg:grid-cols-12 gap-6 items-start">
        {/* Characters + Style + Generate — shown first on mobile, right on desktop */}
        <aside className="lg:col-span-4 lg:order-2 order-first flex flex-col gap-6 w-full">
          {/* STEP 1: Characters */}
          <div className="bg-surface-container p-5 rounded-lg border-t-2 border-primary shadow-2xl">
            <div className="flex items-center justify-between mb-2">
              <h2 className="font-headline text-lg font-bold text-accent uppercase tracking-tight">
                <span className="text-primary">1.</span> Characters
              </h2>
              <button
                onClick={() => onNavigate?.("vault")}
                className="text-primary hover:rotate-90 transition-transform duration-300"
                aria-label="Add character from vault"
              >
                <PlusCircle size={24} />
              </button>
            </div>
            <p className="text-[10px] text-accent/70 mb-4">
              Upload character images. Tap to edit name and description. These
              will be used as references during generation.
            </p>
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
                        className="w-full h-full object-cover transition-all duration-500 group-hover:opacity-100 opacity-90"
                        src={char.image}
                        alt={char.name}
                        fetchpriority="high"
                        decoding="async"
                      />
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        removeCharacter(char.id);
                      }}
                      className="absolute -top-1 -right-1 bg-background text-accent p-1 rounded-full border border-outline/20 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity hover:text-primary"
                      aria-label={`Remove ${char.name}`}
                    >
                      <X size={10} />
                    </button>
                    <p className="mt-2 text-[10px] font-bold uppercase tracking-widest text-accent/50 group-hover:text-primary text-center truncate px-1">
                      {char.name}
                    </p>
                  </motion.div>
                ))}
              </AnimatePresence>

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="aspect-square rounded-lg border-2 border-dashed border-outline/30 flex items-center justify-center hover:bg-white/5 transition-colors cursor-pointer group"
                aria-label="Add character"
              >
                <UserPlus
                  size={24}
                  className="text-outline group-hover:text-primary transition-colors"
                />
              </button>
            </div>

            <input
              type="file"
              ref={fileInputRef}
              onChange={handleAddCharacter}
              className="hidden"
              accept="image/*"
            />
          </div>

          {/* STEP 2: Style */}
          <div className="bg-surface-container p-5 rounded-lg border border-outline/20">
            <h2 className="font-headline text-lg font-bold text-accent uppercase tracking-tight mb-2">
              <span className="text-primary">2.</span> Style
            </h2>
            <p className="text-[10px] text-accent/70 mb-3">
              Tap the palette icon on a character to set it as the art style
              reference. Your comic will match that image's look.
            </p>
            {characters.length > 0 ? (
              <div className="flex flex-wrap gap-3">
                {characters.map((char) => {
                  const isStyleRef = styleReferenceImage === char.image;
                  return (
                    <button
                      key={char.id}
                      onClick={() =>
                        setStyleReferenceImage(isStyleRef ? null : char.image)
                      }
                      className={`relative w-14 h-14 rounded-lg overflow-hidden border-2 transition-all ${
                        isStyleRef
                          ? "border-primary shadow-[0_0_10px_rgba(255,145,0,0.4)]"
                          : "border-outline/20 opacity-50 hover:opacity-100"
                      }`}
                    >
                      <img
                        src={char.image}
                        className="w-full h-full object-cover"
                        alt={char.name}
                      />
                      {isStyleRef && (
                        <div className="absolute inset-0 bg-primary/20 flex items-center justify-center">
                          <Palette
                            size={16}
                            className="text-primary drop-shadow-lg"
                          />
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            ) : (
              <p className="text-[10px] text-accent/50 italic">
                Upload characters in step 1 first
              </p>
            )}
            {styleReferenceImage && (
              <p className="text-[9px] text-primary/60 mt-2 font-bold">
                Style reference set — all panels will match this image's art
                style
              </p>
            )}
          </div>
        </aside>

        {/* STEP 2: Story */}
        <div className="lg:col-span-8 lg:order-1 order-2 flex flex-col gap-4 w-full">
          <div className="bg-surface-container rounded-lg p-0.5 shadow-xl border border-outline/20">
            <div className="bg-background rounded-lg p-5 min-h-[300px] lg:min-h-[450px] flex flex-col">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-headline text-lg font-bold text-accent uppercase tracking-tight">
                  <span className="text-primary">3.</span> Story
                </h2>
                <span className="text-accent/70 text-[10px] uppercase font-bold tracking-widest bg-surface-container px-2 py-1 rounded">
                  {story.length} / 2000
                </span>
              </div>
              <p className="text-[10px] text-accent/70 mb-3">
                Write your story. Mention character names to link them. Tap a
                character tag below to insert their name.
              </p>
              {/* Character Tag Bar */}
              {characters.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5 mb-4 pb-3 border-b border-outline/10">
                  <span className="text-[8px] font-bold uppercase tracking-widest text-accent/70 mr-1">
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
                          : "bg-surface-container text-accent/70 border border-outline/10 hover:border-primary/30 hover:text-accent/70 active:scale-95 cursor-pointer"
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
                className="flex-grow bg-transparent border-none focus:ring-0 text-accent font-body text-base leading-relaxed resize-none placeholder:text-accent/70 outline-none"
                placeholder="A neon-drenched city breathes in the rain, as a lone figure adjusts their metallic mask..."
                value={story}
                onChange={(e) => setStory(e.target.value)}
              />
            </div>
          </div>

          {/* STEP 3: Polish */}
          <div className="flex items-center gap-4 border border-outline/20 rounded-xl p-3">
            <button
              onClick={handlePolish}
              disabled={isPolishing || !story.trim()}
              className="bg-surface px-5 py-2.5 rounded-lg border border-primary/20 flex items-center gap-3 hover:bg-primary/10 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
            >
              {isPolishing ? (
                <Loader2 size={18} className="text-primary animate-spin" />
              ) : (
                <Sparkles size={18} className="text-primary" />
              )}
              <span className="text-xs font-bold uppercase tracking-widest text-accent">
                Polish{" "}
                <span className="text-accent/70 normal-case tracking-normal">
                  (optional)
                </span>
              </span>
            </button>
            <p className="text-[10px] text-accent/70 leading-relaxed">
              Optional. Rewrites your story with cinematic flair. Considers your
              cast from step 1 and uses your text as a guide.
            </p>
          </div>

          <button
            onClick={handleGeneratePanels}
            disabled={isGeneratingPanels || !story.trim()}
            className="panel-shaq-gradient w-full py-5 rounded-lg flex items-center justify-center gap-3 group shadow-[0_10px_30px_rgba(255,145,0,0.2)] hover:shadow-[0_15px_40px_rgba(255,145,0,0.4)] transition-all active:scale-95 disabled:opacity-50"
          >
            <span className="font-headline font-black text-background text-lg uppercase tracking-tight">
              {isGeneratingPanels ? "Generating..." : "4. Generate Panels"}
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
        </div>
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
                <h2 className="font-headline text-2xl font-bold text-accent">
                  Edit <span className="text-primary italic">Character</span>
                </h2>
                <button
                  onClick={() => setEditingCharacter(null)}
                  className="p-2 hover:bg-white/5 rounded-full transition-colors"
                >
                  <X size={20} className="text-accent/70" />
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
                  <label className="text-[10px] font-bold uppercase tracking-widest text-accent/70">
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
                    <label className="text-[10px] font-bold uppercase tracking-widest text-accent/70">
                      Appearance & Role
                    </label>
                    {editingCharacter.image && editingCharacter.image && (
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
