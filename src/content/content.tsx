// src/content/content.tsx
import React from "react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import Layout from "@/content/layout";
import Generate from "@/content/generate";
import "@/styles/main.css"; // Make sure CSS is imported here too

const Content: React.FC = () => {
  return (
    <MemoryRouter initialEntries={["/generate"]}>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route path="generate" element={<Generate />} />
        </Route>
      </Routes>
    </MemoryRouter>
  );
};

export default Content;

// Define the popup's style and behavior
interface Popup {
  element: HTMLElement;
  show: (x: number, y: number, text: string) => void;
  hide: () => void;
}

// Create and manage the popup
const createPopup = (): Popup => {
  const popup = document.createElement("div");
  popup.style.position = "absolute";
  popup.style.background = "#333";
  popup.style.color = "#fff";
  popup.style.padding = "5px 10px";
  popup.style.borderRadius = "3px";
  popup.style.boxShadow = "0 2px 4px rgba(0,0,0,0.2)";
  popup.style.zIndex = "1000";
  popup.style.display = "none";
  document.body.appendChild(popup);

  return {
    element: popup,
    show(x: number, y: number, text: string) {
      popup.textContent = `Selected: "${text}"`; // Customize this content
      popup.style.left = `${x}px`;
      popup.style.top = `${y - 30}px`; // Position above the selection
      popup.style.display = "block";
    },
    hide() {
      popup.style.display = "none";
    },
  };
};

// Main function to handle text selection
const handleTextSelection = (popup: Popup) => {
  document.addEventListener("selectionchange", () => {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) {
      popup.hide();
      return;
    }

    const selectedText = selection.toString().trim();
    if (!selectedText) {
      popup.hide();
      return;
    }

    // Check if selection is inside a TipTap editor
    const range = selection.getRangeAt(0);
    const editorElement = document.querySelector(".tiptap");
    if (
      editorElement &&
      editorElement.contains(range.commonAncestorContainer)
    ) {
      // Get the bounding rectangle of the selection
      const rect = range.getBoundingClientRect();
      const scrollX = window.scrollX;
      const scrollY = window.scrollY;

      // Position popup above the selection (center horizontally)
      const popupX =
        rect.left + scrollX + rect.width / 2 - popup.element.offsetWidth / 2;
      const popupY = rect.top + scrollY;

      popup.show(popupX, popupY, selectedText);
    } else {
      popup.hide();
    }
  });
};

// Initialize the script
const init = () => {
  const popup = createPopup();
  handleTextSelection(popup);

  // Optional: Clean up popup when the script unloads (if needed)
  window.addEventListener("unload", () => {
    popup.element.remove();
  });
};

// Run the script
init();
