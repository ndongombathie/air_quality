from django.urls import path

from . import views

urlpatterns = [
    path("articles", views.ArticleListView.as_view(), name="articles"),
    path("articles/<str:slug>", views.ArticleDetailView.as_view(), name="article"),
    path("admin/articles", views.AdminArticleListView.as_view(), name="admin-articles"),
    path("admin/articles/<str:article_id>", views.AdminArticleDetailView.as_view(), name="admin-article"),
    path("admin/media", views.MediaUploadView.as_view(), name="admin-media"),
]
