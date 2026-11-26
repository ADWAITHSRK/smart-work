# SmartWork on Ubuntu: Install and Check

Install SmartWork on Ubuntu with Docker, and check every part as you go.

- Each step ends with a **Check**. Do not continue until it passes.
- Run the commands in a normal Ubuntu terminal (**Ctrl + Alt + T**).
- The Appwrite tables and the explanation of how the alert works are the same on every system, so this guide links to [SMARTWORK_GUIDE.md](SMARTWORK_GUIDE.md) for them.

**Contents**

1. [Check Docker](#1-check-docker)
2. [Quick check without any accounts](#2-quick-check-without-any-accounts)
3. [Set up Appwrite](#3-set-up-appwrite)
4. [Connect Telegram (one time)](#4-connect-telegram-one-time)
5. [Enter your real settings](#5-enter-your-real-settings)
6. [Check Appwrite and Telegram separately](#6-check-appwrite-and-telegram-separately)
7. [Start SmartWork](#7-start-smartwork)
8. [Full check](#8-full-check)
9. [Everyday commands](#9-everyday-commands)
10. [Ubuntu notes](#10-ubuntu-notes)
11. [Troubleshooting](#11-troubleshooting)
12. [Uninstall](#12-uninstall)

---

## 1. Check Docker

Docker may already be installed. Check first:

```bash
docker --version
docker compose version
docker buildx version
docker run --rm hello-world
```

**Check:** three version numbers, then `Hello from Docker!`. If so, **go to [step 2](#2-quick-check-without-any-accounts)**.

### If `docker` is not found: install it

Docker supports 64-bit Ubuntu 22.04, 24.04, 26.04 and 26.10. These are the [official steps](https://docs.docker.com/engine/install/ubuntu/):

```bash
sudo apt update
sudo apt install ca-certificates curl
sudo install -m 0755 -d /etc/apt/keyrings
sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
sudo chmod a+r /etc/apt/keyrings/docker.asc

sudo tee /etc/apt/sources.list.d/docker.sources <<EOF
Types: deb
URIs: https://download.docker.com/linux/ubuntu
Suites: $(. /etc/os-release && echo "${UBUNTU_CODENAME:-$VERSION_CODENAME}")
Components: stable
Architectures: $(dpkg --print-architecture)
Signed-By: /etc/apt/keyrings/docker.asc
EOF

sudo apt update
sudo apt install docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
```

### If only `compose` or `buildx` is missing

See which Docker you have with `dpkg -l | grep -E 'docker-ce|docker.io'`, then install the matching package:

| You have | Run |
| --- | --- |
| `docker-ce` | `sudo apt install docker-compose-plugin docker-buildx-plugin` |
| `docker.io` | `sudo apt install docker-compose-v2 docker-buildx` |

Do not mix the two.

### If you see `permission denied`

```bash
sudo usermod -aG docker $USER
```

Log out and back in. Members of the `docker` group have root-level control of the PC, so only add people you trust.

### Start at boot

Docker on Ubuntu starts at boot by default.

**Check:** `systemctl is-enabled docker` prints `enabled`.

---

## 2. Quick check without any accounts

This proves that the build and the website work on your PC before you set up anything else. Login does not work yet.

```bash
cd ~/Downloads/jira-clone-main
[ -f .env.local ] || cp .env.example .env.local
chmod 600 .env.local

docker compose build
docker compose up -d web
```

The first build can take several minutes.

**Check:**

```bash
docker compose ps
curl -s http://localhost:3000/sign-in | grep -o '<title>[^<]*</title>'
```

`web` is running, and the second command prints `<title>SmartWork</title>`. Open <http://localhost:3000>: you see the SmartWork sign-in page.

Stop it before continuing:

```bash
docker compose down
```

---

## 3. Set up Appwrite

Appwrite stores your accounts, tasks and images. It runs in Appwrite Cloud, not on your PC.

Follow [section 4 of SMARTWORK_GUIDE.md](SMARTWORK_GUIDE.md#4-set-up-appwrite-the-database), and do not skip the `priority` column.

**Check:** you have noted all of these:

- [ ] API Endpoint
- [ ] Project ID
- [ ] API key
- [ ] Database ID
- [ ] Table IDs: members, projects, tasks, workspaces
- [ ] Bucket ID

---

## 4. Connect Telegram (one time)

1. In Telegram, open **@BotFather** and send `/newbot`.
2. Choose a name and a username ending in `bot`. Copy the **token**. Treat it like a password.
3. Create or open your group and add the bot as a member.
4. Send this in the group, with your bot's username:

   ```text
   /start@your_bot_username
   ```

   The bot does not reply. This is normal.

5. Find the group's chat ID. The first command asks for the token without showing it:

   ```bash
   read -rsp "Bot token: " TOKEN; echo
   curl -s "https://api.telegram.org/bot$TOKEN/getUpdates" | python3 -c 'import json, sys; [print(c["id"], c["type"], c.get("title", "")) for u in json.load(sys.stdin).get("result", []) if (c := (u.get("message") or u.get("my_chat_member") or {}).get("chat"))]' | sort -u
   unset TOKEN
   ```

**Check:** you see a line like `-1001234567890 supergroup SmartWork Team`. Copy the number **with the minus sign**.

If nothing appears, check the token, send `/start@...` again and rerun. Telegram keeps these updates for at most 24 hours.

---

## 5. Enter your real settings

```bash
cd ~/Downloads/jira-clone-main
nano .env.local
```

Replace every placeholder. Save with **Ctrl + O**, **Enter**, and exit with **Ctrl + X**.

| Setting | Value |
| --- | --- |
| `NEXT_PUBLIC_APP_BASE_URL` | `http://localhost:3000` |
| `NEXT_PUBLIC_APPWRITE_ENDPOINT` | API Endpoint, such as `https://<REGION>.cloud.appwrite.io/v1` |
| `NEXT_PUBLIC_APPWRITE_PROJECT` | Project ID |
| `NEXT_PUBLIC_APPWRITE_IMAGES_BUCKET_ID` | Bucket ID |
| `NEXT_APPWRITE_KEY` | API key |
| `NEXT_PUBLIC_APPWRITE_DATABASE_ID` | Database ID |
| `NEXT_PUBLIC_APPWRITE_MEMBERS_ID` | members table ID |
| `NEXT_PUBLIC_APPWRITE_PROJECTS_ID` | projects table ID |
| `NEXT_PUBLIC_APPWRITE_TASKS_ID` | tasks table ID |
| `NEXT_PUBLIC_APPWRITE_WORKSPACES_ID` | workspaces table ID |
| `TELEGRAM_BOT_TOKEN` | Bot token |
| `TELEGRAM_CHAT_ID` | Group chat ID, with the minus sign |
| `DIGEST_TIME` | Alert time, 24-hour, such as `07:00` |

**Check:** this lists any setting that still has a placeholder. It should print nothing:

```bash
grep -E 'XXXXX|<REGION>' .env.local | cut -d= -f1
```

---

## 6. Check Appwrite and Telegram separately

These test your settings without SmartWork, so a problem is easy to locate. The parentheses keep your keys out of the terminal session.

**Appwrite:**

```bash
(
  . ./.env.local
  for table in "$NEXT_PUBLIC_APPWRITE_TASKS_ID" "$NEXT_PUBLIC_APPWRITE_PROJECTS_ID" "$NEXT_PUBLIC_APPWRITE_MEMBERS_ID" "$NEXT_PUBLIC_APPWRITE_WORKSPACES_ID"; do
    curl -s -o /dev/null -w "$table %{http_code}\n" \
      -H "X-Appwrite-Project: $NEXT_PUBLIC_APPWRITE_PROJECT" \
      -H "X-Appwrite-Key: $NEXT_APPWRITE_KEY" \
      "$NEXT_PUBLIC_APPWRITE_ENDPOINT/databases/$NEXT_PUBLIC_APPWRITE_DATABASE_ID/collections/$table/documents"
  done
  curl -s -o /dev/null -w "users %{http_code}\n" \
    -H "X-Appwrite-Project: $NEXT_PUBLIC_APPWRITE_PROJECT" \
    -H "X-Appwrite-Key: $NEXT_APPWRITE_KEY" \
    "$NEXT_PUBLIC_APPWRITE_ENDPOINT/users"
)
```

**Check:** all five lines end in `200`.

| Result | Meaning |
| --- | --- |
| `401` or `403` | Wrong API key or Project ID, a missing scope, or a paused project |
| `404` | Wrong Database ID, Table ID or endpoint |
| `000` | No internet, or a wrong endpoint address |

**Telegram:**

```bash
(
  . ./.env.local
  curl -s "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/sendMessage" \
    -d chat_id="$TELEGRAM_CHAT_ID" -d text="SmartWork test message"
  echo
)
```

**Check:** the output starts with `{"ok":true` and the message appears in the group.

---

## 7. Start SmartWork

`--no-cache` matters here. Your real Appwrite IDs must replace the placeholders that [step 2](#2-quick-check-without-any-accounts) built into the website.

```bash
cd ~/Downloads/jira-clone-main
docker compose build --no-cache
docker compose up -d
```

**Check:** `docker compose ps` shows `web` and `digest` running.

If it is already past `DIGEST_TIME`, the first alert is sent immediately.

---

## 8. Full check

### 8.1 Website

Open <http://localhost:3000>, register, then create a workspace and a project. Add these tasks:

| Task | Priority | Due date | Status |
| --- | --- | --- | --- |
| Test high | High | Today | Todo |
| Test overdue | Medium | Yesterday | In Progress |
| Test done | High | Today | Done |

**Check:** all three save. **Test high** and **Test done** show a **High** badge on the Kanban board.

### 8.2 Send an alert now

```bash
docker compose exec digest node scripts/daily-digest.mjs --now
```

**Check:** it prints `Digest sent.`, and in the Telegram group:

- [ ] **Test high** is under *High priority*, marked *due today*
- [ ] **Test overdue** is under your name, marked *overdue*
- [ ] **Test done** is **not** listed

### 8.3 The automatic schedule

1. Set the alert to 2 minutes from now:

   ```bash
   cp -p .env.local .env.local.backup
   sed -i "s/^DIGEST_TIME=.*/DIGEST_TIME=$(TZ=Asia/Kolkata date -d '+2 minutes' +%H:%M)/" .env.local
   grep DIGEST_TIME .env.local
   docker compose run --rm digest rm -f /data/last-sent
   docker compose up -d
   ```

   Do not run this in the last few minutes before midnight.

2. Wait about 3 minutes, then look at the log:

   ```bash
   docker compose logs --tail 5 digest
   ```

   **Check:** `Digest sent.` appears, and the message is in the group.

3. Check that it is not sent twice:

   ```bash
   docker compose restart digest
   sleep 70
   docker compose logs --since 75s digest
   ```

   **Check:** no new `Digest sent.` line after the restart.

4. Put your real time back:

   ```bash
   mv .env.local.backup .env.local
   docker compose up -d
   ```

### 8.4 Restart the PC

```bash
sudo reboot
```

**Check:** after the restart, `docker compose ps` in the project folder shows both running, and <http://localhost:3000> opens.

Delete the three test tasks when you are finished.

---

## 9. Everyday commands

Run these in `~/Downloads/jira-clone-main`.

| I want to... | Command |
| --- | --- |
| Start | `docker compose up -d` |
| Stop | `docker compose stop` |
| See status | `docker compose ps` |
| Follow the alert log | `docker compose logs -f digest` (exit with **Ctrl + C**) |
| Follow the website log | `docker compose logs -f web` |
| Send an alert now | `docker compose exec digest node scripts/daily-digest.mjs --now` |
| Apply a new alert time, token or chat ID | `docker compose up -d` |
| Apply a changed `NEXT_PUBLIC_...` value | `docker compose build --no-cache && docker compose up -d` |
| Apply changed code | `docker compose build && docker compose up -d` |

---

## 10. Ubuntu notes

- **No sign-in needed.** Docker starts at boot, so the alert works even at the login screen. On Windows, someone must sign in first.
- **Off or suspended at alert time.** The alert is sent after the PC is back on and connected.
- **Containers you stop stay stopped.** After `docker compose stop`, they do not return at the next boot until you run `docker compose up -d`.
- **Docker bypasses `ufw`.** Port 3000 is reachable from your network even if `ufw` blocks it. To allow only this PC, change the port line in `docker-compose.yml`, then run `docker compose up -d`:

  ```yaml
      ports:
        - '127.0.0.1:3000:3000'
  ```

- **Login works only on this PC.** From another device, login needs HTTPS.
- **Appwrite's free plan pauses projects** after 7 days without activity in its Console, which stops login and alerts. See [Limits to know about](SMARTWORK_GUIDE.md#11-limits-to-know-about).
- **How the alert works:** see [How it works](SMARTWORK_GUIDE.md#9-how-it-works).

---

## 11. Troubleshooting

| Problem | Fix |
| --- | --- |
| `permission denied ... docker.sock` | See [step 1](#if-you-see-permission-denied). Log out and back in after adding the group. |
| `Cannot connect to the Docker daemon` | `sudo systemctl start docker` |
| `docker: 'compose' is not a docker command` | See [step 1](#if-only-compose-or-buildx-is-missing). |
| Build error about `--mount` or BuildKit | `buildx` is missing. See [step 1](#if-only-compose-or-buildx-is-missing). |
| Build cannot download packages or fonts | Check internet and DNS: `docker run --rm node:24-slim node -e "fetch('https://registry.npmjs.org').then(r=>console.log(r.status))"` should print `200`. |
| `port is already allocated` or `address already in use` | Find it with `sudo ss -ltnp 'sport = :3000'`. Stop that program, or use `'3001:3000'`, set `NEXT_PUBLIC_APP_BASE_URL=http://localhost:3001` and rebuild with `--no-cache`. |
| `.env.local` not found | Run the commands inside the project folder. Check with `ls -la .env*`. |
| Login fails, or pages show errors | Repeat [step 6](#6-check-appwrite-and-telegram-separately), rebuild with `--no-cache`, then see `docker compose logs web`. |
| Creating or editing a task fails | The `priority` column is missing in Appwrite. |
| No alert | `docker compose logs digest` shows the reason. Messages are explained in [Troubleshooting](SMARTWORK_GUIDE.md#12-troubleshooting). |
| Wrong hour | `docker compose exec digest node -p "new Date().toString()"` should show India time. Otherwise check `TZ` in `docker-compose.yml`. |

---

## 12. Uninstall

```bash
cd ~/Downloads/jira-clone-main
docker compose down -v
docker image rm smartwork
```

This removes the containers, the image and the record of the last alert. Your tasks stay in Appwrite, and `.env.local` stays in the folder.
