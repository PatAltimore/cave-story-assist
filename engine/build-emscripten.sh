#!/bin/bash
# Standalone Emscripten build of NXEngine (EXL fork). Run from anywhere after
# putting emcc on PATH (e.g. `source tools/emsdk-env.sh`).
#
# Output: web/nx.js, web/nx.wasm, web/nx.data (the engine plus the English freeware
# game data, which the engine extracts into its own format on first boot).
set -e
cd "$(dirname "$0")"

OUT=../web
STAGE=build-em/staging
mkdir -p build-em "$OUT"

# Files the engine expects in its working directory.
rm -rf "$STAGE" && mkdir -p "$STAGE"
cp -r ../data/en/Doukutsu.exe ../data/en/data "$STAGE/"
cp smalfont.bmp sprites.sif tilekey.dat "$STAGE/"
cp data/*.pbm "$STAGE/data/"   # widescreen backdrops shipped with the engine fork

SRCS=$(find . -name '*.cpp' -not -path './build-em/*' -not -path './tools/*' -not -name fbdev.cpp | sort)

CFLAGS="-sUSE_SDL=2 -O2 -w -Isdl1compat -I. -DNDEBUG"
OBJS=""
for src in $SRCS; do
  obj="build-em/$(echo "${src#./}" | tr '/' '_').o"
  extra=""
  # assist.cpp is always rebuilt: it stamps the build id that saved states are checked against
  if [ "$src" = "./assist.cpp" ]; then extra="-DASSIST_BUILD=$(date +%s)"; rm -f "$obj"; fi
  if [ ! -f "$obj" ] || [ "$src" -nt "$obj" ]; then
    echo "CXX $src"
    em++ $CFLAGS $extra -c "$src" -o "$obj" &
    # throttle to 8 parallel jobs
    while [ "$(jobs -r | wc -l)" -ge 8 ]; do sleep 0.2; done
  fi
  OBJS="$OBJS $obj"
done
wait

em++ -sUSE_SDL=2 -O2 $OBJS -o "$OUT/nx.js" \
  -sASYNCIFY -sINITIAL_MEMORY=64MB -sALLOW_MEMORY_GROWTH=1 -sENVIRONMENT=web \
  -sEXPORTED_FUNCTIONS=_main \
  -sEXPORTED_RUNTIME_METHODS=ccall,cwrap,FS,UTF8ToString,HEAPU8,HEAPU32 \
  -lidbfs.js \
  --preload-file "$STAGE@/"
echo "built $OUT/nx.js"
