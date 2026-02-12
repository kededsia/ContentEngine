import React from "react";
import { Link, useLocation } from "react-router-dom";
import { Flame, BookMarked } from "lucide-react";

const AppHeader: React.FC = () => {
  const location = useLocation();

  return (
    <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2">
          <Flame className="h-6 w-6 text-primary" />
          <span className="font-bold text-lg tracking-tight" style={{ fontFamily: 'Rajdhani, sans-serif' }}>
            KENSHI <span className="text-primary">SCRIPT</span>
          </span>
        </Link>
        <nav className="flex gap-1">
          <Link
            to="/"
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${location.pathname === "/"
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:text-foreground"
              }`}
          >
            Generator
          </Link>
          <Link
            to="/collection"
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors flex items-center gap-1.5 ${location.pathname === "/collection"
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:text-foreground"
              }`}
          >
            <BookMarked className="h-3.5 w-3.5" />
            Koleksi
          </Link>
          <Link
            to="/videos"
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors flex items-center gap-1.5 ${location.pathname === "/videos"
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:text-foreground"
              }`}
          >
            <span role="img" aria-label="video">🎬</span>
            Videos
          </Link>
        </nav>
      </div>
    </header>
  );
};

export default AppHeader;
