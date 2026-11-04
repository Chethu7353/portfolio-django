from django.urls import path
from .views import home, about, projects, contact_page, contact_api, assistant_api, robots_txt, sitemap_xml

urlpatterns = [
path('', home, name='home'),
path('about/', about, name='about'),
path('projects/', projects, name='projects'),
path('contact/', contact_page, name='contact'),
path('api/contact/', contact_api, name='contact_api'),
path('api/assistant/', assistant_api, name='assistant_api'),
path('robots.txt', robots_txt, name='robots_txt'),
path('sitemap.xml', sitemap_xml, name='sitemap_xml'),
]
