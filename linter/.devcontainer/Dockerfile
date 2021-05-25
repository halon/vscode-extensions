FROM ubuntu:20.04
MAINTAINER Halon <support@halon.io>

COPY .devcontainer/halon-5.6.1-ubuntu-20.04-x86_64.deb /halon-5.6.1-ubuntu-20.04-x86_64.deb
RUN apt-get update && apt install -y /halon-5.6.1-ubuntu-20.04-x86_64.deb && rm /halon-5.6.1-ubuntu-20.04-x86_64.deb

RUN /usr/bin/install -d /var/run/halon
ENV LD_LIBRARY_PATH=/opt/halon/lib/:$LD_LIBRARY_PATH

RUN apt-get install -y git

RUN apt-get install -y curl
RUN curl -fsSL https://deb.nodesource.com/setup_16.x | bash -
RUN apt-get install -y nodejs

RUN apt-get install -y supervisor
COPY .devcontainer/supervisord.conf /etc/supervisor/conf.d/supervisord.conf
CMD ["/usr/bin/supervisord"]