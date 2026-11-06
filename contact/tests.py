import json
from unittest.mock import MagicMock, patch

from django.core.cache import cache
from django.template.context import BaseContext
from django.test import Client, TestCase, override_settings
from django.urls import reverse
from google.genai import errors

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
            self.assertRedirects(response, f"/#{section}", fetch_redirect_response=False)

    def test_robots_and_sitemap_are_available(self):
        self.assertEqual(self.client.get(reverse("robots_txt")).status_code, 200)
        sitemap = self.client.get(reverse("sitemap_xml"))
        self.assertEqual(sitemap.status_code, 200)
        self.assertContains(sitemap, "sitemaps.org")

    @patch("contact.views._github_data", return_value=(GITHUB_FALLBACK, True))
    def test_kkrtc_project_rendered_and_agricultural_removed(self, _github):
        response = self.client.get(reverse("home"))
        self.assertEqual(response.status_code, 200)
        # Verify KKRTC project is rendered
        self.assertContains(response, "KKRTC – Where Is My Bus?")
        self.assertContains(response, "Real-time public transportation tracking")
        self.assertContains(response, "https://github.com/Chethu7353/KKRTC")
        self.assertContains(response, "visual-kkrtc")
        # Verify Agricultural project is completely removed
        self.assertNotContains(response, "Agricultural Data")
        self.assertNotContains(response, "Chethu7353/ML_Projects")
        self.assertNotContains(response, "visual-field")
        # Verify other projects remain intact
        self.assertContains(response, "GeerGoo")
        self.assertContains(response, "Resume Maker")
        self.assertContains(response, "Smart Attendance")
        self.assertContains(response, "AirDeck")


