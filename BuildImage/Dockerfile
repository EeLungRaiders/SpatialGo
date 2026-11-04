FROM ubuntu:26.04 AS base

RUN apt-get update -y && apt-get install -y --no-install-recommends \
    binutils cmake dpkg-dev g++ gcc \
    libssl-dev git \
    libx11-dev libxext-dev libxft-dev libxpm-dev \
    python3 python3-pip python3-dev \
    libtbb-dev libvdt-dev libgif-dev \
    jq vim dos2unix wget ca-certificates \
    && rm -rf /var/lib/apt/lists/*

RUN mkdir -p /opt && \
    wget -q https://root.cern/download/root_v6.40.02.Linux-ubuntu26.04-x86_64-gcc15.2.tar.gz -O /tmp/root.tar.gz && \
    tar -xzf /tmp/root.tar.gz -C /opt && \
    rm /tmp/root.tar.gz && \
    mv /opt/root /opt/root-6.40.02

# Optional GPU sysmon: nvidia-smi userspace only (no kernel driver in image).
# Match host driver series 595.x. Requires run with --gpus / nvidia runtime.
ENV NVIDIA_VISIBLE_DEVICES=all \
    NVIDIA_DRIVER_CAPABILITIES=compute,utility
RUN apt-get update -y \
 && apt-get install -y --no-install-recommends \
      nvidia-utils-595 \
 && rm -rf /var/lib/apt/lists/*

ENV ROOTSYS=/opt/root-6.40.02
ENV PATH=$ROOTSYS/bin:$PATH
ENV LD_LIBRARY_PATH=$ROOTSYS/lib:$LD_LIBRARY_PATH
ENV PYTHONPATH=$ROOTSYS/lib:$PYTHONPATH

RUN echo "source $ROOTSYS/bin/thisroot.sh" >> /etc/bash.bashrc

RUN pip3 install pandas --break-system-packages

RUN mkdir -p /sv_dir
WORKDIR /sv_dir
COPY scripts/dl_jsroot.sh /sv_dir/
RUN /sv_dir/dl_jsroot.sh
COPY scripts/set_ssl.sh /etc/ssl/
RUN /etc/ssl/set_ssl.sh
ENV JSROOTSYS=/sv_dir/jsroot
ENV WORKDIR=/sv_dir/Program_Go


FROM base AS user

ARG USERNAME
ARG GROUPNAME
ARG UID
ARG GID

RUN echo "Creating user: ${USERNAME} (${UID}:${GID})"
COPY scripts/set_user.sh /sv_dir/
RUN /sv_dir/set_user.sh ${USERNAME}:${GROUPNAME} ${UID}:${GID}
RUN chmod -R 755 /sv_dir/jsroot
RUN chown -R ${UID}:${GID} /sv_dir/jsroot

CMD ["/bin/bash"]
