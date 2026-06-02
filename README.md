# ✏️ CoDraw — Collaborative Real-Time Whiteboard

CoDraw is a premium, real-time collaborative whiteboard and canvas application. Built with a stunning glassmorphic design system and smooth micro-animations, it allows teams, students, and creatives to sketch, chat, and brainstorm together instantly in their browsers.

---

## ✨ Features

* **🎨 Advanced Drawing Tools**: 
  * **Freehand Brush** & **Eraser** (erases paths dynamically using Canvas compositing to reveal the grid below).
  * **Vector Shapes**: Draw straight lines, rectangles, and circles.
  * **Fill Shapes**: Toggle between outlined and solid shapes.
* **⚡ Live Real-time Collaboration**:
  * **Instant Share Links**: Join a room, click the "Invite" button, and copy a direct link.
  * **Active Path Previews**: Watch other users draw lines, circles, and freehand curves in real time *as they drag*.
  * **Collaborative Cursors**: Track peers with colored cursors displaying their custom nicknames, profile colors, and live state indicators.
  * **Intelligent Shared Undo**: Seamlessly undo only *your own* last action without corrupting other users' active drawings.
* **💬 Integrated Chat & Collaboration Space**:
  * Floating side drawer with tabbed sections for **Live Chat** and an **Active Collaborators** list.
  * Customizable **User Profiles** (change your nickname and profile color anytime).
* **🖥️ Premium User Experience**:
  * **Glassmorphic Design System**: Styled with deep, ambient slate colors, frosted panels, drop shadows, and subtle neon glows.
  * **Retina High-DPI Scaling**: Ensures drawn elements remain pin-sharp and clean on modern high-resolution screens.
  * **Infinite Grid Overlay**: Faint background dot-grid that can be toggled on/off.
  * **Artwork Export**: Export the workspace with solid backgrounds to high-resolution PNG images.

---

## 🛠️ Tech Stack

* **Frontend**: Vanilla HTML5, Canvas API, ES6 JavaScript, CSS Variables.
* **Backend**: Node.js, Express.
* **Real-Time Communication**: Socket.io (WebSockets).

---

## 🚀 Getting Started

Follow these steps to run CoDraw on your local machine.

### Prerequisites
Make sure you have [Node.js](https://nodejs.org/) installed (v16.0.0 or higher recommended).

### Installation
1. Clone your repository (or navigate to the project directory):
   ```bash
   cd repo/test-website
   ```
2. Install the server-side dependencies:
   ```bash
   npm install
   ```

### Running Locally
To launch the server locally:
```bash
npm start
```
The server will boot up at **`http://localhost:3000`**. 

Open `http://localhost:3000` in multiple browser windows (or share your local IP with devices on the same network) to start collaborating in real time!

---

## 🏗️ Architecture & How It Works

* **Room Management**: The server handles room creation dynamically. Visiting `/` redirects the user to a unique, randomly-generated path `/room/xxxxxx` via HTML5 History rewriting. 
* **State Synchronization**:
  * Dragging mouse inputs emit temporary vector points to the server, which are immediately broadcasted to all other active sockets inside the room to render live drag-previews.
  * Releasing the mouse commits the completed shape/path to the server's in-memory room database so that any new user joining the session instantly receives the complete historical artwork.
* **Peer Cursor Tracking**: Real-time cursor coordinates are emitted at a high frequency on mouse motion. Cursors are absolute-positioned elements rendered dynamically in the cursor overlay layer.

---

## 🌐 Production Deployment

Since CoDraw depends on active WebSockets, it should be deployed to a provider that supports persistent running processes.

### Deploying to Render.com (Recommended)
1. Push your repository to GitHub.
2. Sign up on **Render** and create a new **Web Service**.
3. Select your GitHub repository.
4. Set the following configurations:
   * **Runtime**: `Node`
   * **Build Command**: `npm install`
   * **Start Command**: `npm start`
   * **Instance Type**: `Free`
5. Click **Deploy Web Service**.

### Deploying to Railway.app
1. Push your repository to GitHub.
2. Log into **Railway** and start a **New Project**.
3. Deploy directly from your GitHub repository.
4. Railway will automatically detect the entry point and deploy. Click **Generate Domain** in the project settings once deployed.

---

## 📝 License
This project is open-source and licensed under the [MIT License](LICENSE).
