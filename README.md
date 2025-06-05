# Shiv's Meal Planner

Your personal meal planning assistant.

## Getting Started & Deployment to GitHub Pages

This project uses Vite for development and building, and `gh-pages` for easy deployment to GitHub Pages.

### Prerequisites

1.  **Node.js and npm:** You need Node.js installed on your computer. npm comes with Node.js. You can download it from [nodejs.org](https://nodejs.org/).
2.  **Git:** You need Git installed. You can download it from [git-scm.com](https://git-scm.com/).
3.  **GitHub Account:** You need a GitHub account.
4.  **GitHub Repository:** Create a new repository on GitHub for this project (e.g., `shivs-meal-planner`). Do NOT initialize it with a README, .gitignore or license if you plan to push an existing local folder.

### Setup Instructions

1.  **Clone Your Repository (if you created an empty one on GitHub):**
    ```bash
    git clone https://github.com/<YOUR_USERNAME>/<YOUR_REPOSITORY_NAME>.git
    cd <YOUR_REPOSITORY_NAME>
    ```
    If you already have the project files locally and want to push to a new GitHub repo:
    ```bash
    # In your project directory
    git init
    git add .
    git commit -m "Initial commit"
    git branch -M main
    git remote add origin https://github.com/<YOUR_USERNAME>/<YOUR_REPOSITORY_NAME>.git
    git push -u origin main
    ```

2.  **Place Project Files:**
    *   Ensure `index.html`, `package.json`, and `vite.config.ts` are in the root directory of your project.
    *   Create an `src` directory in the root.
    *   Move `App.tsx`, `constants.ts`, `types.ts`, `global.d.ts`, and the `components` and `services` folders (with their contents) into the `src` directory.

3.  **Update `vite.config.ts`:**
    *   Open `vite.config.ts`.
    *   Find the line: `const GITHUB_REPOSITORY_NAME = '<YOUR_REPOSITORY_NAME>';`
    *   **Replace `<YOUR_REPOSITORY_NAME>` with the actual name of your GitHub repository.** For example, if your repository is named `my-meal-planner`, it should be `const GITHUB_REPOSITORY_NAME = 'my-meal-planner';`.
    *   If your repository name is the same as `your-username.github.io` (i.e., you're deploying to the root of your GitHub Pages site), you can set `GITHUB_REPOSITORY_NAME` to an empty string `''` or a value that ensures the `base` path becomes just `/`. Or more simply, ensure the condition `GITHUB_REPOSITORY_NAME !== '<YOUR_REPOSITORY_NAME>'` is false in the `base` calculation (e.g. by setting it to the default placeholder `GITHUB_REPOSITORY_NAME = '<YOUR_REPOSITORY_NAME>'` if you do not intend to deploy to a subpath). *For most users deploying a project repo, setting the correct repository name is what you want.*

4.  **Install Dependencies:**
    Open your terminal or command prompt in the project's root directory and run:
    ```bash
    npm install
    ```
    This will install Vite, React, and other necessary packages.

### Development

To run the app locally during development:
```bash
npm run dev
```
This will start a development server (usually at `http://localhost:3000`).

### Building for Production

To compile your app into static files for deployment:
```bash
npm run build
```
This will create a `dist` folder in your project root. This folder contains the optimized static files.

### Deploying to GitHub Pages

1.  **Ensure `package.json` is configured:** The `deploy` script in `package.json` is set up as: `"deploy": "npm run build && gh-pages -d dist"`. This will first build your project, then use `gh-pages` to deploy the `dist` folder.

2.  **Commit and Push All Changes:** Make sure all your latest code, including `package.json`, `vite.config.ts`, and the `src` directory changes, are committed and pushed to your GitHub repository's `main` (or `master`) branch.
    ```bash
    git add .
    git commit -m "Setup Vite and prepare for GitHub Pages deployment"
    git push origin main
    ```

3.  **Run the Deploy Script:**
    In your terminal, from the project root, run:
    ```bash
    npm run deploy
    ```
    This command will:
    *   Build your project (running `npm run build`).
    *   Create a `gh-pages` branch in your repository (if it doesn't exist).
    *   Push the contents of your `dist` folder to the `gh-pages` branch.

4.  **Configure GitHub Pages Settings:**
    *   Go to your repository on GitHub.
    *   Click on "Settings" (tab).
    *   In the left sidebar, click on "Pages".
    *   Under "Build and deployment", for "Source", select "Deploy from a branch".
    *   Under "Branch", select `gh-pages` as the branch and `/ (root)` as the folder.
    *   Click "Save".

5.  **Wait and Access Your Site:**
    *   GitHub Pages will take a few minutes to build and deploy your site from the `gh-pages` branch.
    *   Once deployed, your site will be available at: `https://<YOUR_USERNAME>.github.io/<YOUR_REPOSITORY_NAME>/`
        (If you set `GITHUB_REPOSITORY_NAME` to `''` in `vite.config.ts` because your repository is `<YOUR_USERNAME>.github.io`, then it will be `https://<YOUR_USERNAME>.github.io/`).
    *   You can see the status in the "Actions" tab of your GitHub repository or on the "Pages" settings screen.

### Troubleshooting

*   **Base Path Issues (404 errors for CSS/JS):** If your CSS or JavaScript files are not loading (404 errors in the browser console), double-check that the `base` path in `vite.config.ts` correctly matches your repository name (e.g., `/<YOUR_REPOSITORY_NAME>/`).
*   **Blank Page:** Ensure the GitHub Pages source is set to the `gh-pages` branch and `/ (root)` folder. Check the browser's developer console for errors.
*   **`gh-pages` errors:** If `npm run deploy` fails, check the error messages. Common issues include not having Git configured or not having push access to the repository.
*   **Custom Domain:** If you use a custom domain with GitHub Pages, the `base` path in `vite.config.ts` should typically be just `/`.

Good luck!
