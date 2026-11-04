#!/bin/bash

SCFULLNAME=`realpath $0`
SCPATH=`dirname $SCFULLNAME`
LOGNAME="proc_SV.log"

cd "${WORKDIR}"
${SCPATH}/scripts/insert_files.sh ${SCPATH}/insert_files/ProgramGo_SV_files.txt
${SCPATH}/scripts/insert_files.sh ${SCPATH}/insert_files/GoGame_files.txt

date > "${JSROOTSYS}/${LOGNAME}"
root -l -b SetSV.C++\("\"${LOGNAME}\""\) 2>&1 | tee -a ${JSROOTSYS}/${LOGNAME}
