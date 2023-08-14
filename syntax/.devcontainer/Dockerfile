FROM --platform=linux/amd64 ubuntu:20.04
LABEL org.opencontainers.image.authors="support@halon.io"

ARG HALON_REPO_USER
ARG HALON_REPO_PASS

RUN apt-get update

RUN apt-get install -y wget gnupg
RUN apt-get install -y apt-transport-https

RUN wget -qO - https://raw.githubusercontent.com/halon/changelog/master/pgp-keys/7F0A73B5.asc | apt-key add -
RUN echo "deb https://repo.halon.io/ focal stable" >> /etc/apt/sources.list.d/halon.list
RUN echo "machine repo.halon.io login ${HALON_REPO_USER} password ${HALON_REPO_PASS}" >> /etc/apt/auth.conf
RUN apt-get update && apt-get install -y halon=5.12.0 halon-rated=5.12.0 halon-dlpd=5.12.0 halon-extras-rate=1.2.0 halon-extras-dlp=1.1.0

RUN /usr/bin/install -d /var/run/halon
ENV LD_LIBRARY_PATH=$LD_LIBRARY_PATH

RUN apt-get install -y git

RUN apt-get install -y curl
RUN curl -fsSL https://deb.nodesource.com/setup_16.x | bash -
RUN apt-get install -y nodejs

RUN apt-get install -y supervisor
COPY .devcontainer/supervisord.conf /etc/supervisor/conf.d/supervisord.conf
CMD ["/usr/bin/supervisord"]