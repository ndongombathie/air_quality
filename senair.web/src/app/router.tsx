import { lazy, Suspense, type ComponentType, type LazyExoticComponent } from 'react';
import { createBrowserRouter, type RouteObject } from 'react-router-dom';
import type { Permission } from '@senair/core';
import { PublicLayout } from '../shared/layout/PublicLayout';
import { NotFoundPage, RouteError } from '../shared/layout/RouteError';
import { LoadingState } from '../shared/ui/QueryState';
import { RequireAuth, RequirePermission } from '../features/auth/guards';
import { ADMIN_NAV } from '../features/admin/adminNav';

/** Chargement différé d'un export nommé (code splitting par page). */
function page<M extends Record<string, unknown>, K extends keyof M & string>(loader: () => Promise<M>, name: K): LazyExoticComponent<ComponentType> {
  return lazy(async () => ({ default: (await loader())[name] as ComponentType }));
}

const HomePage = page(() => import('../features/air-quality/HomePage'), 'HomePage');
const ZonePage = page(() => import('../features/air-quality/ZonePage'), 'ZonePage');
const StationPage = page(() => import('../features/air-quality/StationPage'), 'StationPage');
const MapPage = page(() => import('../features/map/MapPage'), 'MapPage');
const ForecastsPage = page(() => import('../features/forecasts/ForecastsPage'), 'ForecastsPage');
const AlertsPage = page(() => import('../features/alerts/AlertsPage'), 'AlertsPage');
const HealthPage = page(() => import('../features/health/HealthPage'), 'HealthPage');
const ArticlesPage = page(() => import('../features/content/ArticlesPage'), 'ArticlesPage');
const ArticlePage = page(() => import('../features/content/ArticlePage'), 'ArticlePage');
const InfoPage = page(() => import('../features/content/InfoPage'), 'InfoPage');
const LoginPage = page(() => import('../features/auth/LoginPage'), 'LoginPage');
const RegisterPage = page(() => import('../features/auth/RegisterPage'), 'RegisterPage');
const ForgotPasswordPage = page(() => import('../features/auth/ForgotPasswordPage'), 'ForgotPasswordPage');
const ResetPasswordPage = page(() => import('../features/auth/ResetPasswordPage'), 'ResetPasswordPage');

const AccountLayout = page(() => import('../features/account/AccountLayout'), 'AccountLayout');
const AccountDashboardPage = page(() => import('../features/account/AccountDashboardPage'), 'AccountDashboardPage');
const ProfilePage = page(() => import('../features/account/ProfilePage'), 'ProfilePage');
const NotificationsPage = page(() => import('../features/account/NotificationsPage'), 'NotificationsPage');
const MyAlertsPage = page(() => import('../features/account/MyAlertsPage'), 'MyAlertsPage');

const AdminLayout = page(() => import('../features/admin/AdminLayout'), 'AdminLayout');
const ADMIN_PAGES: Record<string, LazyExoticComponent<ComponentType>> = {
  '': page(() => import('../features/admin/DashboardPage'), 'DashboardPage'),
  alertes: page(() => import('../features/admin/AlertsAdminPage'), 'AlertsAdminPage'),
  analytique: page(() => import('../features/admin/AnalyticsPage'), 'AnalyticsPage'),
  rapports: page(() => import('../features/admin/ReportsPage'), 'ReportsPage'),
  articles: page(() => import('../features/admin/ArticlesAdminPage'), 'ArticlesAdminPage'),
  stations: page(() => import('../features/admin/StationsPage'), 'StationsPage'),
  seuils: page(() => import('../features/admin/ThresholdsPage'), 'ThresholdsPage'),
  sources: page(() => import('../features/admin/DataSourcesPage'), 'DataSourcesPage'),
  modeles: page(() => import('../features/admin/ModelsPage'), 'ModelsPage'),
  utilisateurs: page(() => import('../features/admin/UsersPage'), 'UsersPage'),
  audit: page(() => import('../features/admin/AuditLogPage'), 'AuditLogPage'),
  export: page(() => import('../features/admin/ExportPage'), 'ExportPage'),
};
const ArticleEditorPage = page(() => import('../features/admin/ArticleEditorPage'), 'ArticleEditorPage');

const guarded = (permission: Permission, Component: ComponentType) => (
  <RequirePermission permission={permission}>
    <Component />
  </RequirePermission>
);

/** Chaque sous-page admin est protégée par la permission déclarée dans ADMIN_NAV. */
const adminChildren: RouteObject[] = [
  ...ADMIN_NAV.map((item): RouteObject => {
    const Component = ADMIN_PAGES[item.path];
    if (!Component) throw new Error(`Page d'administration manquante : ${item.path}`);
    return item.path === '' ? { index: true, element: guarded(item.permission, Component) } : { path: item.path, element: guarded(item.permission, Component) };
  }),
  { path: 'articles/:articleId', element: guarded('articles:manage', ArticleEditorPage) },
  { path: '*', element: <NotFoundPage /> },
];

export const routes: RouteObject[] = [
  {
    path: '/',
    element: <PublicLayout />,
    errorElement: <RouteError />,
    children: [
      { index: true, element: <HomePage /> },
      { path: 'carte', element: <MapPage /> },
      { path: 'previsions', element: <ForecastsPage /> },
      { path: 'alertes', element: <AlertsPage /> },
      { path: 'sante', element: <HealthPage /> },
      { path: 'infos', element: <InfoPage /> },
      { path: 'articles', element: <ArticlesPage /> },
      { path: 'articles/:slug', element: <ArticlePage /> },
      { path: 'zones/:zoneId', element: <ZonePage /> },
      { path: 'stations/:stationId', element: <StationPage /> },
      { path: 'connexion', element: <LoginPage /> },
      { path: 'inscription', element: <RegisterPage /> },
      { path: 'mot-de-passe-oublie', element: <ForgotPasswordPage /> },
      { path: 'reinitialiser-mot-de-passe', element: <ResetPasswordPage /> },
      {
        path: 'mon-espace',
        element: (
          <RequireAuth>
            <AccountLayout />
          </RequireAuth>
        ),
        children: [
          { index: true, element: <AccountDashboardPage /> },
          { path: 'alertes', element: <MyAlertsPage /> },
          { path: 'notifications', element: guarded('notifications:manage', NotificationsPage) },
          { path: 'profil', element: guarded('profile:manage', ProfilePage) },
        ],
      },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
  {
    path: '/admin',
    errorElement: <RouteError />,
    element: (
      <RequirePermission permission="admin:access">
        <Suspense fallback={<LoadingState label="Chargement de l'administration…" />}>
          <AdminLayout />
        </Suspense>
      </RequirePermission>
    ),
    children: adminChildren,
  },
];

export const router = createBrowserRouter(routes);
