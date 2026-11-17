# Chetan Kumar — Personal Portfolio

A personal developer portfolio built with **Django**, showcasing my background, technical skills, selected projects, résumé, and contact information.

**Live website:** https://portfolio-django-59h8.onrender.com/  
**GitHub repository:** https://github.com/Chethu7353/portfolio-django

---

## Overview

This project is the online home for my software development work. It presents my interests in software engineering, AI, and data science through a portfolio experience with dedicated sections for my profile, skills, projects, professional journey, and contact information.

The application is powered by Django and uses server-rendered HTML templates with custom CSS and JavaScript.

## Features

- Portfolio landing page and navigation.
- About section presenting my background and interests.
- Skills section organised into engineering, data and AI, and systems categories.
- Project showcase with links to selected repositories.
- Downloadable résumé.
- Contact form connected to a Django API endpoint.
- Google Gemini API configuration for the AI-assisted functionality implemented in the application.
- Resend API and optional SMTP email configuration.
- Responsive interface with interactive navigation and light/dark theme support.
- Production static-file handling with WhiteNoise.
- Optional PostgreSQL database configuration; SQLite is used by default.

## Technology Stack

| Area | Technologies |
| --- | --- |
| Backend | Python, Django 5.2 |
| Frontend | HTML5, CSS3, JavaScript, Django Templates |
| Database | SQLite, PostgreSQL (optional) |
| AI integration | Google Gemini API |
| Email integration | Resend API, optional SMTP |
| Production server | Gunicorn |
| Static files | WhiteNoise |
| Configuration | Environment variables, python-dotenv |
| Deployment | Render-compatible configuration |

## Project Structure

```text
portfolio-django/
├── backend/                # Django project settings and URL configuration
├── contact/                # Contact application, API, models and tests
├── static/
│   ├── css/                # Stylesheets
│   ├── js/                 # Frontend JavaScript
│   ├── images/             # Images and icons
│   └── ...                 # Other static assets
├── templates/              # Django HTML templates and PDF assets
├── .env.example            # Environment variable template
├── .gitignore
├── build.sh                # Install, migrate and collect static files
├── manage.py
└── requirements.txt
```

## Run Locally

### 1. Clone the repository

```bash
git clone https://github.com/Chethu7353/portfolio-django.git
cd portfolio-django
```

### 2. Create and activate a virtual environment

**Windows (PowerShell):**

```powershell
python -m venv venv
.\venv\Scripts\Activate.ps1
```

**macOS / Linux:**

```bash
python3 -m venv venv
source venv/bin/activate
```

### 3. Install dependencies

```bash
python -m pip install --upgrade pip
pip install -r requirements.txt
```

### 4. Configure environment variables

Copy the example environment file:

**Windows (PowerShell):**

```powershell
Copy-Item .env.example .env
```

**macOS / Linux:**

```bash
cp .env.example .env
```

Update the values in `.env` as required:

| Variable | Purpose |
| --- | --- |
| `DJANGO_SECRET_KEY` | Django secret key. Use a unique, secure value. |
| `DEBUG` or `DJANGO_DEBUG` | Enables or disables Django debug mode. |
| `DJANGO_ALLOWED_HOSTS` | Comma-separated allowed host names. |
| `CSRF_TRUSTED_ORIGINS` | Trusted origins, including scheme, such as `https://example.com`. |
| `DATABASE_URL` | Optional PostgreSQL connection URL. Leave empty to use SQLite. |
| `GEMINI_API_KEY` | API key for configured Gemini functionality. |
| `GEMINI_MODEL` | Gemini model name used by the application. |
| `RESEND_API_KEY` | Resend API key for email delivery, if enabled. |
| `DEFAULT_FROM_EMAIL` | Sender address for outgoing contact emails. |
| `CONTACT_RECEIVER_EMAIL` | Inbox that should receive contact messages. |

Only use real credentials in your local, untracked `.env` file or your hosting provider's environment settings. Never commit API keys or production secrets.

### 5. Apply database migrations

```bash
python manage.py migrate
```

### 6. Start the development server

```bash
python manage.py runserver
```

Open http://127.0.0.1:8000/ in your browser.

## Deployment

The repository includes a `build.sh` script that installs dependencies, applies database migrations, and collects static files:

```bash
bash build.sh
```

A typical Gunicorn start command is:

```bash
gunicorn backend.wsgi:application
```

For production deployment:

1. Set `DEBUG=False` (or `DJANGO_DEBUG=False`).
2. Set a strong `DJANGO_SECRET_KEY`.
3. Configure `DJANGO_ALLOWED_HOSTS` and any required `CSRF_TRUSTED_ORIGINS`.
4. Add the Gemini and email environment variables required by the features you use.
5. Optionally configure `DATABASE_URL` with a PostgreSQL connection URL. Without it, the project uses SQLite.
6. Configure your hosting provider to run the build script and Gunicorn start command.

The Django settings include Render-aware host and HTTPS handling. Review the database persistence and environment-variable settings provided by your hosting provider before deploying.

## Selected Projects

Projects showcased in the portfolio include:

- **GeerGoo** — an AI-powered log intelligence and root-cause analysis platform.
- **KKRTC — Where Is My Bus?** — a public transit tracking application focused on improving bus journey visibility.
- **Smart Attendance Monitoring System** — an IoT-based attendance monitoring project.
- **Portfolio Website** — this Django application.

Project descriptions and development statuses may evolve as the projects are updated.

## Connect

- **Portfolio:** https://portfolio-django-59h8.onrender.com/
- **GitHub:** https://github.com/Chethu7353
- **LinkedIn:** https://www.linkedin.com/in/a-chetan-kumar-74235b328/
- **LeetCode:** https://leetcode.com/u/A_Chetan_Kumar/

---

Built by **A. Chetan Kumar**.
