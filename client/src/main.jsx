import ReactDOM from 'react-dom/client';
import './i18n/index.jsx';
import './index.css';
import App from './App.jsx';
import ErrorBoundary from './components/ErrorBoundary.jsx';
import { initWebVitals } from './utils/reportWebVitals';

initWebVitals();

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
);
