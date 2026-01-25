# 树形分组功能实现方案

## 需求说明

实现类似文件管理器的树形分组结构：
1. 可以创建分组，每个分组有路径属性
2. 分组可以展开/折叠，显示子分组
3. 会话选择路径时，从已有路径中选择（不是手动输入）
4. 新创建的会话默认在 `/` 根目录

## 数据结构设计

### 1. 分组数据 (GroupData)
```kotlin
@Serializable
data class GroupData(
    val id: String,
    val name: String,              // 分组名称，如 "HZ"
    val path: String,              // 完整路径，如 "/FRP/HZ"
    val parentPath: String = "/",  // 父路径，如 "/FRP"
    val description: String = "",
    val createdAt: Long = System.currentTimeMillis()
)
```

### 2. 会话数据 (SessionData)
```kotlin
@Serializable
data class SessionData(
    // ... 其他字段
    val groupPath: String = "/"  // 所在路径，默认根目录
)
```

### 3. 树形节点 (TreeNode)
```kotlin
data class GroupTreeNode(
    val group: DeviceGroup,
    val children: List<GroupTreeNode> = emptyList(),
    val isExpanded: Boolean = false,
    val level: Int = 0  // 层级深度，用于缩进
)
```

## UI 设计

### 1. 分组管理界面（树形展示）

```
┌─────────────────────────────────┐
│  管理分组              [+] [完成] │
├─────────────────────────────────┤
│  📁 / (根目录)          (3)      │
│    ▼ 📁 FRP             (2)      │
│        📁 HZ            (1)  [⚙] │
│        📁 JX            (1)  [⚙] │
│    ▼ 📁 LOCAL           (2)      │
│        📁 HZ            (1)  [⚙] │
│        📁 JX            (1)  [⚙] │
└─────────────────────────────────┘

说明：
- ▼/▶ 表示展开/折叠
- (数字) 表示该路径下的会话数量
- [⚙] 表示编辑/删除按钮
```

### 2. 添加分组对话框

```
┌─────────────────────────────────┐
│  添加分组              [取消][保存]│
├─────────────────────────────────┤
│  分组名称                        │
│  ┌─────────────────────────────┐│
│  │ HZ                          ││
│  └─────────────────────────────┘│
│                                 │
│  父路径                          │
│  ┌─────────────────────────────┐│
│  │ /FRP              [选择] ▼  ││
│  └─────────────────────────────┘│
│                                 │
│  完整路径预览                    │
│  /FRP/HZ                        │
│                                 │
│  描述（可选）                    │
│  ┌─────────────────────────────┐│
│  │                             ││
│  └─────────────────────────────┘│
└─────────────────────────────────┘
```

### 3. 会话选择路径

```
┌─────────────────────────────────┐
│  选择路径              [取消][确定]│
├─────────────────────────────────┤
│  ○ / (根目录)                    │
│  ○ /FRP                         │
│    ○ /FRP/HZ                    │
│    ○ /FRP/JX                    │
│  ○ /LOCAL                       │
│    ○ /LOCAL/HZ                  │
│    ○ /LOCAL/JX                  │
└─────────────────────────────────┘
```

## 核心功能实现

### 1. GroupRepository 恢复使用
```kotlin
class GroupRepository(private val context: Context) {
    // 持久化分组数据
    suspend fun addGroup(groupData: GroupData)
    suspend fun removeGroup(id: String)
    suspend fun updateGroup(groupData: GroupData)
    suspend fun getGroup(id: String): DeviceGroup?
    val groupsFlow: Flow<List<DeviceGroup>>
}
```

### 2. MainViewModel 分组管理
```kotlin
// 分组列表（从 Repository 加载）
val groups: StateFlow<List<DeviceGroup>>

// 构建树形结构
fun buildGroupTree(): List<GroupTreeNode>

// 分组管理
fun addGroup(name: String, parentPath: String)
fun removeGroup(groupId: String)
fun updateGroup(group: DeviceGroup)

// 路径筛选
fun selectGroup(groupPath: String)
val filteredSessions: StateFlow<List<SessionData>>
```

