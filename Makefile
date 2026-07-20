.PHONY: help build debug release rename-debug-apks rename-release-apks copy-release-apks install clean devices emulator run \
	submodule-update submodule-status

# 应用配置
APP_ID := com.screen.remote.android
EMULATOR_NAME := Pixel_9

# 子模块配置
SUBMODULES := \
	external/adb-mobile-ios \
	external/libadb-android \
	external/ScrcpyForAndroid-Miuzarte \
	external/dadb \
	external/Easycontrol \
	external/scrcpy \
	external/screen-remote-ios \
	external/Kadb \
	external/ScrcpyForAndroid

# 从 gradle.properties 读取版本号
VERSION_NAME := $(shell awk -F= '/^VERSION_NAME=/ { print $$2; exit }' Screen-Remote/gradle.properties)
VERSION_CODE := $(shell awk -F= '/^VERSION_CODE=/ { print $$2; exit }' Screen-Remote/gradle.properties)

# 路径配置
APK_DIR := Screen-Remote/app/build/outputs/apk
RENAMED_APK_DIR := Screen-Remote/app/build/outputs/renamed_apks
DEBUG_APK = $(shell find $(APK_DIR)/debug -name "*arm64-v8a-*.apk" 2>/dev/null | head -n 1)
RENAMED_DEBUG_DIR := $(RENAMED_APK_DIR)/debug
RELEASE_DIR := $(APK_DIR)/release
RENAMED_RELEASE_DIR := $(RENAMED_APK_DIR)/release
OUT_DIR := $(HOME)/Downloads

# 签名配置
KEYSTORE_FILE := Screen-Remote/release.keystore
KEYSTORE_PROPS := Screen-Remote/keystore.properties

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
	@echo "  make submodule-update - 更新依赖仓库主分支；dadb 只获取 upstream/master"
	@echo "  make submodule-status - 查看依赖仓库状态"
	@echo "  make start          - 启动应用"
	@echo "  make stop           - 停止应用"
	@echo "  make log            - 查看应用日志"
	@echo "  make log-focus FILE=/path/to/run.log    - 过滤业务主线日志"
	@echo "  make log-timeline FILE=/path/to/run.log - 过滤连接/解码时序日志"
	@echo "  make log-codec FILE=/path/to/run.log    - 保留编解码器细节日志"

build: debug

submodule-update:
	@echo "更新依赖仓库主分支（不取 tag）..."
	@set -e; \
	update() { \
		path="$$1"; local_branch="$$2"; remote="$$3"; remote_branch="$$4"; merge_mode="$$5"; \
		if ! git -C "$$path" rev-parse --git-dir >/dev/null 2>&1; then \
			git submodule update --init --depth 1 -- "$$path"; \
		fi; \
		if ! git -C "$$path" diff --quiet || ! git -C "$$path" diff --cached --quiet; then \
			echo "✗ $$path 有未提交修改，已停止"; \
			exit 1; \
		fi; \
		if git -C "$$path" show-ref --verify --quiet "refs/heads/$$local_branch"; then \
			git -C "$$path" checkout "$$local_branch"; \
		else \
			git -C "$$path" checkout -b "$$local_branch"; \
		fi; \
		echo "  → $$path: $$remote/$$remote_branch"; \
		git -C "$$path" fetch --no-tags "$$remote" "$$remote_branch"; \
		git -C "$$path" merge $$merge_mode FETCH_HEAD; \
	}; \
	update external/adb-mobile-ios main origin main --ff-only; \
	update external/libadb-android master origin master --ff-only; \
	update external/ScrcpyForAndroid-Miuzarte main origin main --ff-only; \
	update external/Easycontrol master origin master --ff-only; \
	update external/scrcpy master origin master --ff-only; \
	update external/screen-remote-ios main origin main --ff-only; \
	update external/Kadb main origin main --ff-only; \
	update external/ScrcpyForAndroid main origin main --ff-only; \
	if ! git -C external/dadb rev-parse --git-dir >/dev/null 2>&1; then \
		git submodule update --init --depth 1 -- external/dadb; \
	fi; \
	if ! git -C external/dadb remote get-url upstream >/dev/null 2>&1; then \
		git -C external/dadb remote add upstream git@github.com:mobile-dev-inc/dadb.git; \
	fi; \
	echo "  → external/dadb: 仅更新远程跟踪分支 upstream/master"; \
	git -C external/dadb fetch --no-tags upstream \
		'+refs/heads/master:refs/remotes/upstream/master'; \
	echo "    upstream/master = $$(git -C external/dadb rev-parse --short upstream/master)"
	@echo "✓ 依赖仓库已更新；wiki 和 Screen-Remote 未改动"

