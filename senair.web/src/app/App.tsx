import { RouterProvider } from 'react-router-dom';
import { AppProviders } from './providers';
import { router } from './router';
import { PwaUpdatePrompt } from './PwaUpdatePrompt';

export function App() {
  return (
    <AppProviders>
      <PwaUpdatePrompt />
      <RouterProvider router={router} />
    </AppProviders>
  );
}
