import React from 'react';
import '../../styles/popup.css';
import { Clock } from 'lucide-react';

interface DayDividerProps {
  date: Date;
}

const DayDivider: React.FC<DayDividerProps> = ({ date }) => {
  const formatDay = () => {
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    
    if (isSameDay(date, today)) {
      return 'Today';
    } else if (isSameDay(date, yesterday)) {
      return 'Yesterday';
    } else {
      return date.toLocaleDateString('en-US', { 
        month: 'long', 
        day: 'numeric'
      });
    }
  };
  
  const isSameDay = (date1: Date, date2: Date) => {
    return (
      date1.getDate() === date2.getDate() &&
      date1.getMonth() === date2.getMonth() &&
      date1.getFullYear() === date2.getFullYear()
    );
  };
  
  return (
    <div className="day-divider">
      <Clock size={18} className="day-divider-icon" />
      {formatDay()}
    </div>
  );
};

export default DayDivider; 