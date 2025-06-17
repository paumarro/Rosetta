import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import './index.css';
import { AuthWrapper } from '@/contexts/AuthWrapper';

// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthWrapper />
  </StrictMode>,
);
