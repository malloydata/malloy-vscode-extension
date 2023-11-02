FROM node:16-bookworm

COPY vscode.deb .

RUN apt-get update -y
RUN apt-get -y install xvfb \
  psmisc \
  default-jre
RUN apt install -y ./vscode.deb
