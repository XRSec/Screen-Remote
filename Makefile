.PHONY: help build debug release rename-debug-apks rename-release-apks install clean devices emulator run \
	submodule-sync submodule-update submodule-status \
	submodule-sync-all submodule-update-all submodule-status-all

# 应用配置
APP_ID := com.mobile.scrcpy.android
EMULATOR_NAME := Pixel_9

# 子模块配置
ALL_SUBMODULES ?= $(shell git config -f .gitmodules --get-regexp '^submodule\..*\.path$$' | awk '{ print $$2 }')
EXTERNAL_SUBMODULES ?= $(shell git config -f .gitmodules --get-regexp '^submodule\..*\.path$$' | awk '$$2 ~ /^external\// { print $$2 }')

# 从 gradle.properties 读取版本号
VERSION_NAME := $(shell awk -F= '/^VERSION_NAME=/ { print $$2; exit }' scrcpy-mobile/gradle.properties)
VERSION_CODE := $(shell awk -F= '/^VERSION_CODE=/ { print $$2; exit }' scrcpy-mobile/gradle.properties)

# 路径配置
APK_DIR := scrcpy-mobile/app/build/outputs/apk
RENAMED_APK_DIR := scrcpy-mobile/app/build/outputs/renamed_apks
DEBUG_APK := $(shell find scrcpy-mobile/app/build/outputs/apk/debug -name "*arm64-v8a-*.apk")
RENAMED_DEBUG_DIR := $(RENAMED_APK_DIR)/debug
RELEASE_DIR := $(APK_DIR)/release
RENAMED_RELEASE_DIR := $(RENAMED_APK_DIR)/release
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
	@echo "  make rename-debug-apks   - 复制并重命名 debug APK"
	@echo "  make rename-release-apks - 复制并重命名 release APK"
	@echo "  make install        - 安装 debug 版本"
	@echo "  make uninstall      - 卸载应用"
	@echo "  make clean          - 清理构建文件"
	@echo "  make devices        - 列出连接的设备"
	@echo "  make emulator       - 启动虚拟机"
	@echo "  make run            - 编译、安装并启动 debug"
	@echo "  make submodule-sync - 同步 external 目录子模块 URL 配置（不递归）"
	@echo "  make submodule-update - 更新 external 目录子模块到父仓库记录的提交（不递归）"
	@echo "  make submodule-status - 查看 external 目录子模块状态"
	@echo "  make submodule-sync-all - 同步所有子模块 URL 配置（不递归）"
	@echo "  make submodule-update-all - 更新所有子模块到父仓库记录的提交（不递归）"
	@echo "  make submodule-status-all - 查看所有子模块状态"
	@echo "  make start          - 启动应用"
	@echo "  make stop           - 停止应用"
	@echo "  make log            - 查看应用日志"
	@echo "  make log-focus FILE=/path/to/run.log    - 过滤业务主线日志"
	@echo "  make log-timeline FILE=/path/to/run.log - 过滤连接/解码时序日志"
	@echo "  make log-codec FILE=/path/to/run.log    - 保留编解码器细节日志"

build: debug

submodule-sync:
	@echo "同步子模块配置（不递归）..."
	@git submodule sync -- $(EXTERNAL_SUBMODULES)
	@echo "✓ 子模块配置已同步"

submodule-update:
	@echo "更新 external 目录子模块（不递归）..."
	@git submodule update --init --checkout --depth 1 -- $(EXTERNAL_SUBMODULES)
	@echo "✓ external 目录子模块已更新到父仓库记录的提交"

submodule-status:
	@echo "external 目录子模块状态："
	@git submodule status -- $(EXTERNAL_SUBMODULES)

submodule-sync-all:
	@echo "同步所有子模块配置（不递归）..."
	@git submodule sync -- $(ALL_SUBMODULES)
	@echo "✓ 所有子模块配置已同步"

submodule-update-all:
	@echo "更新所有子模块（不递归）..."
	@git submodule update --init --checkout --depth 1 -- $(ALL_SUBMODULES)
	@echo "✓ 所有子模块已更新到父仓库记录的提交"

submodule-status-all:
	@echo "所有子模块状态："
	@git submodule status -- $(ALL_SUBMODULES)

debug:
	@echo "编译 debug 版本..."
	cd scrcpy-mobile && ./gradlew assembleDebug
	@$(MAKE) rename-debug-apks

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
	@$(MAKE) rename-release-apks
	@echo "\n复制 APK 到输出目录..."
	@mkdir -p $(OUT_DIR)
	@find $(RENAMED_RELEASE_DIR) -maxdepth 1 -name "Screen Remote-*.apk" | while read apk; do \
		cp -f "$$apk" "$(OUT_DIR)/"; \
		echo "  ✓ $$(basename "$$apk")"; \
	done
	@echo "\n✓ 完成，输出目录: $(OUT_DIR)"

rename-debug-apks:
	@echo "重命名 debug APK..."
	@mkdir -p $(RENAMED_DEBUG_DIR)
	@find $(RENAMED_DEBUG_DIR) -maxdepth 1 -name "*.apk" -delete
	@find $(APK_DIR)/debug -maxdepth 1 -name "app-*-debug.apk" | while read apk; do \
		name=$$(basename "$$apk"); \
		abi=$${name#app-}; abi=$${abi%-debug.apk}; \
		dest="$(RENAMED_DEBUG_DIR)/Screen Remote-$$abi-$(VERSION_NAME)_$(VERSION_CODE).apk"; \
		cp -f "$$apk" "$$dest"; \
		echo "  ✓ $$(basename "$$dest")"; \
	done

rename-release-apks:
	@echo "重命名 release APK..."
	@mkdir -p $(RENAMED_RELEASE_DIR)
	@find $(RENAMED_RELEASE_DIR) -maxdepth 1 -name "*.apk" -delete
	@find $(RELEASE_DIR) -maxdepth 1 -name "app-*-release.apk" | while read apk; do \
		name=$$(basename "$$apk"); \
		abi=$${name#app-}; abi=$${abi%-release.apk}; \
		dest="$(RENAMED_RELEASE_DIR)/Screen Remote-$$abi-$(VERSION_NAME)_$(VERSION_CODE).apk"; \
		cp -f "$$apk" "$$dest"; \
		echo "  ✓ $$(basename "$$dest")"; \
	done

install: debug
	@echo "安装 debug 版本..."
	adb install -r "$(DEBUG_APK)"
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
#	@adb logcat -s "AdbManager:*" "ScrcpyClient:*" -v brief
	@adb logcat -c
	@adb shell "run-as com.mobile.scrcpy.android.debug sh -c 'latest=\$(ls -t files/logs | head -n 1); tail -f files/logs/\$latest'"


run: install start
	@echo "✓ 应用已启动"

getLine:
	@find . -type f -name "*.kt" -exec wc -l {} \; | sort

info:
	@echo "应用信息："
	@echo "  包名: $(APP_ID)"
	@echo "  版本: $(VERSION_NAME) ($(VERSION_CODE))"
	@echo "  Debug APK: $(DEBUG_APK)"
	@echo "  Release 目录: $(RELEASE_DIR)"
