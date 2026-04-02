import React, { useState, useEffect } from "react";
import { FolderOpen, Plus, Trash2, X, Loader2, Clock } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import {
  getProjectMetas,
  loadProject,
  deleteProject,
  type ProjectMeta,
  type SavedProject,
} from "../services/projectStorage";

interface ProjectManagerProps {
  isOpen: boolean;
  onClose: () => void;
  onLoadProject: (project: SavedProject) => void;
  onNewProject: () => void;
  currentProjectId: string | null;
}

export const ProjectManager: React.FC<ProjectManagerProps> = ({
  isOpen,
  onClose,
  onLoadProject,
  onNewProject,
  currentProjectId,
}) => {
  const [projects, setProjects] = useState<ProjectMeta[]>([]);
  const [loading, setLoading] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setProjects(getProjectMetas());
    }
  }, [isOpen]);

  const handleLoad = async (id: string) => {
    setLoading(id);
    try {
      const project = await loadProject(id);
      if (project) {
        onLoadProject(project);
        onClose();
      }
    } catch (err) {
      console.error("Failed to load project:", err);
    } finally {
      setLoading(null);
    }
  };

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!window.confirm("Delete this project? This cannot be undone.")) return;
    try {
      await deleteProject(id);
      setProjects((prev) => prev.filter((p) => p.id !== id));
    } catch (err) {
      console.error("Failed to delete project:", err);
    }
  };

  const handleNew = () => {
    onNewProject();
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[80]"
          />
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="fixed bottom-0 left-0 right-0 max-h-[85vh] bg-surface-container rounded-t-2xl z-[90] overflow-hidden"
          >
            {/* Handle */}
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 bg-accent/20 rounded-full" />
            </div>

            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-outline/10">
              <h2 className="font-headline text-xl font-bold text-accent flex items-center gap-2">
                <FolderOpen size={20} className="text-primary" />
                My Projects
              </h2>
              <button
                onClick={onClose}
                className="p-2 hover:bg-accent/10 rounded-full transition-colors"
                aria-label="Close"
              >
                <X size={20} className="text-accent/50" />
              </button>
            </div>

            {/* Content */}
            <div className="overflow-y-auto p-6 max-h-[calc(85vh-100px)]">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {/* New Project Card */}
                <button
                  onClick={handleNew}
                  className="aspect-[4/3] border-2 border-dashed border-primary/30 rounded-xl flex flex-col items-center justify-center gap-2 hover:border-primary hover:bg-primary/5 transition-all"
                >
                  <Plus size={32} className="text-primary/60" />
                  <span className="text-xs font-bold text-primary uppercase tracking-widest">
                    New Project
                  </span>
                </button>

                {/* Saved Projects */}
                {projects.map((project) => (
                  <button
                    key={project.id}
                    onClick={() => handleLoad(project.id)}
                    disabled={loading !== null}
                    className={`aspect-[4/3] relative rounded-xl overflow-hidden border-2 transition-all group ${
                      currentProjectId === project.id
                        ? "border-primary"
                        : "border-outline/20 hover:border-primary/50"
                    }`}
                  >
                    {/* Thumbnail */}
                    {project.thumbnail ? (
                      <img
                        src={project.thumbnail}
                        alt={project.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full bg-surface-container-highest flex items-center justify-center">
                        <FolderOpen size={32} className="text-accent/40" />
                      </div>
                    )}

                    {/* Overlay */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent flex flex-col justify-end p-3">
                      <p className="text-sm font-bold text-white truncate">
                        {project.name}
                      </p>
                      <p className="text-[10px] text-white/50 flex items-center gap-1">
                        <Clock size={8} />
                        {new Date(project.updatedAt).toLocaleDateString()}
                      </p>
                    </div>

                    {/* Current indicator */}
                    {currentProjectId === project.id && (
                      <div className="absolute top-2 left-2 bg-primary text-background text-[8px] font-bold px-2 py-0.5 rounded uppercase tracking-widest">
                        Current
                      </div>
                    )}

                    {/* Loading overlay */}
                    {loading === project.id && (
                      <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                        <Loader2
                          size={24}
                          className="text-primary animate-spin"
                        />
                      </div>
                    )}

                    {/* Delete button */}
                    <button
                      onClick={(e) => handleDelete(e, project.id)}
                      className="absolute top-2 right-2 p-1.5 bg-black/60 rounded-full opacity-0 group-hover:opacity-100 hover:bg-red-500 transition-all"
                    >
                      <Trash2 size={12} className="text-white" />
                    </button>
                  </button>
                ))}
              </div>

              {projects.length === 0 && (
                <p className="text-center text-accent/30 text-sm mt-8">
                  No saved projects yet. Your work auto-saves as you go.
                </p>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
