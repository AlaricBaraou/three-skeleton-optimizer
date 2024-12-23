import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';

console.log('ReactDOM:', ReactDOM);
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);