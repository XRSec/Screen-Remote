.PHONY: help build debug release install install-debug install-release uninstall clean start stop log devices emulator

# 应用配置
APP_ID := com.mobile.scrcpy.android
APK_DEBUG := scrcpy-mobile/app/build/outputs/apk/debug/app-debug.apk
APK_RELEASE := scrcpy-mobile/app/build/outputs/apk/release/app-release.apk
EMULATOR_NAME := Pixel_9

# 签名配置
KEYSTORE_FILE := scrcpy-mobile/release.keystore
KEYSTORE_PROPS := scrcpy-mobile/keystore.properties

# 默认目标
help:
	@echo "可用命令："
	@echo "  make emulator       - 启动虚拟机 ($(EMULATOR_NAME))"
	@echo "  make build          - 编译 debug 版本"
	@echo "  make debug          - 编译 debug 版本"
	@echo "  make keystore       - 生成签名密钥"
	@echo "  make release        - 编译 release 版本（带签名）"
	@echo "  make install        - 编译并安装 debug 版本到设备"
	@echo "  make install-debug  - 编译并安装 debug 版本"
	@echo "  make install-release- 编译并安装 release 版本"
	@echo "  make uninstall      - 卸载应用"
	@echo "  make clean          - 清理构建文件"
	@echo "  make start          - 启动应用"
	@echo "  make stop           - 停止应用"
	@echo "  make log            - 查看应用日志"
	@echo "  make log-adb        - 查看 ADB 相关日志（简洁）"
	@echo "  make log-recent     - 查看最近日志（简洁）"
	@echo "  make devices        - 列出连接的设备"
	@echo "  make run            - 编译、安装并启动 debug 版本"
	@echo "  make test-adb       - 测试 ADB 连接脚本"

# 测试 ADB 连接
test-adb:
	@echo "测试 ADB 连接..."
	kotlinc external/adb-mobile/src/test/kotlin/com/mobile/adb/android/AdbTest.kt -include-runtime -d /tmp/AdbTest.jar && java -jar /tmp/AdbTest.jar

# 编译 debug 版本
build: debug

debug:
	@echo "正在编译 debug 版本..."
	cd scrcpy-mobile && ./gradlew assembleDebug -Pandroid.injected.abi=arm64-v8a

# 生成签名密钥
keystore:
	@if [ -f "$(KEYSTORE_FILE)" ]; then \
		echo "密钥文件已存在: $(KEYSTORE_FILE)"; \
	else \
		echo "正在生成签名密钥..."; \
		keytool -genkey -v -keystore $(KEYSTORE_FILE) \
			-alias scrcpy-mobile \
			-keyalg RSA -keysize 2048 -validity 10000 \
			-storepass android -keypass android \
			-dname "CN=Scrcpy Mobile, OU=Development, O=Scrcpy, L=Beijing, ST=Beijing, C=CN"; \
		echo "密钥生成完成！"; \
		echo "storeFile=release.keystore" > $(KEYSTORE_PROPS); \
		echo "storePassword=android" >> $(KEYSTORE_PROPS); \
		echo "keyAlias=scrcpy-mobile" >> $(KEYSTORE_PROPS); \
		echo "keyPassword=android" >> $(KEYSTORE_PROPS); \
		echo "配置文件已创建: $(KEYSTORE_PROPS)"; \
	fi

# 编译 release 版本（带签名）
release: keystore
	@echo "正在编译 release 版本..."
	cd scrcpy-mobile && ./gradlew assembleRelease
	@echo "Release APK 已生成: $(APK_RELEASE)"
	cp scrcpy-mobile/app/build/outputs/apk/release/app-release.apk Screen_Remote_4.4.1_arm64-v8a.apk
	zip -j -9 ~/Downloads/Screen_Remote_4.4.1_arm64-v8a.zip Screen_Remote_4.4.1_arm64-v8a.apk
	rm Screen_Remote_4.4.1_arm64-v8a.apk

# 安装 debug 版本
install: install-debug

install-debug: debug
	@echo "正在安装 debug 版本到设备..."
	adb install -r $(APK_DEBUG)
	@echo "安装完成！"

# 安装 release 版本
install-release: release
	@echo "正在安装 release 版本到设备..."
	adb install -r $(APK_RELEASE)
	@echo "安装完成！"

# 卸载应用
uninstall:
	@echo "正在卸载应用..."
	adb uninstall $(APP_ID)

# 清理构建文件
clean:
	@echo "正在清理构建文件..."
	cd scrcpy-mobile && ./gradlew clean

# 启动应用
start:
	@echo "正在启动应用..."
	adb shell am start -n $(APP_ID)/$(APP_ID).MainActivity

# 停止应用
stop:
	@echo "正在停止应用..."
	adb shell am force-stop $(APP_ID)

# 查看应用日志
log:
	@echo "查看应用日志 (Ctrl+C 退出)..."
	@adb logcat -s "AdbManager:*" "AdbProtocol:*" "AdbKeyManager:*" "ScrcpyClient:*" -v brief | awk '{$$1=$$2=""; print substr($$0,3)}'

log2:
	@adb logcat -v time Decoder:D Audio:D CCodec:D Video:D Media:D Track:D *:S

# 列出连接的设备
devices:
	@echo "已连接的设备："
	adb devices -l

# 启动虚拟机
emulator:
	@echo "正在启动虚拟机 $(EMULATOR_NAME) (后台无窗口模式)..."
	~/Library/Android/sdk/emulator/emulator -avd $(EMULATOR_NAME) -port 5555 -no-window -netdelay none -netspeed full -port 5556 -gpu swiftshader_indirect -no-snapshot &
	

# 编译、安装并启动
run: install-debug start
	@echo "应用已启动！"

# 重新安装（卸载后安装）
reinstall: uninstall install
	@echo "重新安装完成！"

# 查看应用信息
info:
	@echo "应用包名: $(APP_ID)"
	@echo "Debug APK: $(APK_DEBUG)"
	@echo "Release APK: $(APK_RELEASE)"
	@adb shell dumpsys package $(APP_ID) | grep -A 3 "versionName"

git-submodule-init:
	@git submodule update --init --depth 1

adbkey:
	@adb push ~/.android/adbkey* /sdcard/Android/data/com.mobile.scrcpy.android/files/Documents/