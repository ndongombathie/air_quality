from django.urls import path

from . import views

urlpatterns = [
    path("auth/register", views.RegisterView.as_view(), name="auth-register"),
    path("auth/login", views.LoginView.as_view(), name="auth-login"),
    path("auth/mfa/verify", views.MfaVerifyView.as_view(), name="auth-mfa-verify"),
    path("auth/refresh", views.RefreshView.as_view(), name="auth-refresh"),
    path("auth/logout", views.LogoutView.as_view(), name="auth-logout"),
    path("auth/password/forgot", views.PasswordForgotView.as_view(), name="auth-password-forgot"),
    path("auth/password/reset", views.PasswordResetView.as_view(), name="auth-password-reset"),
    path("me", views.MeView.as_view(), name="me"),
    path("me/notification-preferences", views.NotificationPreferencesView.as_view(), name="me-notification-preferences"),
    path("me/devices", views.DevicesView.as_view(), name="me-devices"),
    path("me/devices/<str:token>", views.DeviceDetailView.as_view(), name="me-device"),
    path("me/alerts", views.MyAlertsView.as_view(), name="me-alerts"),
    path("me/alerts/read-all", views.MyAlertsReadAllView.as_view(), name="me-alerts-read-all"),
    path("me/alerts/<str:alert_id>/read", views.MyAlertReadView.as_view(), name="me-alert-read"),
    path("me/alerts/<str:alert_id>", views.MyAlertDetailView.as_view(), name="me-alert"),
    path("admin/users", views.AdminUsersView.as_view(), name="admin-users"),
    path("admin/users/<str:user_id>", views.AdminUserDetailView.as_view(), name="admin-user"),
]
