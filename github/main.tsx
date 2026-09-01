import { createRoot } from 'react-dom/client';

import Page from '@/app/page';
import '@/app/globals.css';

const root = document.getElementById('root');

if (!root) {
  throw new Error('Root element not found');
}

createRoot(root).render(<Page />);
