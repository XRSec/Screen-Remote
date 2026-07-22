.PHONY: help release submodule wiki-resume emulator log logall getLine \
	_ensure-keystore _rename-release-apks _copy-release-apks

EMULATOR_NAME := Pixel_9

# 从 gradle.properties 读取版本号
VERSION_NAME := $(shell awk -F= '/^VERSION_NAME=/ { print $$2; exit }' Screen-Remote/gradle.properties)
VERSION_CODE := $(shell awk -F= '/^VERSION_CODE=/ { print $$2; exit }' Screen-Remote/gradle.properties)

# 路径配置
RELEASE_DIR := Screen-Remote/app/build/outputs/apk/release
RENAMED_RELEASE_DIR := Screen-Remote/app/build/outputs/renamed_apks/release
OUT_DIR := $(HOME)/Downloads

# 签名配置
KEYSTORE_FILE := Screen-Remote/release.keystore
KEYSTORE_PROPS := Screen-Remote/keystore.properties

help:
	@echo "可用命令："
	@echo "  make release   - 编译、重命名并复制 release APK"
	@echo "  make submodule - 无 tags 更新外部依赖，跳过 Screen-Remote/external/wiki"
	@echo "  make wiki-resume - 恢复中断的 pre-push Wiki 审读，不重新读取已完成上下文"
	@echo "  make emulator  - 启动 $(EMULATOR_NAME) 模拟器"
	@echo "  make log       - 查看远控主链路日志"
	@echo "  make logall    - 查看应用全部日志"
	@echo "  make getLine   - 统计 Android 应用 Kotlin 源码行数"

submodule:
	@node scripts/update-submodules.mjs

wiki-resume:
	@cd Screen-Remote && node .agents/skills/screen-remote-engineering/scripts/screen_remote_pre_push.mjs --resume

_ensure-keystore:
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

release: _ensure-keystore
	@echo "编译 release 版本（所有架构）..."
	cd Screen-Remote && ./gradlew assembleRelease
	@$(MAKE) --no-print-directory _rename-release-apks
	@$(MAKE) --no-print-directory _copy-release-apks OUT_DIR="$(OUT_DIR)"

_copy-release-apks:
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

_rename-release-apks:
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

emulator:
	@echo "启动虚拟机 $(EMULATOR_NAME)..."
	~/Library/Android/sdk/emulator/emulator -avd $(EMULATOR_NAME) -no-window &

log:
	@echo "查看应用日志 (Ctrl+C 退出)..."
	@adb logcat -c
	@adb logcat -v threadtime SSVR:D SKPK:D SCLI:D '*:S' 2>&1 | grep --line-buffered -E '\[server\] (INFO: Device:|DEBUG: Creating (video|audio) encoder)|scrcpy-server 已启动|开始连接 socket|video socket connected|audio socket connected|control socket connected|[Dd]ummy byte|自动交换|Socket 建链失败|video:device_meta|video device meta|video stream codec|video session meta parsed|读取视频元数据失败'

logall:
	@adb logcat -c && adb logcat --pid="$$(adb shell pidof -s com.screen.remote.android.debug)" -v threadtime '*:V'

getLine:
	@find Screen-Remote/app/src -type f -name "*.kt" -exec wc -l {} \; | sort
