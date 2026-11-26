# SmartWork: Installation and User Guide

How to install SmartWork on a Windows PC, connect Telegram once, and how the daily alert works.

**Contents**

1. [What you are installing](#1-what-you-are-installing)
2. [What you need](#2-what-you-need)
3. [Install Docker Desktop](#3-install-docker-desktop)
4. [Set up Appwrite (the database)](#4-set-up-appwrite-the-database)
5. [Connect Telegram (one time)](#5-connect-telegram-one-time)
6. [Create the settings file](#6-create-the-settings-file)
7. [Start SmartWork](#7-start-smartwork)
8. [Check that it works](#8-check-that-it-works)
9. [How it works](#9-how-it-works)
10. [Everyday commands](#10-everyday-commands)
11. [Limits to know about](#11-limits-to-know-about)
12. [Troubleshooting](#12-troubleshooting)

---

## 1. What you are installing

```text
        YOUR WINDOWS PC (Docker Desktop)                      INTERNET
 +---------------------------------------------+
 |  Container: web                             |
 |  SmartWork website on port 3000             |<-----> Appwrite Cloud
 |                                             |        users, tasks, projects, images
 |  Container: digest                          |<-----> Appwrite Cloud (reads tasks)
 |  Sends the alert at 07:00 every day         |------> Telegram -----> your group
 +---------------------------------------------+
```

| Part | Where it runs | What it does |
| --- | --- | --- |
| `web` | Docker, on your PC | The SmartWork website |
| `digest` | Docker, on your PC | Reads unfinished tasks and sends the Telegram alert |
| Appwrite | **Appwrite Cloud, not on your PC** | Stores accounts, workspaces, projects, tasks and images |
| Telegram | Telegram's servers | Delivers the message to your phones |

You do not install Node.js or any other programming tool on Windows. Both SmartWork parts run inside Docker.

> **Important:** SmartWork itself is dockerized, but the database is not part of this Docker setup. The PC needs internet access for login, tasks and alerts. Deleting the containers does not delete your tasks, because they are stored in Appwrite.

---

## 2. What you need

- Windows 11 (23H2 or newer) or Windows 10 (22H2), 64-bit. Docker lists Pro, Enterprise and Education as the supported editions.
- 8 GB RAM or more, with virtualization enabled in the BIOS/UEFI.
- An internet connection.
- A free [Appwrite Cloud](https://cloud.appwrite.io) account.
- A Telegram account.
- The SmartWork project folder, copied to the PC. This guide uses `C:\SmartWork`. The file `docker-compose.yml` must be directly inside it.

Docker Desktop is free for personal use and small businesses. Companies with more than 250 employees **or** more than $10 million in yearly revenue need a paid Docker subscription.

---

## 3. Install Docker Desktop

1. Right-click **Start**, open **Terminal (Admin)** and run:

   ```powershell
   wsl --install
   ```

   If WSL is already installed, run `wsl --update` instead. Docker needs WSL 2.1.5 or newer (`wsl --version` shows yours).

2. **Restart the PC.**
3. Download Docker Desktop from <https://docs.docker.com/desktop/setup/install/windows-install/>, install it, and keep **Use WSL 2** selected.
4. Open Docker Desktop and wait until it says the engine is running.
5. Open **Settings > General** and turn on **Start Docker Desktop when you sign in to your computer**. It is **off** by default. Without it, SmartWork and the alerts do not come back after a restart.
6. Check it in a normal PowerShell window:

   ```powershell
   docker --version
   docker compose version
   ```

   Both should print a version number.

---

## 4. Set up Appwrite (the database)

You do this once. Copy each **ID** into a temporary note, because you need them in [step 6](#6-create-the-settings-file).

Appwrite renamed some things. Both names mean the same here:

| Newer name | Older name |
| --- | --- |
| Table | Collection |
| Column | Attribute |
| Row | Document |

### 4.1 Project

1. Sign in to <https://cloud.appwrite.io> and create a project named `SmartWork`.
2. From the project settings, copy the **Project ID** and the **API Endpoint**. The endpoint looks like `https://<REGION>.cloud.appwrite.io/v1`.

### 4.2 API key

1. Open **API Keys** in the project and choose **Create API key**.
2. Name it `smartwork` and set the expiration to **Never**.
3. Select these scopes:

   | Scope | Used for |
   | --- | --- |
   | `sessions.write` | Register and login |
   | `users.read` | Showing people's names |
   | `rows.read` (also `documents.read` if listed) | The daily alert reading tasks |

   Some versions of the Console group the login scopes under **Auth**. If so, select that whole group.
4. Copy the key. **Treat it like a password.**

### 4.3 Database and tables

Create a database named `smartwork` and copy its **Database ID**. Create these four tables inside it and copy each **Table ID**.

**tasks**

| Column | Type | Required | Details |
| --- | --- | --- | --- |
| `workspaceId` | String | Yes | Size 50 |
| `name` | String | Yes | Size 256 |
| `projectId` | String | Yes | Size 50 |
| `assigneeId` | String | Yes | Size 50 |
| `description` | String | No | Size 2048 |
| `dueDate` | DateTime | Yes | |
| `status` | Enum | Yes | `BACKLOG`, `TODO`, `IN_PROGRESS`, `IN_REVIEW`, `DONE` |
| `priority` | Enum | **No** | `LOW`, `MEDIUM`, `HIGH`. Default: `MEDIUM` |
| `position` | Integer | Yes | Min 1000, Max 1000000 |

> Do not skip `priority`. Creating and editing tasks fails without it.

**projects**

| Column | Type | Required | Details |
| --- | --- | --- | --- |
| `workspaceId` | String | Yes | Size 50 |
| `name` | String | Yes | Size 256 |
| `imageId` | String | No | Size 50 |

**members**

| Column | Type | Required | Details |
| --- | --- | --- | --- |
| `userId` | String | Yes | Size 50 |
| `workspaceId` | String | Yes | Size 50 |
| `role` | Enum | Yes | `ADMIN`, `MEMBER` |

**workspaces**

| Column | Type | Required | Details |
| --- | --- | --- | --- |
| `name` | String | Yes | Size 256 |
| `userId` | String | Yes | Size 50 |
| `imageId` | String | No | Size 50 |
| `inviteCode` | String | Yes | Size 10 |

### 4.4 Permissions

For **each** table, open **Settings > Permissions**, add the role **All Users** and tick **Create, Read, Update, Delete**. Click **Update**.

### 4.5 Search index

In the **tasks** table, open **Indexes** and create one: name `task_name`, type **Full Text**, column `name`, order **DESC**.

### 4.6 Image storage

1. Open **Storage**, create a bucket named `images` and copy its **Bucket ID**.
2. In its settings, give **All Users** the **Create, Read, Update, Delete** permissions.
3. Set the maximum file size to **1 MB** and the allowed extensions to `jpg`, `jpeg`, `png`.

Google and GitHub login are optional. Email and password login works without them. To enable them, see steps 12 and 13 in `README.md`.

---

## 5. Connect Telegram (one time)

You do this once. Members only need to join the group; they do not set up anything.

### 5.1 Create the bot

1. In Telegram, search for **@BotFather** (with the blue verified tick) and open it.
2. Send `/newbot`.
3. Enter a display name, for example `SmartWork Alerts`.
4. Enter a username ending in `bot`, for example `mycompany_smartwork_bot`.
5. BotFather replies with a **token** like `1234567890:AAExampleExampleExample`. Copy it. **Treat it like a password.**

### 5.2 Add the bot to your group

1. Create a Telegram group (for example `SmartWork Team`) or open an existing one.
2. Add your bot as a member, searching by its username.
3. Send this in the group, with your bot's username:

   ```text
   /start@mycompany_smartwork_bot
   ```

   The bot does not reply. This only lets you find the group's ID in the next step.

### 5.3 Find the group's chat ID

In PowerShell, replace the token and run:

```powershell
$token = "PASTE_YOUR_TOKEN_HERE"
(Invoke-RestMethod "https://api.telegram.org/bot$token/getUpdates").result |
  ForEach-Object { $_.message.chat; $_.my_chat_member.chat } |
  Where-Object { $_ } | Select-Object id, type, title -Unique
```

Copy the `id` of your group, **including the minus sign**, for example `-1001234567890`.

If nothing appears, send the `/start@...` message again and rerun it. Telegram keeps these updates for at most 24 hours.

> **Only for yourself?** Open a private chat with the bot, press **Start**, and run the same command. Your own chat ID is a positive number.

---

## 6. Create the settings file

1. Open PowerShell in the project folder:

   ```powershell
   cd C:\SmartWork
   Copy-Item .env.example .env.local
   notepad .env.local
   ```

2. Replace the placeholder values and save:

   ```env
   NEXT_TELEMETRY_DISABLED=1

   NEXT_PUBLIC_APP_BASE_URL=http://localhost:3000

   NEXT_PUBLIC_APPWRITE_ENDPOINT=https://<REGION>.cloud.appwrite.io/v1
   NEXT_PUBLIC_APPWRITE_PROJECT=your_project_id
   NEXT_PUBLIC_APPWRITE_IMAGES_BUCKET_ID=your_bucket_id
   NEXT_APPWRITE_KEY=your_api_key

   NEXT_PUBLIC_APPWRITE_DATABASE_ID=your_database_id
   NEXT_PUBLIC_APPWRITE_MEMBERS_ID=your_members_table_id
   NEXT_PUBLIC_APPWRITE_PROJECTS_ID=your_projects_table_id
   NEXT_PUBLIC_APPWRITE_TASKS_ID=your_tasks_table_id
   NEXT_PUBLIC_APPWRITE_WORKSPACES_ID=your_workspaces_table_id

   TELEGRAM_BOT_TOKEN=your_bot_token
   TELEGRAM_CHAT_ID=your_group_chat_id
   DIGEST_TIME=07:00
   ```

3. Check that the name is exactly `.env.local`, not `.env.local.txt`:

   ```powershell
   Get-ChildItem .env*
   ```

`DIGEST_TIME` is 24-hour time, so 6:30 AM is `06:30`. The time zone is India (`Asia/Kolkata`). To change it, edit `TZ` in `docker-compose.yml`.

Never share `.env.local`. It contains your API key and bot token.

---

## 7. Start SmartWork

With Docker Desktop running:

```powershell
cd C:\SmartWork
docker compose build
docker compose up -d
```

The first build downloads everything and can take several minutes. Run `build` before `up` the first time, because both containers share the same image.

Open <http://localhost:3000>.

---

## 8. Check that it works

1. **Containers:** `docker compose ps` should show `web` and `digest` as running.
2. **Website:** register, create a workspace, a project, and a task with **High** priority.
3. **Alert:** send one now instead of waiting for the morning:

   ```powershell
   docker compose exec digest node scripts/daily-digest.mjs --now
   ```

   You should see `Digest sent.` and a message in the Telegram group.
4. **Restart:** restart Windows and sign in. After a minute or two, <http://localhost:3000> should open by itself.

> If you start SmartWork after `DIGEST_TIME`, the first alert is sent straight away. This is expected: that day's alert had not been sent yet.

---

## 9. How it works

### 9.1 The website

1. You sign in at `http://localhost:3000`. Appwrite checks your password.
2. A **workspace** holds **projects** and **members**. A project holds **tasks**.
3. Each task has a name, assignee, project, due date, status and priority.
4. Every change is saved in Appwrite immediately. Nothing important is stored in the container.

### 9.2 The daily alert

The `digest` container runs `scripts/daily-digest.mjs` all the time. Once a minute it asks two questions:

```text
   Is it DIGEST_TIME or later?  --no-->  wait one minute
              | yes
   Already sent today?          --yes->  wait one minute
              | no
   Read unfinished tasks from Appwrite
              |
   Build the message and send it to Telegram
              |
        success? --no-->  log the error, try again in one minute
              | yes
   Remember today's date, so it is not sent again today
```

It reads Appwrite directly, so it works even if the website is stopped.

### 9.3 What happens in each situation

| Situation | Result |
| --- | --- |
| PC is on at 07:00 | Alert is sent at 07:00 (within about a minute) |
| PC is off or asleep at 07:00 | Alert is sent after the PC is on, you are signed in and Docker has started |
| No internet, or Telegram is down | Tries again every minute until it succeeds |
| PC or Docker restarts after sending | Not sent again that day |
| PC is off all day | No alert for that day |
| No unfinished tasks | Sends "Nothing pending", so you know it is working |

### 9.4 What the message contains

```text
📋 Pending tasks — Tue, 24 Nov 2026
3 open · 2 high priority · 1 overdue

🔴 High priority (2)
• Fix login — Arun · Website · in progress · ⚠️ overdue (22 Nov)
• Update prices — Beena · Website · todo · ⏰ due today

👤 Arun (1)
• Write docs — Website · backlog · due 27 Nov
```

- **Included:** every task that is not `DONE`, from all workspaces.
- **Order:** high priority first, then the rest grouped by person. Earliest due date first.
- **Overdue:** the due date is before today.
- **Unassigned:** the assigned person is no longer a member.
- **Old tasks with no priority** appear under the person's name. Edit the task to set a priority.
- **Long lists** are split into several messages, because Telegram limits a message to 4096 characters.

### 9.5 How Telegram is used

- It is **one-way**. SmartWork only sends messages. It does not read your group and does not answer commands.
- The **bot token** proves which bot is sending. The **chat ID** says where to send.
- Your PC makes an outgoing connection to Telegram. You do not need a public IP address, domain or router changes.
- Task names, people's names and project names pass through Telegram's servers. Everyone in the group can read them.

### 9.6 Important files

| File | Purpose |
| --- | --- |
| `.env.local` | Your private settings |
| `docker-compose.yml` | Defines the two containers, the port and the time zone |
| `Dockerfile` | How the image is built |
| `scripts/daily-digest.mjs` | The daily alert |
| Docker volume `smartwork_digest-data` | Remembers the last date an alert was sent |

---

## 10. Everyday commands

Run these in `C:\SmartWork`.

| I want to... | Command |
| --- | --- |
| Start | `docker compose up -d` |
| Stop | `docker compose stop` |
| See status | `docker compose ps` |
| See alert logs | `docker compose logs digest` |
| See website logs | `docker compose logs web` |
| Send an alert now | `docker compose exec digest node scripts/daily-digest.mjs --now` |
| Apply a new alert time, bot token or chat ID | `docker compose up -d` |
| Apply a changed `NEXT_PUBLIC_...` value | `docker compose build --no-cache` then `docker compose up -d` |
| Apply changed code | `docker compose build` then `docker compose up -d` |
| Remove the containers (tasks stay in Appwrite) | `docker compose down` |

---

## 11. Limits to know about

- **Appwrite's free plan pauses idle projects.** A free project is paused after 7 days without development activity **in the Appwrite Console**, and a project left paused for 90 days is deleted. Appwrite does not say that normal app use counts, so do not rely on it. While paused, login and alerts stop. Open your project in the Console every few days, or use a paid plan.
- **You must be signed in to Windows.** Docker Desktop starts when you sign in, not when the PC powers on.
- **Login works only on the PC itself.** The login cookie requires HTTPS, except on `localhost`. Opening `http://192.168.x.x:3000` from another PC or phone shows the page, but login does not work. Sharing it on your network needs HTTPS in front of SmartWork.
- **Task links in the alert need a real address.** They use `NEXT_PUBLIC_APP_BASE_URL`, so a `localhost` link does not open from a phone.
- **All workspaces share one Telegram group.** Do not use the same installation for work the group should not see.
- **The website lists up to 25 tasks at a time.** This is Appwrite's default. The alert includes all of them.

---

## 12. Troubleshooting

| Problem | Cause and fix |
| --- | --- |
| `docker` is not recognized | Docker Desktop is not installed, or PowerShell was open during installation. Open a new window. |
| `Cannot connect to the Docker daemon` / pipe error | Docker Desktop is not running. Open it and wait for the engine. |
| Docker reports that virtualization is disabled | Enable Intel VT-x or AMD-V in the BIOS/UEFI. |
| `.env.local` not found | Check the file name in [step 6](#6-create-the-settings-file). Notepad may have saved `.env.local.txt`. |
| Build fails while downloading fonts or packages | The build needs internet. Check the connection or proxy and build again. |
| Port 3000 is already in use | In `docker-compose.yml` use `'3001:3000'`, set `NEXT_PUBLIC_APP_BASE_URL=http://localhost:3001`, then rebuild with `--no-cache`. |
| Creating or editing a task fails | The `priority` column is missing or has different values. See [4.3](#43-database-and-tables). |
| Login or everything fails after some days | The Appwrite project may be paused. Open it in the Console and resume it. |
| Log: `Missing environment variable: ...` | That line is missing or empty in `.env.local`. Add it and run `docker compose up -d`. |
| Log: `missing scope` | The API key lacks a scope. See [4.2](#42-api-key). |
| Log: `Telegram 401` | Wrong bot token. |
| Log: `Telegram 400 ... chat not found` | Wrong chat ID, missing minus sign, or the bot is not in the group. |
| Log: `Telegram 400 ... upgraded to a supergroup` | The group's ID changed. Repeat [5.3](#53-find-the-groups-chat-id) and update `TELEGRAM_CHAT_ID`. |
| Log: `Telegram 403` | The bot was removed from the group, or you blocked it. Add it again. |
| Alert arrives at the wrong hour | Check `DIGEST_TIME` in `.env.local` and `TZ` in `docker-compose.yml`. |

If your bot token leaks, send `/revoke` to @BotFather, put the new token in `.env.local`, and run `docker compose up -d`.
