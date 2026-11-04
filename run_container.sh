#!/bin/bash

SCFULLNAME=`realpath $0`
SCPATH=`dirname $SCFULLNAME`
USERNAME=$(id -u -n)

cd $SCPATH

docker run \
 --rm \
 --net host \
 --runtime=nvidia \
 --gpus all \
 -e NVIDIA_VISIBLE_DEVICES=all \
 -e NVIDIA_DRIVER_CAPABILITIES=compute,utility \
 -w "/sv_dir" \
 -u ${UID}:$(id -g) \
 -v ${PWD}/Launcher:/sv_dir/Launcher \
 -v ${PWD}/Program_Go:/sv_dir/Program_Go \
 -it jsroot_forgo3d_${USERNAME} \
 /bin/bash

