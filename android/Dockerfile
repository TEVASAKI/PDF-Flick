# PDF Flick - Android Development Environment
# Base Image: Ubuntu 22.04
FROM ubuntu:22.04

# Environment Variables
ENV ANDROID_HOME=/opt/android-sdk \
    JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64 \
    PATH=$PATH:$ANDROID_HOME/cmdline-tools/latest/bin:$ANDROID_HOME/platform-tools:$ANDROID_HOME/emulator \
    DEBIAN_FRONTEND=noninteractive

# Install Basic Packages
RUN apt-get update && apt-get install -y \
    curl \
    wget \
    git \
    unzip \
    openjdk-17-jdk \
    android-sdk-platform-tools \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Install Android SDK
RUN mkdir -p $ANDROID_HOME && \
    cd $ANDROID_HOME && \
    wget -q https://dl.google.com/android/repository/commandlinetools-linux-10406996_latest.zip && \
    unzip -q commandlinetools-linux-10406996_latest.zip && \
    rm commandlinetools-linux-10406996_latest.zip && \
    mkdir -p cmdline-tools/latest && \
    mv cmdline-tools/* cmdline-tools/latest/ 2>/dev/null || true

# Install Android SDK Components
RUN yes | sdkmanager --sdk_root=$ANDROID_HOME \
    "platforms;android-34" \
    "build-tools;34.0.0" \
    "platform-tools" \
    "tools" \
    "cmdline-tools;latest"

# Install Node.js and npm
RUN curl -fsSL https://deb.nodesource.com/setup_22.x | bash - && \
    apt-get install -y nodejs && \
    rm -rf /var/lib/apt/lists/*

# Install Expo CLI and EAS CLI
RUN npm install -g expo-cli eas-cli

# Set Working Directory
WORKDIR /app

# Expose Ports
EXPOSE 8081 19000 19001

# Default Command
CMD ["/bin/bash"]
