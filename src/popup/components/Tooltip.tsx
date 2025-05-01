import React, { useState, useRef, useEffect } from 'react';
import '../../styles/popup.css';

interface TooltipProps {
  content: string;
  children: React.ReactNode;
  position?: 'top' | 'bottom' | 'left' | 'right';
}

const Tooltip: React.FC<TooltipProps> = ({ 
  content, 
  children, 
  position = 'top' 
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const tooltipRef = useRef<HTMLDivElement>(null);
  
  const showTooltip = () => setIsVisible(true);
  const hideTooltip = () => setIsVisible(false);
  
  // Close the tooltip when clicking outside of it
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (tooltipRef.current && !tooltipRef.current.contains(event.target as Node)) {
        setIsVisible(false);
      }
    };

    if (isVisible) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isVisible]);
  
  return (
    <div className="tooltip-container" ref={tooltipRef}>
      <div 
        className="tooltip-trigger"
        onMouseEnter={showTooltip}
        onMouseLeave={hideTooltip}
      >
        {children}
      </div>
      {isVisible && (
        <div className={`tooltip tooltip-${position}`}>
          {content}
        </div>
      )}
    </div>
  );
};

export default Tooltip; 