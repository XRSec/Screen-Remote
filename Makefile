.PHONY: help build debug release install clean devices emulator run

# 应用配置
APP_ID := com.mobile.scrcpy.android
EMULATOR_NAME := Pixel_9

# 从 gradle.properties 读取版本号
VERSION_NAME := $(shell grep '^VERSION_NAME=' scrcpy-mobile/gradle.properties | cut -d'=' -f2)
VERSION_CODE := $(shell grep '^VERSION_CODE=' scrcpy-mobile/gradle.properties | cut -d'=' -f2)

# 路径配置
APK_DIR := scrcpy-mobile/app/build/outputs/apk
DEBUG_APK := $(APK_DIR)/debug/app-debug.apk
RELEASE_DIR := $(APK_DIR)/release
OUT_DIR := $(HOME)/Downloads

# 签名配置
KEYSTORE_FILE := scrcpy-mobile/release.keystore
KEYSTORE_PROPS := scrcpy-mobile/keystore.properties

help:
	@echo "可用命令："
	@echo "  make build          - 编译 debug 版本"
	@echo "  make debug          - 编译 debug 版本"
	@echo "  make keystore       - 生成签名密钥"
	@echo "  make release        - 编译 release 版本（所有架构）"
	@echo "  make install        - 安装 debug 版本"
	@echo "  make uninstall      - 卸载应用"
	@echo "  make clean          - 清理构建文件"
	@echo "  make devices        - 列出连接的设备"
	@echo "  make emulator       - 启动虚拟机"
	@echo "  make run            - 编译、安装并启动 debug"
	@echo "  make start          - 启动应用"
	@echo "  make stop           - 停止应用"
	@echo "  make log            - 查看应用日志"

build: debug

debug:
	@echo "编译 debug 版本..."
	cd scrcpy-mobile && ./gradlew assembleDebug

keystore:
	@if [ -f "$(KEYSTORE_FILE)" ]; then \
		echo "密钥已存在: $(KEYSTORE_FILE)"; \
	else \
		echo "生成签名密钥..."; \
		keytool -genkey -v -keystore $(KEYSTORE_FILE) \
			-alias scrcpy-mobile \
			-keyalg RSA -keysize 2048 -validity 10000 \
			-storepass android -keypass android \
			-dname "CN=Scrcpy Mobile, OU=Development, O=Scrcpy, L=Beijing, ST=Beijing, C=CN"; \
		echo "storeFile=release.keystore" > $(KEYSTORE_PROPS); \
		echo "storePassword=android" >> $(KEYSTORE_PROPS); \
		echo "keyAlias=scrcpy-mobile" >> $(KEYSTORE_PROPS); \
		echo "keyPassword=android" >> $(KEYSTORE_PROPS); \
		echo "✓ 密钥生成完成"; \
	fi

release: keystore
	@echo "编译 release 版本（所有架构）..."
	cd scrcpy-mobile && ./gradlew assembleRelease
	@echo "\n打包 APK 到 ZIP..."
	@mkdir -p $(OUT_DIR)
	@find $(RELEASE_DIR) -maxdepth 1 -name "Screen Remote-*.apk" | while read apk; do \
		filename=$$(basename "$$apk" .apk); \
		zip -j -9 "$(OUT_DIR)/$$filename.zip" "$$apk"; \
		echo "  ✓ $$filename.zip"; \
	done
	@echo "\n✓ 完成，输出目录: $(OUT_DIR)"

install: debug
	@echo "安装 debug 版本..."
	adb install -r $(DEBUG_APK)
	@echo "✓ 安装完成"

uninstall:
	@echo "卸载应用..."
	adb uninstall $(APP_ID)

clean:
	@echo "清理构建文件..."
	cd scrcpy-mobile && ./gradlew clean

devices:
	@echo "已连接的设备："
	@adb devices -l

emulator:
	@echo "启动虚拟机 $(EMULATOR_NAME)..."
	~/Library/Android/sdk/emulator/emulator -avd $(EMULATOR_NAME) -no-window &

start:
	@echo "启动应用..."
	adb shell am start -n $(APP_ID)/$(APP_ID).MainActivity

stop:
	@echo "停止应用..."
	adb shell am force-stop $(APP_ID)

log:
	@echo "查看应用日志 (Ctrl+C 退出)..."
	@adb logcat -s "AdbManager:*" "ScrcpyClient:*" -v brief

run: install start
	@echo "✓ 应用已启动"

info:
	@echo "应用信息："
	@echo "  包名: $(APP_ID)"
	@echo "  版本: $(VERSION_NAME) ($(VERSION_CODE))"
	@echo "  Debug APK: $(DEBUG_APK)"
	@echo "  Release 目录: $(RELEASE_DIR)"
