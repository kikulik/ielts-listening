# IELTS Listening Practice: a static site served by nginx.
#
# Stage 1 checks the code (file and function sizes, no copied functions) and every test
# (structure, answer key, word limits, answers heard in order) and stops the build on any error.
# Stage 2 serves the site. It copies the scripts and data from stage 1, so the checks always run.
# The audio is recorded beforehand on the host (tools/audio/synth.py) and copied in as files.

FROM node:24-bookworm-slim AS check
WORKDIR /app
COPY index.html ./
COPY js ./js
COPY css ./css
COPY tests ./tests
COPY tools/*.cjs ./tools/
COPY data ./data
RUN node tests/lint.cjs && node tests/check-tests.cjs

FROM nginx:1.29-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY index.html /usr/share/nginx/html/index.html
COPY css /usr/share/nginx/html/css
COPY img /usr/share/nginx/html/img
COPY audio /usr/share/nginx/html/audio
COPY --from=check /app/js /usr/share/nginx/html/js
COPY --from=check /app/data /usr/share/nginx/html/data
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- http://127.0.0.1/ >/dev/null || exit 1
