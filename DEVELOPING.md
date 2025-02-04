## Malloy VSCode Extension

### Install Malloy and Other Dependencies

```bash
npm install
```

### Installation

To build and install the current version of the extension, first ensure that you've followed the steps to install the dependencies for the Malloy Repo. **Note: You will need to re-run the below any time you pull in new changes.** Then run:

```bash
npm run package-extension
```

Next, in VSCode _EITHER_:

1. Run the "Extensions: Install from VSIX" command (CTRL/CMD + SHIFT + P opens the command interface), then select `dist/malloy-vscode-x.x.x.vsix`

_OR_

2. Open the folder root directory in VSCode, right click on `dist/malloy-vscode-x.x.x.vsix` and select "Install Extension VSIX".

# Malloy and Extension Development

## Running and Debugging

1. Open the top-level repository directory in VSCode
2. Select the "Run and Debug" panel in the left bar.
3. Click the green arrow "Run" button, with the "Run Extension" profile selected.

Optional: To additionally debug the language server, run the "Attach to Language Server"
launch profile from the "Run and Debug" panel.

![open_vsix3](https://user-images.githubusercontent.com/7178946/130678501-cd5cf79b-0d48-42a6-a4d5-602f1b0d563d.gif)

## Running against a local version of Malloy

1. One time, in your local Malloy repository, run `npm link -ws`. That will make your development packages locally available for development.
2. Each time you make changes, you'll need to run `npm run build` from the `malloy` directory
3. In your VS Code extension repository, run `npm run malloy-link` to pull in the newly built local Malloy packages.

## Committing changes to the local version of Malloy
1. If you make changes to Malloy that are required by the extension, merge those into main and that will trigger an automatic developer release of Malloy.
2. Once that release completes, run `npm run malloy-update` to update dependencies to that release. This will break the link to your local version of Malloy, so if you want to resume local development, re-run `npm run malloy-link`
3. To manually unlink without updating, you may run `npm run malloy-unlink`
