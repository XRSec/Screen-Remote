# Ideas Backlog: Android Miuix UI Migration

- [ ] **Batch 1: Core DesignSystem Components**
  - `CommonSectionComponents.kt`: 迁移 Card / HorizontalDivider 至 MiuixCard / MiuixHorizontalDivider
  - `GroupSelectorDialogContent.kt`: 迁移 Card / HorizontalDivider 至 MiuixCard / MiuixHorizontalDivider
  - `TagFilterDialog.kt`: 迁移 Card 至 MiuixCard，Checkbox 保持或迁移至 MiuixCheckbox
  - `HelpComponents.kt` / `GroupSelectorDialog.kt` / `CommonDialogComponents.kt`: 迁移 TextButton 至 MiuixTextButton
  - `tree/TreeNode.kt`: 迁移 HorizontalDivider 至 MiuixHorizontalDivider
  - `LogViewerDialog.kt`: 迁移 Card / TextButton 至 MiuixCard / MiuixTextButton

- [ ] **Batch 2: Settings & Appearance Remnants**
  - `SettingsComponents.kt`: HorizontalDivider 迁移至 MiuixHorizontalDivider
  - `AppearanceScreen.kt`: HorizontalDivider 迁移至 MiuixHorizontalDivider
  - `AboutScreen.kt`: Card / CardDefaults / HorizontalDivider 迁移至 MiuixCard / MiuixHorizontalDivider

- [ ] **Batch 3: Remote Display & Connection Overlays**
  - `ConnectionStateOverlay.kt`: 迁移 Button / OutlinedButton / ButtonDefaults 至 MiuixButton / MiuixTextButton
  - `RemoteLayoutInspectorUi.kt` / `ConnectionProgressDialog.kt`: 确认统一 MiuixTheme 包装

- [ ] **Batch 4: Device & Usb Dialogs**
  - `AddDeviceDialog.kt`: 迁移 Material3 AlertDialog / Button / TextButton 至 IOSAlertDialog / MiuixTextButton
  - `UsbDeviceDialog.kt`: 迁移 TextButton 至 MiuixTextButton
  - `DevicePairingDialog.kt`: 残余 TextButton 迁移至 MiuixTextButton

- [ ] **Batch 5: Session Management Sub-pages**
  - `SessionManagementCommandPage.kt`: HorizontalDivider / TextButton 迁移
  - `SessionManagementAppsUi.kt`: HorizontalDivider 迁移
  - `SessionManagementPortForwardPage.kt`: Card / TextButton 迁移
  - `SessionManagementDialogs.kt`: TextButton 迁移
  - `SessionManagementFilesUi.kt`: TextButton 迁移
  - `ConnectionLatencyTestPage.kt`: Card / TextButton 迁移
  - `component/AddSessionDialog.kt`: 残余 TextButton 迁移
