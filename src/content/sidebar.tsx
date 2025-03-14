import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import "@/styles/sidebar.css";
import { generateIdeas } from "./contentScript";
import { Idea } from "@/types/idea";
import {
  insertBody,
  inertTitle,
  insertSubtitle,
} from "@/components/ui/generateButton";
import { useOutsideClick } from "@/lib/hooks/useOutsideClick";
import SubstackPoster from "@/components/SubstackPoster";

export interface SidebarProps {
  children: React.ReactNode;
}

const Sidebar = ({ children }: SidebarProps) => {
  const sidebarRef = useRef<HTMLDivElement>(null);
  useOutsideClick(sidebarRef, () => setIsOpen(false));
  const [selectedIdea, setSelectedIdea] = useState<Idea | null>(null);
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'ideas' | 'post'>('ideas');

  useEffect(() => {
    if (selectedIdea) {
      insertBody(selectedIdea.body);
      inertTitle(selectedIdea.title);
      insertSubtitle(selectedIdea.subtitle);
    }
  }, [selectedIdea]);

  const toggleSidebar = () => {
    setIsOpen(!isOpen);
  };

  const handleGenerateIdeas = async () => {
    setIsLoading(true);
    try {
      const ideas = await generateIdeas();
      console.log("Generated ideas:", ideas);
      setIdeas(ideas);
    } catch (error) {
      console.error("Error generating ideas:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // Add a click handler to prevent clicks from propagating to the document
  const handleSidebarClick = (e: React.MouseEvent) => {
    e.stopPropagation();
  };

  return (
    <>
      <AnimatePresence>
        {true && (
          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            key="sidebar"
            transition={{ duration: 0.3 }}
            className="sidebar-closed-container"
          >
            <img
              onClick={(e) => {
                e.stopPropagation();
                toggleSidebar();
              }}
              src="https://apps-og-images.s3.us-east-1.amazonaws.com/128.png"
              alt="SuperX"
              className="sidebar-logo"
            />
          </motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {true && (
          <motion.div
            ref={sidebarRef}
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            key="sidebar"
            transition={{ duration: 0.3 }}
            className={`sidebar-open-container ${
              true ? "sidebar-open-active" : ""
            }`}
            onClick={handleSidebarClick}
          >
            <div className="sidebar-tabs">
              <button 
                className={`sidebar-tab ${activeTab === 'ideas' ? 'active' : ''}`}
                onClick={() => setActiveTab('ideas')}
              >
                Ideas
              </button>
              <button 
                className={`sidebar-tab ${activeTab === 'post' ? 'active' : ''}`}
                onClick={() => setActiveTab('post')}
              >
                Post to Substack
              </button>
            </div>
            
            {activeTab === 'ideas' && (
              <>
                <div className="sidebar-content-wrapper">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleGenerateIdeas();
                    }}
                    disabled={isLoading}
                    className="generate-button"
                  >
                    <p>{isLoading ? "Generating..." : "Generate Ideas"}</p>
                  </button>
                </div>
                <div className="sidebar-ideas-container">
                  {ideas.map((idea) => (
                    <div
                      key={idea.id}
                      className="sidebar-idea-item"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedIdea(idea);
                      }}
                    >
                      {idea.title}
                    </div>
                  ))}
                </div>
              </>
            )}
            
            {activeTab === 'post' && (
              <div className="sidebar-post-container">
                <SubstackPoster />
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default Sidebar;