submodule-status:
	@echo "依赖仓库状态："
	@git submodule status -- $(SUBMODULES)

debug:
	@echo "编译 debug 版本..."
	cd Screen-Remote && ./gradlew assembleDebug
	@$(MAKE) rename-debug-apks

keystore:
	@if [ -f "$(KEYSTORE_FILE)" ]; then \
		echo "密钥已存在: $(KEYSTORE_FILE)"; \
	else \
		echo "生成签名密钥..."; \
		keytool -genkey -v -keystore $(KEYSTORE_FILE) \
			-alias Screen-Remote \
			-keyalg RSA -keysize 2048 -validity 10000 \
			-storepass android -keypass android \
			-dname "CN=Screen Remote, OU=Development, O=Scrcpy, L=Beijing, ST=Beijing, C=CN"; \
		echo "storeFile=release.keystore" > $(KEYSTORE_PROPS); \
		echo "storePassword=android" >> $(KEYSTORE_PROPS); \
		echo "keyAlias=Screen-Remote" >> $(KEYSTORE_PROPS); \
		echo "keyPassword=android" >> $(KEYSTORE_PROPS); \
		echo "✓ 密钥生成完成"; \
	fi

release: keystore
	@echo "编译 release 版本（所有架构）..."
	cd Screen-Remote && ./gradlew assembleRelease
	@$(MAKE) rename-release-apks
	@$(MAKE) copy-release-apks OUT_DIR="$(OUT_DIR)"

copy-release-apks:
	@echo "\n复制 APK 到输出目录..."
	@mkdir -p "$(OUT_DIR)"
	@set -e; \
	found=0; \
	for apk in "$(RENAMED_RELEASE_DIR)"/Screen.Remote-*.apk; do \
		[ -f "$$apk" ] || continue; \
		cp -f "$$apk" "$(OUT_DIR)/"; \
		echo "  ✓ $$(basename "$$apk")"; \
		found=1; \
	done; \
	if [ "$$found" -ne 1 ]; then \
		echo "✗ 未找到 release APK: $(RENAMED_RELEASE_DIR)/Screen.Remote-*.apk"; \
		exit 1; \
	fi
	@echo "\n✓ 完成，输出目录: $(OUT_DIR)"

rename-debug-apks:
	@echo "重命名 debug APK..."
	@mkdir -p $(RENAMED_DEBUG_DIR)
	@find $(RENAMED_DEBUG_DIR) -maxdepth 1 -name "*.apk" -delete
	@find $(APK_DIR)/debug -maxdepth 1 -name "app-*-debug.apk" | while read apk; do \
		name=$$(basename "$$apk"); \
		abi=$${name#app-}; abi=$${abi%-debug.apk}; \
		dest="$(RENAMED_DEBUG_DIR)/Screen.Remote-$$abi-$(VERSION_NAME).$(VERSION_CODE).apk"; \
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
		dest="$(RENAMED_RELEASE_DIR)/Screen.Remote-$$abi-$(VERSION_NAME).$(VERSION_CODE).apk"; \
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
	cd Screen-Remote && ./gradlew clean

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
	@adb logcat -c
	@adb logcat -v threadtime SSVR:D SKPK:D SCLI:D '*:S' 2>&1 | grep --line-buffered -E '\[server\] (INFO: Device:|DEBUG: Creating (video|audio) encoder)|scrcpy-server 已启动|开始连接 socket|video socket connected|audio socket connected|control socket connected|[Dd]ummy byte|自动交换|Socket 建链失败|video:device_meta|video device meta|video stream codec|video session meta parsed|读取视频元数据失败'

logall:
	@adb logcat -c && adb logcat --pid="$$(adb shell pidof -s com.screen.remote.android.debug)" -v threadtime '*:V'

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

adb.forward:
	socat TCP4-LISTEN:15555,bind=192.168.5.14,reuseaddr,fork TCP4:127.0.0.1:5555
