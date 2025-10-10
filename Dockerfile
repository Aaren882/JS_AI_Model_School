# syntax=docker/dockerfile:1

# Comments are provided throughout this file to help you get started.
# If you need more help, visit the Dockerfile reference guide at
# https://docs.docker.com/go/dockerfile-reference/

# Want to help us make this template better? Share your feedback here: https://forms.gle/ybq9Krt8jtBL3iCk7

ARG NODE_VERSION=22.19.0
ARG GIT_VERSION_TAG=unspecified
ARG GIT_COMMIT_MESSAGE=unspecified
ARG GIT_VERSION_HASH=unspecified

FROM node:${NODE_VERSION}-alpine

# Use production node environment by default.
ENV NODE_ENV=production \
		OLLAMA_HOST_URL=http://ollama:11434 \
		OLLAMA_MODEL=gemma3 \
		DB_IP=DB_IP \
		DB_PW=password \
		DB_PORT=5432 \
		PORT=9000

VOLUME /var/lib/university_analyze
WORKDIR /usr/src/app

COPY package*.json ./

RUN npm install

# Read files for the information in your application
RUN echo $GIT_VERSION_TAG > GIT_VERSION_TAG.txt
RUN echo $GIT_COMMIT_MESSAGE > GIT_COMMIT_MESSAGE.txt
RUN echo $GIT_VERSION_HASH > GIT_VERSION_HASH.txt

# Download dependencies as a separate step to take advantage of Docker's caching.
# Leverage a cache mount to /root/.npm to speed up subsequent builds.
# Leverage a bind mounts to package.json and package-lock.json to avoid having to copy them into
# into this layer.
# RUN --mount=type=bind,source=package.json,target=package.json \
#     --mount=type=bind,source=package-lock.json,target=package-lock.json \
#     --mount=type=cache,target=/root/.npm \
#     npm ci --omit=dev

# Run the application as a non-root user.
USER node

# Copy the rest of the source files into the image.
COPY . .

# Expose the port that the application listens on.
EXPOSE 9000

# Run the application.
CMD ["npm","start"]