class ContactEndpointTests(TestCase):
    def setUp(self):
        cache.clear()

    def test_contact_requires_csrf_when_enforced(self):
        client = Client(enforce_csrf_checks=True)
        response = client.post(reverse("contact_api"), data="{}", content_type="application/json")
        self.assertEqual(response.status_code, 403)

    def test_contact_saves_valid_message_and_persists_in_database(self):
        response = self.client.post(
            reverse("contact_api"),
            data=json.dumps({
                "name": "Jane Doe",
                "email": "jane@example.com",
                "subject": "Freelance Opportunity",
                "message": "Hi Chetan, I love your portfolio and would like to discuss a project.",
            }),
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.json()["success"])
        self.assertEqual(Contact.objects.count(), 1)
        record = Contact.objects.first()
        self.assertEqual(record.name, "Jane Doe")
        self.assertEqual(record.email, "jane@example.com")
        self.assertEqual(record.subject, "Freelance Opportunity")
        self.assertIn("Freelance Opportunity", str(record))

    @override_settings(
        CONTACT_RECEIVER_EMAIL="owner@example.com",
        DEFAULT_FROM_EMAIL="sender@example.com",
        EMAIL_HOST="smtp.example.com",
    )
    @patch("contact.views.send_mail")
    def test_contact_sends_email_when_smtp_configured(self, mock_send_mail):
        response = self.client.post(
            reverse("contact_api"),
            data=json.dumps({
                "name": "Alex",
                "email": "alex@example.com",
                "subject": "Collaboration",
                "message": "Let's collaborate on an open source project.",
            }),
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 200)
        self.assertTrue(mock_send_mail.called)
        call_kwargs = mock_send_mail.call_args[1]
        self.assertEqual(call_kwargs["recipient_list"], ["owner@example.com"])
        self.assertEqual(call_kwargs["from_email"], "sender@example.com")
        self.assertIn("Collaboration", call_kwargs["subject"])
        self.assertIn("Alex", call_kwargs["message"])

    @override_settings(
        CONTACT_RECEIVER_EMAIL="owner@example.com",
        DEFAULT_FROM_EMAIL="sender@example.com",
        EMAIL_HOST="smtp.example.com",
    )
    @patch("contact.views.send_mail", side_effect=Exception("SMTP Connection Error"))
    def test_contact_gracefully_handles_email_delivery_failure(self, mock_send_mail):
        """When SMTP fails, message must still be saved to the database and not return 500."""
        response = self.client.post(
            reverse("contact_api"),
            data=json.dumps({
                "name": "Alex",
                "email": "alex@example.com",
                "subject": "Project Proposal",
                "message": "Testing SMTP failure resiliency.",
            }),
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.json()["success"])
        self.assertEqual(Contact.objects.count(), 1)
        self.assertEqual(Contact.objects.first().subject, "Project Proposal")

    def test_contact_rejects_invalid_email(self):
        response = self.client.post(
            reverse("contact_api"),
            data=json.dumps({
                "name": "Visitor",
                "email": "not-an-email",
                "subject": "Hello",
                "message": "A test note.",
            }),
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 400)
        self.assertFalse(response.json()["success"])
        self.assertIn("valid email", response.json()["error"].lower())
        self.assertEqual(Contact.objects.count(), 0)

    def test_contact_rejects_missing_fields(self):
        # Missing name
        res = self.client.post(reverse("contact_api"), data=json.dumps({"email": "a@b.com", "subject": "S", "message": "M"}), content_type="application/json")
        self.assertEqual(res.status_code, 400)
        # Missing subject
        res = self.client.post(reverse("contact_api"), data=json.dumps({"name": "N", "email": "a@b.com", "message": "M"}), content_type="application/json")
        self.assertEqual(res.status_code, 400)
        # Missing message
        res = self.client.post(reverse("contact_api"), data=json.dumps({"name": "N", "email": "a@b.com", "subject": "S"}), content_type="application/json")
        self.assertEqual(res.status_code, 400)
        self.assertEqual(Contact.objects.count(), 0)

    def test_contact_prevents_duplicate_submissions(self):
        payload = json.dumps({
            "name": "Repeat Visitor",
            "email": "repeat@example.com",
            "subject": "Same Subject",
            "message": "Same identical message text.",
        })
        first_resp = self.client.post(reverse("contact_api"), data=payload, content_type="application/json")
        self.assertEqual(first_resp.status_code, 200)
        self.assertEqual(Contact.objects.count(), 1)

        # Immediate duplicate submission
        second_resp = self.client.post(reverse("contact_api"), data=payload, content_type="application/json")
        self.assertEqual(second_resp.status_code, 409)
        self.assertFalse(second_resp.json()["success"])
        self.assertIn("already been submitted", second_resp.json()["error"])
        # Should not create a second record
        self.assertEqual(Contact.objects.count(), 1)

    def test_contact_honeypot_silently_ignores_spam(self):
        payload = json.dumps({
            "name": "Bot User",
            "email": "bot@example.com",
            "subject": "Buy now",
            "message": "Spam message content",
            "website": "http://spam-link.com",
        })
        response = self.client.post(reverse("contact_api"), data=payload, content_type="application/json")
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.json()["success"])
        # Bot message must NOT be saved to the database
        self.assertEqual(Contact.objects.count(), 0)

    def test_contact_rate_limiting(self):
        for i in range(5):
            payload = json.dumps({
                "name": f"User {i}",
                "email": f"user{i}@example.com",
                "subject": f"Subject {i}",
                "message": f"Message {i}",
            })
            resp = self.client.post(reverse("contact_api"), data=payload, content_type="application/json")
            self.assertEqual(resp.status_code, 200)

        # 6th request should hit rate limit
        blocked = self.client.post(reverse("contact_api"), data=json.dumps({
            "name": "User 6",
            "email": "user6@example.com",
            "subject": "Subject 6",
            "message": "Message 6",
        }), content_type="application/json")
        self.assertEqual(blocked.status_code, 429)


