from django.shortcuts import render
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.core.mail import send_mail
import json
from .models import Contact


# ------------------ PAGES ------------------

def home(request):
    return render(request, "index.html")


def about(request):
    return render(request, "about.html")


def projects(request):
    return render(request, "projects.html")


def contact_page(request):
    return render(request, "contact.html")


# ------------------ API ------------------

@csrf_exempt
def contact_api(request):
    if request.method == "POST":
        try:
            data = json.loads(request.body)

            name = data.get("name")
            email = data.get("email")
            message = data.get("message")

            # ✅ Validation
            if not name or not email:
                return JsonResponse({
                    "success": False,
                    "error": "Name and Email are required"
                }, status=400)

            # 🚫 BLOCK duplicate email
            if Contact.objects.filter(email=email).exists():
                return JsonResponse({
                    "success": False,
                    "error": "You have already sent a message!"
                }, status=400)

            print("DATA RECEIVED:", data)

            # ✅ Save to MySQL
            Contact.objects.create(
                name=name,
                email=email,
                message=message
            )

            # ✅ Email to YOU
            send_mail(
                subject=f"New Contact from {name}",
                message=f"Name: {name}\nEmail: {email}\n\nMessage:\n{message}",
                from_email="vichetan79.genai@gmail.com",          # 🔁 replace
                recipient_list=["vichetan79.genai@gmail.com"],     # 🔁 replace
                fail_silently=False,
            )

            # ✅ Auto-reply to USER
            send_mail(
                subject="Thanks for contacting me!",
                message="Hi, I received your message. I will get back to you soon.",
                from_email="vichetan79.genai@gmail.com",          # 🔁 replace
                recipient_list=[email],
                fail_silently=False,
            )

            return JsonResponse({
                "success": True,
                "message": "Message sent & saved successfully!"
            })

        except Exception as e:
            print("ERROR:", str(e))
            return JsonResponse({
                "success": False,
                "error": "Something went wrong"
            }, status=500)

    return JsonResponse({
        "error": "Only POST method allowed"
    })