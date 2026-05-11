import { createBrowserRouter, Navigate } from 'react-router-dom';
import { PublicLayout } from '@/components/layout/PublicLayout';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { SettingsLayout } from '@/components/layout/SettingsLayout';
import { EquipmentLayout } from '@/components/layout/EquipmentLayout';
import { RequireStaff } from '@/components/layout/RequireStaff';
import { RequireRole } from '@/components/layout/RequireRole';
import { AdminRoleRedirect } from '@/components/layout/AdminRoleRedirect';
import { HomePage } from '@/pages/public/HomePage';
import { CatalogPage } from '@/pages/public/CatalogPage';
import { EquipmentDetailPage } from '@/pages/public/EquipmentDetailPage';
import { ContactPage } from '@/pages/public/ContactPage';
import { CheckoutSuccessPage } from '@/pages/public/CheckoutSuccessPage';
import { LoginPage } from '@/pages/auth/LoginPage';
import { ForgotPasswordPage } from '@/pages/auth/ForgotPasswordPage';
import { ResetPasswordPage } from '@/pages/auth/ResetPasswordPage';
import { VerifyEmailPage } from '@/pages/auth/VerifyEmailPage';
import { TodayPage } from '@/pages/admin/TodayPage';
import { OverviewPage } from '@/pages/admin/OverviewPage';
import { OrdersListPage } from '@/pages/admin/OrdersListPage';
import { OrderDetailPage } from '@/pages/admin/OrderDetailPage';
import { OrderCreatePage } from '@/pages/admin/OrderCreatePage';
import { EquipmentListPage } from '@/pages/admin/EquipmentListPage';
import { EquipmentEditPage } from '@/pages/admin/EquipmentEditPage';
import { CategoriesPage } from '@/pages/admin/CategoriesPage';
import { ClientsListPage } from '@/pages/admin/ClientsListPage';
import { ClientDetailPage } from '@/pages/admin/ClientDetailPage';
import { CalendarPage } from '@/pages/admin/CalendarPage';
import { WarehousePage } from '@/pages/admin/WarehousePage';
import { ReportsPage } from '@/pages/admin/ReportsPage';
import { PricingPage } from '@/pages/admin/PricingPage';
import { UsersPage } from '@/pages/admin/UsersPage';
import { SettingsNotificationsPage } from '@/pages/admin/settings/NotificationsPage';
import { SettingsOrganizationPage } from '@/pages/admin/settings/OrganizationPage';
import { LegalPage as SettingsLegalPage } from '@/pages/admin/settings/LegalPage';
import { PublicInfoPage as SettingsPublicInfoPage } from '@/pages/admin/settings/PublicInfoPage';
import { SettingsEmailTemplatesPage } from '@/pages/admin/settings/EmailTemplatesPage';
import { LegalDocumentPage } from '@/pages/public/LegalDocumentPage';
import { RentalTermsPage } from '@/pages/public/RentalTermsPage';
import { MyOrderDetailPage } from '@/pages/me/MyOrderDetailPage';
import { MyProfilePage } from '@/pages/me/MyProfilePage';
import { NotFoundPage } from '@/pages/NotFoundPage';
import { ErrorPage } from '@/pages/ErrorPage';

