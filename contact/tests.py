import json
from unittest.mock import patch

from django.core.cache import cache
from django.template.context import BaseContext
from django.test import Client, TestCase
from django.urls import reverse

from .models import Contact
from .views import GITHUB_FALLBACK

# Django 5.2's Context copy helper relies on copying a `super()` proxy, which
# raises in this Python 3.14 runtime. Keep template capture enabled with the
# equivalent shallow-copy behavior expected by Django's test client.
def _python314_context_copy(self):
    duplicate = object.__new__(type(self))
    duplicate.__dict__.update(self.__dict__)
    duplicate.dicts = self.dicts[:]
    return duplicate


BaseContext.__copy__ = _python314_context_copy


class PortfolioPageTests(TestCase):
    def setUp(self):
        cache.clear()

    @patch("contact.views._github_data", return_value=(GITHUB_FALLBACK, True))
    def test_home_renders_all_main_sections(self, _github):
        response = self.client.get(reverse("home"))
        self.assertEqual(response.status_code, 200)
        for section in (b"PORTFOLIO", b"about", b"skills", b"projects", b"experience", b"github", b"contact"):
            self.assertIn(section.lower(), response.content.lower())
        self.assertIn(b"profile-source.", response.content)

    def test_legacy_pages_redirect_to_single_page_sections(self):
        for route, section in (("about", "about"), ("projects", "projects"), ("contact", "contact")):
            response = self.client.get(reverse(route))
            self.assertRedirects(response, f"/#%s" % section, fetch_redirect_response=False)

    def test_robots_and_sitemap_are_available(self):
        self.assertEqual(self.client.get(reverse("robots_txt")).status_code, 200)
        sitemap = self.client.get(reverse("sitemap_xml"))
        self.assertEqual(sitemap.status_code, 200)
        self.assertContains(sitemap, "sitemaps.org")


class ContactEndpointTests(TestCase):
    def setUp(self):
        cache.clear()

    def test_contact_requires_csrf(self):
        client = Client(enforce_csrf_checks=True)
        response = client.post(reverse("contact_api"), data="{}", content_type="application/json")
        self.assertEqual(response.status_code, 403)

    def test_contact_saves_valid_message(self):
        response = self.client.post(reverse("contact_api"), data=json.dumps({
            "name": "Visitor", "email": "visitor@example.com", "subject": "A project", "message": "Let's talk.",
        }), content_type="application/json")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(Contact.objects.get().subject, "A project")

    def test_contact_rejects_invalid_email(self):
        response = self.client.post(reverse("contact_api"), data=json.dumps({
            "name": "Visitor", "email": "not-an-email", "subject": "Hello", "message": "A note.",
        }), content_type="application/json")
        self.assertEqual(response.status_code, 400)
        self.assertEqual(Contact.objects.count(), 0)


class AssistantEndpointTests(TestCase):
    def setUp(self):
        cache.clear()

    def test_unrelated_questions_are_kept_in_scope_without_gemini(self):
        response = self.client.post(reverse("assistant_api"), data=json.dumps({"message": "Write me a poem about the ocean"}), content_type="application/json")
        self.assertEqual(response.status_code, 200)
        self.assertIn("portfolio", response.json()["answer"])

    @patch.dict("os.environ", {"GEMINI_API_KEY": ""})
    def test_assistant_handles_missing_api_configuration(self):
        response = self.client.post(reverse("assistant_api"), data=json.dumps({"message": "What does Chetan know about Python?"}), content_type="application/json")
        self.assertEqual(response.status_code, 503)
        self.assertFalse(response.json()["success"])
