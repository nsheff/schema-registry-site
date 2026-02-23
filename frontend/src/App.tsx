import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import { Layout } from './components/Layout';
import { Home } from './pages/Home';
import { Namespace } from './pages/Namespace';
import { Schema } from './pages/Schema';
import { Version } from './pages/Version';
import { Component } from './pages/Component';

const router = createBrowserRouter(
  [
    {
      element: <Layout />,
      children: [
        {
          path: '/',
          element: <Home />,
        },
        {
          path: '/:namespace',
          element: <Namespace />,
          handle: {
            crumb: (p: Record<string, string>) => ({
              label: p.namespace,
              to: `/${p.namespace}`,
            }),
          },
        },
        {
          path: '/:namespace/:schema',
          element: <Schema />,
          handle: {
            crumb: (p: Record<string, string>) => ({
              label: p.schema,
              to: `/${p.namespace}/${p.schema}`,
            }),
          },
        },
        {
          path: '/:namespace/:schema/:version',
          element: <Version />,
          handle: {
            crumb: (p: Record<string, string>) => ({
              label: `${p.schema}@${p.version}`,
              to: `/${p.namespace}/${p.schema}/${p.version}`,
            }),
          },
        },
        {
          path: '/:namespace/:schema/:version/:component',
          element: <Component />,
          handle: {
            crumb: (p: Record<string, string>) => ({
              label: p.component,
              to: `/${p.namespace}/${p.schema}/${p.version}/${p.component}`,
            }),
          },
        },
      ],
    },
  ],
  { basename: import.meta.env.BASE_URL }
);

export default function App() {
  return <RouterProvider router={router} />;
}
