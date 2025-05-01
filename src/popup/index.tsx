import React from 'react';
import { createRoot } from 'react-dom/client';
import Popup from './Popup';
import '../styles/popup.css';

const rootElement = document.getElementById('popup-root');
if (!rootElement) throw new Error('Failed to find the popup-root element');

const root = createRoot(rootElement);
root.render(
  <React.StrictMode>
    <Popup />
  </React.StrictMode>
); 