# SmartWork: Appwrite Cloud Setup (Ubuntu)

How to set up Appwrite Cloud for SmartWork, then build and start the app on Ubuntu.

- **Before you start:** install Docker. See [step 1 of SMARTWORK_UBUNTU_GUIDE.md](SMARTWORK_UBUNTU_GUIDE.md#1-check-docker).
- **Telegram alerts are optional** and not covered here. See [step 4 of SMARTWORK_UBUNTU_GUIDE.md](SMARTWORK_UBUNTU_GUIDE.md#4-connect-telegram-one-time).
- Some Console button labels may differ slightly from this guide.

**Differences from the other guides**

- Appwrite has deprecated the `String` column type, so use **`varchar`** instead.
- Plain `documents.read` is not in Appwrite's current scope list, so do not look for it.

**Contents**

- [A. Account and project](#a-account-and-project)
- [B. API key](#b-api-key)
- [C. Database](#c-database)
- [D. Four tables](#d-four-tables)
- [E. Image storage](#e-image-storage)
- [F. Put the values in the app](#f-put-the-values-in-the-app)
- [G. Test Appwrite before building](#g-test-appwrite-before-building)
- [H. Build and try it](#h-build-and-try-it)
- [Everyday commands](#everyday-commands)
- [Things to know](#things-to-know)

Open a text editor now, and paste each value marked 📋 into it. Delete that note when you finish, because it contains your API key.

---

## A. Account and project

1. Go to <https://cloud.appwrite.io> and sign up.
2. Create a project named `SmartWork` and pick the region nearest you. For India, look for Singapore or Mumbai if offered.
3. Skip any "add platform" or "connect SDK" prompt, because this app uses Appwrite only from its server.
4. Find these in the project overview or settings:
   - 📋 **Project ID**
   - 📋 **API Endpoint**, such as `https://<REGION>.cloud.appwrite.io/v1`. Use the one shown there.

---

## B. API key

1. Open **API Keys** in the project sidebar, then click **Create API key**.
2. Name it `smartwork` and set expiration to **Never**.
3. Select these scopes:

   | Group | Scope | Why |
   | --- | --- | --- |
   | Auth | `sessions.write` | Sign up and log in |
   | Auth | `users.read` | Show member names |
   | Databases | `rows.read` | Telegram alerts and the test in [step G](#g-test-appwrite-before-building) |

4. Create the key. 📋 Copy the **API key**, and treat it like a password.

---

## C. Database

1. Open **Databases**, then click **Create database**.
2. If asked for a type, choose **TablesDB**, not DocumentsDB or VectorsDB.
3. Name it `smartwork`. 📋 Copy the **Database ID**.

---

## D. Four tables

For each table:

1. Click **Create table**, enter the name, and 📋 copy the **Table ID**.
2. Use **Add column** for every row below.
3. Type names exactly as shown, because **capital letters matter**.

Add each enum value separately, with no spaces or commas.

### `workspaces`

| Column | Type | Size / values | Required |
| --- | --- | --- | --- |
| `name` | varchar | 256 | Yes |
| `userId` | varchar | 50 | Yes |
| `imageId` | varchar | 50 | **No** |
| `inviteCode` | varchar | 10 | Yes |

### `members`

| Column | Type | Size / values | Required |
| --- | --- | --- | --- |
| `userId` | varchar | 50 | Yes |
| `workspaceId` | varchar | 50 | Yes |
| `role` | enum | `ADMIN`, `MEMBER` | Yes |

### `projects`

| Column | Type | Size / values | Required |
| --- | --- | --- | --- |
| `workspaceId` | varchar | 50 | Yes |
| `name` | varchar | 256 | Yes |
| `imageId` | varchar | 50 | **No** |

### `tasks`

| Column | Type | Size / values | Required |
| --- | --- | --- | --- |
| `workspaceId` | varchar | 50 | Yes |
| `name` | varchar | 256 | Yes |
| `projectId` | varchar | 50 | Yes |
| `assigneeId` | varchar | 50 | Yes |
| `description` | varchar | 2048 | **No** |
| `dueDate` | datetime | none | Yes |
| `status` | enum | `BACKLOG`, `TODO`, `IN_PROGRESS`, `IN_REVIEW`, `DONE` | Yes |
| `priority` | enum | `LOW`, `MEDIUM`, `HIGH` (default `MEDIUM`) | **No** |
| `position` | integer | min 1000, max 1000000 | Yes |

Do not skip `priority`. Creating and editing tasks fails without it.

### Permissions (all four tables)

1. Open the table's **Settings > Permissions**.
2. Add the role for all signed-in users, usually labelled **All users**. Do not pick **Any**, which includes people who are not signed in.
3. Tick **Create, Read, Update, Delete**, then click **Update**.

### Search index (`tasks` only)

1. Open the **Indexes** tab and create an index.
2. Set key `task_name`, type **Fulltext**, column `name`, order `DESC`.

---

## E. Image storage

1. Open **Storage**, then click **Create bucket**, and name it `images`. 📋 Copy the **Bucket ID**.
2. In the bucket's **Settings**:
   - **Permissions:** All users, with Create, Read, Update and Delete
   - **Maximum file size:** 1 MB
   - **File extensions:** `jpg`, `jpeg`, `png`

---

## F. Put the values in the app

```bash
cd ~/Downloads/jira-clone-main
cp -n .env.example .env.local
chmod 600 .env.local
nano .env.local
```

| Line in `.env.local` | Value |
| --- | --- |
| `NEXT_PUBLIC_APPWRITE_ENDPOINT` | API Endpoint |
| `NEXT_PUBLIC_APPWRITE_PROJECT` | Project ID |
| `NEXT_PUBLIC_APPWRITE_IMAGES_BUCKET_ID` | Bucket ID |
| `NEXT_APPWRITE_KEY` | API key |
| `NEXT_PUBLIC_APPWRITE_DATABASE_ID` | Database ID |
| `NEXT_PUBLIC_APPWRITE_MEMBERS_ID` | `members` Table ID |
| `NEXT_PUBLIC_APPWRITE_PROJECTS_ID` | `projects` Table ID |
| `NEXT_PUBLIC_APPWRITE_TASKS_ID` | `tasks` Table ID |
| `NEXT_PUBLIC_APPWRITE_WORKSPACES_ID` | `workspaces` Table ID |

Do not put spaces around `=`. Leave the other lines alone. Save with **Ctrl+O**, **Enter**, then **Ctrl+X**.

---

## G. Test Appwrite before building

Run this in the project folder:

```bash
(
  . ./.env.local
  E="$NEXT_PUBLIC_APPWRITE_ENDPOINT"
  check() { curl -s -o /dev/null -w "$1 %{http_code}\n" -H "X-Appwrite-Project: $NEXT_PUBLIC_APPWRITE_PROJECT" -H "X-Appwrite-Key: $NEXT_APPWRITE_KEY" "$E$2"; }
  D="/databases/$NEXT_PUBLIC_APPWRITE_DATABASE_ID/collections"
  check tasks      "$D/$NEXT_PUBLIC_APPWRITE_TASKS_ID/documents"
  check projects   "$D/$NEXT_PUBLIC_APPWRITE_PROJECTS_ID/documents"
  check members    "$D/$NEXT_PUBLIC_APPWRITE_MEMBERS_ID/documents"
  check workspaces "$D/$NEXT_PUBLIC_APPWRITE_WORKSPACES_ID/documents"
  check users      "/users"
)
```

All five lines should end in **200**.

| Result | Likely cause |
| --- | --- |
| 401 or 403 | Wrong key or Project ID, a missing scope, or a paused project |
| 404 | Wrong Database ID, Table ID or endpoint |
| 000 | No internet, or a mistyped endpoint |

This test does not check columns, permissions or the bucket. [Step H](#h-build-and-try-it) does.

---

## H. Build and try it

```bash
docker compose build --no-cache
docker compose up -d web
```

The first build takes several minutes. Open <http://localhost:3000> and try these in order. If one fails, check the part beside it:

| Try | If it fails, check |
| --- | --- |
| Sign up (password of 8+ characters) | `sessions.write` scope, endpoint |
| Create a workspace | `workspaces` and `members` columns and permissions |
| Create a project with a small PNG | `projects` table, `images` bucket |
| Create a task | `tasks` columns, especially `priority` |
| Search for that task by name | `task_name` index |

---

## Everyday commands

Run these in `~/Downloads/jira-clone-main`.

| Task | Command |
| --- | --- |
| Start | `docker compose up -d web` (drop `web` to include Telegram alerts) |
| Stop | `docker compose stop` |
| See status | `docker compose ps` |
| View errors | `docker compose logs -f web` |
| Apply changed settings | `docker compose build --no-cache`, then the start command |

---

## Things to know

- **Login works only on this PC.** The login cookie needs HTTPS except on `localhost`, so other devices cannot sign in, and invite links will not work from them either.
- **Data is not well separated.** With these permissions, any registered user could reach every workspace's data through Appwrite directly. Use it for personal or trusted-team work, not sensitive data.
- **The page is visible on your network.** To limit it to this PC, change the port in `docker-compose.yml` to `'127.0.0.1:3000:3000'`.
- **Free Appwrite projects can pause.** See [Limits to know about](SMARTWORK_GUIDE.md#11-limits-to-know-about). Open your project in the Console now and then.
