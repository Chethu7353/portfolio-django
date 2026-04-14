from django.urls import path
from .views import home, about, projects, contact_page, contact_api

urlpatterns = [
path('', home),
path('about/', about),
path('projects/', projects),
path('contact/', contact_page),

path('api/contact/', contact_api),
]