### 3. 树形结构构建算法
```kotlin
fun buildGroupTree(groups: List<DeviceGroup>): List<GroupTreeNode> {
    val groupMap = groups.associateBy { it.path }
    val rootNodes = mutableListOf<GroupTreeNode>()
    
    fun buildNode(path: String, level: Int): GroupTreeNode? {
        val group = groupMap[path] ?: return null
        val children = groups
            .filter { it.parentPath == path }
            .mapNotNull { buildNode(it.path, level + 1) }
        return GroupTreeNode(group, children, false, level)
    }
    
    // 构建根节点的子节点
    groups.filter { it.parentPath == "/" }
        .forEach { group ->
            buildNode(group.path, 0)?.let { rootNodes.add(it) }
        }
    
    return rootNodes
}
```

## UI 组件实现

### 1. GroupTreeView (树形分组列表)
```kotlin
@Composable
fun GroupTreeView(
    nodes: List<GroupTreeNode>,
    sessionCounts: Map<String, Int>,
    onNodeClick: (GroupTreeNode) -> Unit,
    onEditClick: (DeviceGroup) -> Unit,
    onDeleteClick: (DeviceGroup) -> Unit
)
```

### 2. GroupTreeNode (树形节点项)
```kotlin
@Composable
fun GroupTreeNodeItem(
    node: GroupTreeNode,
    sessionCount: Int,
    onNodeClick: () -> Unit,
    onEditClick: () -> Unit,
    onDeleteClick: () -> Unit
)
```

### 3. PathSelectorDialog (路径选择对话框)
```kotlin
@Composable
fun PathSelectorDialog(
    groups: List<DeviceGroup>,
    selectedPath: String,
    onPathSelected: (String) -> Unit,
    onDismiss: () -> Unit
)
```

### 4. AddGroupDialog (添加分组对话框)
```kotlin
@Composable
fun AddGroupDialog(
    availablePaths: List<String>,
    onConfirm: (name: String, parentPath: String, description: String) -> Unit,
    onDismiss: () -> Unit
)
```

## 实现步骤

### 阶段 1：恢复分组管理基础
1. ✅ 恢复 GroupRepository
2. ✅ 在 MainViewModel 中添加分组管理方法
3. ✅ 在 SettingsScreen 添加分组管理入口

### 阶段 2：实现树形结构
1. 创建 GroupTreeNode 数据类
2. 实现树形结构构建算法
3. 创建 GroupTreeView 组件
4. 实现展开/折叠功能

### 阶段 3：分组管理 UI
1. 创建树形分组管理对话框
2. 实现添加分组对话框（带父路径选择）
3. 实现编辑/删除功能
4. 显示每个路径下的会话数量

### 阶段 4：会话路径选择
1. 创建路径选择对话框
2. 在 SessionDialog 中集成路径选择
3. 默认路径设置为 "/"

### 阶段 5：筛选功能
1. 修改 GroupFilterBar 显示树形路径
2. 实现路径前缀匹配筛选
3. 显示每个路径的会话数量

## 优势

1. **直观的层级结构**：像文件管理器一样易于理解
2. **灵活的组织方式**：支持任意层级深度
3. **美观的 UI**：树形展示，可展开/折叠
4. **便捷的操作**：点击选择，无需手动输入
5. **统计信息**：显示每个路径下的会话数量

## 示例场景

### 创建分组结构
```
1. 创建 "FRP" 分组，父路径 "/"
   → 完整路径：/FRP

2. 创建 "HZ" 分组，父路径 "/FRP"
   → 完整路径：/FRP/HZ

3. 创建 "Z5" 分组，父路径 "/FRP/HZ"
   → 完整路径：/FRP/HZ/Z5
```

### 会话分配
```
1. 创建会话 "Z5-1"
2. 选择路径：/FRP/HZ/Z5
3. 保存
```

### 筛选查看
```
- 选择 "/" → 显示所有会话
- 选择 "/FRP" → 显示 /FRP/* 下的所有会话
- 选择 "/FRP/HZ" → 显示 /FRP/HZ/* 下的所有会话
```
