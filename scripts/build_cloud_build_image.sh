#!/usr/bin/env bash

pushd cloudbuild/builder

# Get latest VS Code package
wget 'https://code.visualstudio.com/sha/download?build=stable&os=linux-deb-x64' -O vscode.deb

# Build and upload a new build image

gcloud builds submit --config cloudbuild.yaml

# Clean up package 
rm vscode.deb

popd
