import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { Provider } from 'react-redux';
import store from './redux/store';
import App from './App';

// Import CSS
import 'bootstrap/dist/css/bootstrap.min.css';
import 'react-toastify/dist/ReactToastify.css';

// 🛡️ Global Error Handler - Fix "timer is not defined" và các lỗi tương tự
window.addEventListener('error', (event) => {
  // Suppress errors from external scripts (custom.min.js, jquery.bundles.js)
  if (event.filename && (event.filename.includes('custom.min.js') || 
                          event.filename.includes('jquery.bundles.js') ||
                          event.message.includes('timer is not defined'))) {
    console.warn('⚠️ Suppressed external script error:', event.message);
    event.preventDefault();
    return true;
  }
});

// Define global timer variable nếu chưa có
if (typeof window.timer === 'undefined') {
  window.timer = null;
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <Provider store={store}>
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <App />
    </BrowserRouter>
  </Provider>
);