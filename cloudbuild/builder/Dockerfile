FROM node:16-bookworm

COPY code_1.80.1-1689183569_amd64.deb .

RUN apt-get update -y 
RUN apt-get -y install xvfb \
  psmisc
RUN apt install -y ./code_1.80.1-1689183569_amd64.deb