export const router = createBrowserRouter([
  // === ПУБЛИЧНАЯ ВИТРИНА ===
  {
    path: '/',
    element: <PublicLayout />,
    errorElement: <ErrorPage />,
    children: [
      { index: true, element: <HomePage /> },
      { path: 'catalog', element: <CatalogPage /> },
      { path: 'catalog/:categorySlug', element: <CatalogPage /> },
      { path: 'equipment/:id', element: <EquipmentDetailPage /> },
      { path: 'contact', element: <ContactPage /> },
      { path: 'rental-terms', element: <RentalTermsPage /> },
      { path: 'checkout/success', element: <CheckoutSuccessPage /> },
      { path: 'legal/:slug', element: <LegalDocumentPage /> },
    ],
  },

  // === АУТЕНТИФИКАЦИЯ ===
  { path: '/login', element: <LoginPage /> },
  { path: '/forgot-password', element: <ForgotPasswordPage /> },
  { path: '/reset-password', element: <ResetPasswordPage /> },
  { path: '/verify-email', element: <VerifyEmailPage /> },

  // === ЛИЧНЫЙ КАБИНЕТ КЛИЕНТА ===
  {
    path: '/me',
    element: <PublicLayout />,
    children: [
      { index: true, element: <Navigate to="profile" replace /> },
      { path: 'orders', element: <Navigate to="../profile?tab=orders" replace /> },
      { path: 'orders/:id', element: <MyOrderDetailPage /> },
      { path: 'profile', element: <MyProfilePage /> },
    ],
  },

  // === STAFF: ADMIN + MANAGER ===
  {
    path: '/admin',
    element: (
      <RequireStaff>
        <AdminLayout />
      </RequireStaff>
    ),
    errorElement: <ErrorPage />,
    children: [
      // Корень редиректит по роли
      { index: true, element: <AdminRoleRedirect /> },

      // Стартовые страницы
      { path: 'today', element: <TodayPage /> },
      {
        path: 'overview',
        element: (
          <RequireRole role="ADMIN">
            <OverviewPage />
          </RequireRole>
        ),
      },

      // Заказы
      { path: 'orders', element: <OrdersListPage /> },
      { path: 'orders/new', element: <OrderCreatePage /> },
      { path: 'orders/:id', element: <OrderDetailPage /> },

      // Оборудование — единый раздел с табами Каталог/Склад/Категории/Тарифы
      // Редактор и создание карточки идут вне табов (full-screen edit).
      { path: 'equipment/catalog/new', element: <EquipmentEditPage /> },
      { path: 'equipment/catalog/:id', element: <EquipmentEditPage /> },
      {
        path: 'equipment',
        element: <EquipmentLayout />,
        children: [
          { index: true, element: <Navigate to="catalog" replace /> },
          { path: 'catalog', element: <EquipmentListPage /> },
          { path: 'stock', element: <WarehousePage /> },
          { path: 'categories', element: <CategoriesPage /> },
          { path: 'pricing', element: <PricingPage /> },
        ],
      },

      // Клиенты (новый путь /customers, в фазе 2 переедут окончательно)
      { path: 'customers', element: <ClientsListPage /> },
      { path: 'customers/:id', element: <ClientDetailPage /> },

      // Календарь
      { path: 'calendar', element: <CalendarPage /> },

      // Аналитика — только админ
      {
        path: 'analytics',
        element: (
          <RequireRole role="ADMIN">
            <ReportsPage />
          </RequireRole>
        ),
      },

      // Настройки — только админ
      {
        path: 'settings',
        element: (
          <RequireRole role="ADMIN">
            <SettingsLayout />
          </RequireRole>
        ),
        children: [
          { index: true, element: <Navigate to="organization" replace /> },
          { path: 'users', element: <UsersPage /> },
          { path: 'notifications', element: <SettingsNotificationsPage /> },
          { path: 'email-templates', element: <SettingsEmailTemplatesPage /> },
          { path: 'organization', element: <SettingsOrganizationPage /> },
          { path: 'public', element: <SettingsPublicInfoPage /> },
          { path: 'legal', element: <SettingsLegalPage /> },
        ],
      },

      // === LEGACY-РЕДИРЕКТЫ — закладки старых URL не должны ломаться ===
      { path: 'dashboard', element: <AdminRoleRedirect /> },
      { path: 'catalog', element: <Navigate to="/admin/equipment/catalog" replace /> },
      { path: 'catalog/new', element: <Navigate to="/admin/equipment/catalog/new" replace /> },
      { path: 'catalog/:id', element: <LegacyCatalogId /> },
      { path: 'warehouse', element: <Navigate to="/admin/equipment/stock" replace /> },
      { path: 'categories', element: <Navigate to="/admin/equipment/categories" replace /> },
      { path: 'clients', element: <Navigate to="/admin/customers" replace /> },
      { path: 'clients/:id', element: <LegacyClientId /> },
      { path: 'reports', element: <Navigate to="/admin/analytics" replace /> },
      { path: 'requests', element: <Navigate to="/admin/orders?tab=inbox" replace /> },
      { path: 'users', element: <Navigate to="/admin/settings/users" replace /> },
    ],
  },

  { path: '*', element: <NotFoundPage /> },
]);

// Маленькие хелперы для редиректов с :id — Navigate-компонент не понимает params напрямую.
function LegacyCatalogId() {
  const { pathname } = window.location;
  const id = pathname.split('/').pop();
  return <Navigate to={`/admin/equipment/catalog/${id}`} replace />;
}

function LegacyClientId() {
  const { pathname } = window.location;
  const id = pathname.split('/').pop();
  return <Navigate to={`/admin/customers/${id}`} replace />;
}
