export const LoadingSkeleton = () => (
  <div className="pt-24 px-6 flex items-center justify-center min-h-[60vh]">
    <div className="text-center space-y-4">
      <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin mx-auto" />
      <p className="text-[10px] text-accent/40 uppercase tracking-widest font-bold">
        Loading...
      </p>
    </div>
  </div>
);