class AssistantEndpointTests(TestCase):
    def setUp(self):
        cache.clear()

    @override_settings(GEMINI_API_KEY="test-mock-gemini-key")
    @patch("contact.views.genai.Client")
    def test_assistant_valid_message_returns_answer(self, mock_client_class):
        mock_client = MagicMock()
        mock_response = MagicMock(text="Chetan is a Software Engineer specializing in AI, Data Science, and Full Stack Development.")
        mock_client.models.generate_content.return_value = mock_response
        mock_client_class.return_value = mock_client

        response = self.client.post(
            reverse("assistant_api"),
            data=json.dumps({"message": "What does Chetan work on?"}),
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertTrue(data["success"])
        self.assertIn("Software Engineer", data["answer"])
        self.assertTrue(mock_client.models.generate_content.called)

    def test_assistant_empty_message_returns_bad_request(self):
        response = self.client.post(
            reverse("assistant_api"),
            data=json.dumps({"message": "   "}),
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 400)
        self.assertFalse(response.json()["success"])
        self.assertIn("question", response.json()["error"].lower())

    @override_settings(GEMINI_API_KEY="")
    @patch.dict("os.environ", {"GEMINI_API_KEY": ""})
    def test_assistant_handles_missing_api_configuration(self):
        response = self.client.post(
            reverse("assistant_api"),
            data=json.dumps({"message": "Tell me about Chetan's projects"}),
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 503)
        self.assertFalse(response.json()["success"])
        self.assertIn("unconfigured", response.json()["error"].lower())

    @override_settings(GEMINI_API_KEY="test-mock-gemini-key")
    @patch("contact.views.genai.Client")
    def test_assistant_gemini_api_failure_handled_gracefully(self, mock_client_class):
        mock_client = MagicMock()
        mock_client.models.generate_content.side_effect = errors.APIError(500, "Internal Server Error")
        mock_client_class.return_value = mock_client

        response = self.client.post(
            reverse("assistant_api"),
            data=json.dumps({"message": "What is KKRTC?"}),
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 503)
        self.assertFalse(response.json()["success"])
        self.assertIn("encountered an error", response.json()["error"])

    @override_settings(GEMINI_API_KEY="test-mock-gemini-key")
    @patch("contact.views.genai.Client")
    def test_assistant_timeout_handled_gracefully(self, mock_client_class):
        mock_client = MagicMock()
        mock_client.models.generate_content.side_effect = TimeoutError("Request timed out")
        mock_client_class.return_value = mock_client

        response = self.client.post(
            reverse("assistant_api"),
            data=json.dumps({"message": "Tell me about GeerGoo"}),
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 504)
        self.assertFalse(response.json()["success"])
        self.assertIn("timed out", response.json()["error"])

    def test_assistant_invalid_request_methods_and_payloads(self):
        # GET method not allowed
        get_resp = self.client.get(reverse("assistant_api"))
        self.assertEqual(get_resp.status_code, 405)

        # Invalid JSON payload
        bad_json = self.client.post(reverse("assistant_api"), data="not a json {", content_type="application/json")
        self.assertEqual(bad_json.status_code, 400)

        # Question exceeding length limit (over 800 characters)
        too_long = self.client.post(
            reverse("assistant_api"),
            data=json.dumps({"message": "a" * 850}),
            content_type="application/json",
        )
        self.assertEqual(too_long.status_code, 400)

    @override_settings(GEMINI_API_KEY="test-mock-gemini-key")
    @patch("contact.views.genai.Client")
    def test_assistant_maintains_conversation_context(self, mock_client_class):
        mock_client = MagicMock()
        mock_response = MagicMock(text="KKRTC is a real-time public transportation tracking app built with Flutter and Django.")
        mock_client.models.generate_content.return_value = mock_response
        mock_client_class.return_value = mock_client

        history = [
            {"role": "user", "text": "What projects has Chetan built?"},
            {"role": "model", "text": "He built KKRTC, GeerGoo, Resume Maker, Smart Attendance, and AirDeck."},
        ]

        response = self.client.post(
            reverse("assistant_api"),
            data=json.dumps({
                "message": "Tell me more about KKRTC.",
                "history": history,
            }),
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.json()["success"])

        # Check call arguments passed to generate_content
        call_kwargs = mock_client.models.generate_content.call_args[1]
        contents = call_kwargs["contents"]
        # History (2) + Current Question (1) = 3 turns
        self.assertEqual(len(contents), 3)
        self.assertEqual(contents[0].role, "user")
        self.assertEqual(contents[0].parts[0].text, "What projects has Chetan built?")
        self.assertEqual(contents[1].role, "model")
        self.assertEqual(contents[2].role, "user")
        self.assertEqual(contents[2].parts[0].text, "Tell me more about KKRTC.")
