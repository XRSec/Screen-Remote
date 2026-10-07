use crate::adb;
use quick_xml::events::Event;
use quick_xml::reader::Reader;
use regex::Regex;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::LazyLock;

static BOUNDS_REGEX: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(r"\[(-?\d+),(-?\d+)\]\[(-?\d+),(-?\d+)\]").expect("Invalid regex")
});
static WHITESPACE_REGEX: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"\s+").expect("Invalid regex"));
static CAMEL_CASE_REGEX: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"([a-z])([A-Z])").expect("Invalid regex"));
static RESOURCE_SEPARATOR_REGEX: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"[_\-.]+").expect("Invalid regex"));

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RemoteUiLayoutBounds {
    pub left: i32,
    pub top: i32,
    pub right: i32,
    pub bottom: i32,
    pub width: i32,
    pub height: i32,
}

impl RemoteUiLayoutBounds {
    pub fn new(left: i32, top: i32, right: i32, bottom: i32) -> Self {
        let width = (right - left).max(0);
        let height = (bottom - top).max(0);
        Self {
            left,
            top,
            right,
            bottom,
            width,
            height,
        }
    }

    pub fn has_area(&self) -> bool {
        self.width > 0 && self.height > 0
    }

    pub fn area(&self) -> i64 {
        self.width as i64 * self.height as i64
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum RemoteUiLayoutNodeKind {
    Input,
    Button,
    Text,
    Toggle,
    Image,
    Container,
    Other,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum RemoteUiLayoutLabelSource {
    Text,
    ContentDescription,
    ResourceId,
    Fallback,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RemoteUiLayoutNode {
    pub bounds: RemoteUiLayoutBounds,
    pub label: String,
    pub label_source: RemoteUiLayoutLabelSource,
    pub component_key: Option<String>,
    pub kind: RemoteUiLayoutNodeKind,
    pub package_name: String,
    pub class_name: String,
    pub resource_id: String,
    pub text: String,
    pub content_description: String,
    pub is_leaf: bool,
    pub clickable: bool,
    pub enabled: bool,
    pub focusable: bool,
    pub focused: bool,
    pub checkable: bool,
    pub checked: bool,
    pub selected: bool,
    pub scrollable: bool,
    pub password: bool,
    pub visible_to_user: bool,
    pub has_input_descendant: bool,
    pub has_text_descendant: bool,
    pub has_button_descendant: bool,
    pub has_check_indicator_descendant: bool,
    pub xpath: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RemoteUiLayoutSnapshot {
    pub viewport_bounds: RemoteUiLayoutBounds,
    pub nodes: Vec<RemoteUiLayoutNode>,
}

#[derive(Debug, Clone)]
struct ParsedXmlNode {
    name: String,
    attributes: HashMap<String, String>,
    children: Vec<ParsedXmlNode>,
}

#[derive(Debug, Clone)]
struct ParsedLabel {
    text: String,
    source: RemoteUiLayoutLabelSource,
}

#[derive(Debug, Clone, Default)]
struct DescendantSummary {
    has_input: bool,
    has_text: bool,
    has_button: bool,
    has_check_indicator: bool,
    first_text_label: Option<ParsedLabel>,
    first_content_description_label: Option<ParsedLabel>,
}

impl DescendantSummary {
    fn primary_label(&self) -> Option<ParsedLabel> {
        self.first_text_label
            .clone()
            .or_else(|| self.first_content_description_label.clone())
    }
}

const COMMON_RESOURCE_GENERIC_TOKENS: &[&str] = &[
    "btn", "iv", "img", "icon", "layout", "view", "container", "item", "tv", "et", "ll", "rl", "fl",
    "ali", "user", "guide", "image", "navigation", "bar", "label", "labels", "group", "small",
];

const GENERIC_LABELS: &[&str] = &[
    "divider", "separator", "icon", "image", "background", "lottie", "animation", "button",
    "toggle", "checkbox", "radio", "switch", "view", "layout", "container", "prefix", "suffix",
    "start", "end", "left", "right",
];

const SYMBOL_ONLY_LABELS: &[&str] = &["✓", "✔", "☑", "√", "v", "V"];

const IGNORED_RESOURCE_NAMES: &[&str] = &[
    "navigationbarbackground",
    "statusbarbackground",
    "navigationbarframe",
    "navbarbackground",
];

const IGNORED_CLASS_NAMES: &[&str] = &["navigationbarbackground", "statusbarbackground"];

pub fn parse_bounds(raw_bounds: &str) -> Option<RemoteUiLayoutBounds> {
    let caps = BOUNDS_REGEX.captures(raw_bounds.trim())?;
    let left: i32 = caps.get(1)?.as_str().parse().ok()?;
    let top: i32 = caps.get(2)?.as_str().parse().ok()?;
    let right: i32 = caps.get(3)?.as_str().parse().ok()?;
    let bottom: i32 = caps.get(4)?.as_str().parse().ok()?;
    Some(RemoteUiLayoutBounds::new(left, top, right, bottom))
}

fn parse_bool(raw: Option<&String>, default_val: bool) -> bool {
    match raw {
        Some(s) => {
            let trimmed = s.trim().to_lowercase();
            if trimmed.is_empty() {
                default_val
            } else {
                trimmed == "true"
            }
        }
        None => default_val,
    }
}

fn normalize_label(raw: &str) -> String {
    WHITESPACE_REGEX.replace_all(raw, " ").trim().to_string()
}

fn sanitize_primary_label(raw_label: &str, kind: RemoteUiLayoutNodeKind) -> String {
    let label = raw_label.trim();
    if label.is_empty() {
        return String::new();
    }

    if is_private_use_glyph_label(label) {
        return String::new();
    }

    if kind == RemoteUiLayoutNodeKind::Button && is_keyboard_like_button_label(label) {
        return label.to_string();
    }

    let lowered = label.to_lowercase();
    if GENERIC_LABELS.contains(&lowered.as_str())
        || (SYMBOL_ONLY_LABELS.contains(&label)
            && kind != RemoteUiLayoutNodeKind::Text
            && kind != RemoteUiLayoutNodeKind::Input
            && kind != RemoteUiLayoutNodeKind::Button)
    {
        return String::new();
    }

    if (kind == RemoteUiLayoutNodeKind::Toggle
        || kind == RemoteUiLayoutNodeKind::Image
        || kind == RemoteUiLayoutNodeKind::Other)
        && (label.chars().count() <= 1 || is_suspicious_short_code_label(label))
    {
        return String::new();
    }

    label.to_string()
}

fn is_private_use_glyph_label(label: &str) -> bool {
    let visible: Vec<char> = label.chars().filter(|c| !c.is_whitespace()).collect();
    if visible.is_empty() {
        return false;
    }
    visible
        .iter()
        .all(|&c| ('\u{E000}'..='\u{F8FF}').contains(&c))
}

fn is_keyboard_like_button_label(label: &str) -> bool {
    let set = ["删除", "退格", "完成", "确定", "下一步", "ABC", "123"];
    if (label.chars().count() == 1
        && (label.chars().next().unwrap().is_ascii_digit() || [".", ",", "*", "#"].contains(&label)))
        || set.contains(&label)
    {
        return true;
    }
    false
}

fn is_suspicious_short_code_label(label: &str) -> bool {
    if label.chars().any(|c| ('\u{4E00}'..='\u{9FFF}').contains(&c)) {
        return false;
    }
    let tokens: Vec<&str> = label.split_whitespace().collect();
    if tokens.is_empty() {
        return false;
    }
    if tokens.len() >= 2 {
        tokens
            .iter()
            .all(|t| t.chars().count() <= 4 && t.chars().any(|c| c.is_alphabetic()))
    } else {
        tokens[0].chars().count() <= 3 && tokens[0].chars().any(|c| c.is_alphabetic())
    }
}

fn humanize_resource_name(resource_name: &str) -> String {
    let normalized = CAMEL_CASE_REGEX.replace_all(resource_name, "$1 $2");
    let normalized_with_sep = RESOURCE_SEPARATOR_REGEX.replace_all(&normalized, " ");
    let tokens: Vec<String> = normalized_with_sep
        .split_whitespace()
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty())
        .collect();

    let meaningful_tokens: Vec<String> = tokens
        .iter()
        .filter(|t| !COMMON_RESOURCE_GENERIC_TOKENS.contains(&t.to_lowercase().as_str()))
        .cloned()
        .collect();

    if !tokens.is_empty() && meaningful_tokens.is_empty() {
        return String::new();
    }

    let effective_tokens = if meaningful_tokens.is_empty() {
        tokens
    } else {
        meaningful_tokens
    };

    let mapped: Vec<String> = effective_tokens
        .iter()
        .map(|token| match token.to_lowercase().as_str() {
            "qq" => "QQ".to_string(),
            "wx" => "WX".to_string(),
            "wechat" => "WeChat".to_string(),
            "alipay" => "Alipay".to_string(),
            "tb" => "TB".to_string(),
            "onekey" => "OneKey".to_string(),
            "ctid" => "CTID".to_string(),
            _ => {
                let mut c = token.chars();
                match c.next() {
                    None => String::new(),
                    Some(f) => f.to_uppercase().collect::<String>() + c.as_str(),
                }
            }
        })
        .collect();

    mapped.join(" ")
}

fn is_arrow_like_resource_name(resource_name: &str) -> bool {
    let lowered = resource_name.to_lowercase();
    lowered.contains("arrow")
        || lowered.contains("dropdown")
        || lowered.contains("expand")
        || lowered.contains("chevron")
        || lowered.contains("caret")
        || lowered.contains("spinner")
        || lowered.contains("region_image")
        || lowered.contains("regionimage")
}

fn is_obfuscated_resource_name(resource_name: &str) -> bool {
    let lowered = resource_name.to_lowercase();
    lowered == "obfuscated"
        || lowered.contains("resource_name_obfuscated")
        || lowered.contains("resource-name-obfuscated")
}

fn build_label(
    kind: RemoteUiLayoutNodeKind,
    text: &str,
    content_description: &str,
    resource_id: &str,
    password: bool,
    descendant_summary: &DescendantSummary,
) -> ParsedLabel {
    let sanitized_text = sanitize_primary_label(text, kind);
    if !sanitized_text.is_empty() {
        let prefix: String = sanitized_text.chars().take(48).collect();
        return ParsedLabel {
            text: prefix,
            source: RemoteUiLayoutLabelSource::Text,
        };
    }

    let sanitized_desc = sanitize_primary_label(content_description, kind);
    if !sanitized_desc.is_empty() {
        let prefix: String = sanitized_desc.chars().take(48).collect();
        return ParsedLabel {
            text: prefix,
            source: RemoteUiLayoutLabelSource::ContentDescription,
        };
    }

    if (kind == RemoteUiLayoutNodeKind::Input || kind == RemoteUiLayoutNodeKind::Button)
        && descendant_summary.primary_label().is_some()
    {
        let descendant_label = descendant_summary.primary_label().unwrap();
        let prefix: String = descendant_label.text.chars().take(48).collect();
        return ParsedLabel {
            text: prefix,
            source: descendant_label.source,
        };
    }

    let resource_name = resource_id
        .split('/')
        .last()
        .unwrap_or("")
        .split(':')
        .last()
        .unwrap_or("")
        .trim();

    if !resource_name.is_empty()
        && !is_obfuscated_resource_name(resource_name)
        && (kind == RemoteUiLayoutNodeKind::Input
            || kind == RemoteUiLayoutNodeKind::Text
            || kind == RemoteUiLayoutNodeKind::Button
            || kind == RemoteUiLayoutNodeKind::Image)
    {
        if is_arrow_like_resource_name(resource_name)
            && (kind == RemoteUiLayoutNodeKind::Image
                || kind == RemoteUiLayoutNodeKind::Other
                || kind == RemoteUiLayoutNodeKind::Button)
        {
            return ParsedLabel {
                text: String::new(),
                source: RemoteUiLayoutLabelSource::Fallback,
            };
        }
        let humanized = humanize_resource_name(resource_name);
        let lowered = humanized.trim().to_lowercase();
        if !lowered.is_empty()
            && !GENERIC_LABELS.contains(&lowered.as_str())
            && !is_suspicious_short_code_label(&humanized)
        {
            let prefix: String = humanized.chars().take(48).collect();
            return ParsedLabel {
                text: prefix,
                source: RemoteUiLayoutLabelSource::ResourceId,
            };
        }
    }

    if password {
        return ParsedLabel {
            text: "Password".to_string(),
            source: RemoteUiLayoutLabelSource::Fallback,
        };
    }

    ParsedLabel {
        text: String::new(),
        source: RemoteUiLayoutLabelSource::Fallback,
    }
}

fn classify_node(
    class_name: &str,
    resource_id: &str,
    content_description: &str,
    bounds: &RemoteUiLayoutBounds,
    clickable: bool,
    focusable: bool,
    checkable: bool,
    in_agreement_group: bool,
    descendant_summary: &DescendantSummary,
) -> RemoteUiLayoutNodeKind {
    let short_name = class_name.split('.').last().unwrap_or("");

    if short_name.contains("EditText")
        || short_name.contains("TextInput")
        || short_name.contains("AutoComplete")
    {
        return RemoteUiLayoutNodeKind::Input;
    }

    if checkable
        || short_name.contains("CompoundButton")
        || short_name.contains("CheckBox")
        || short_name.contains("Switch")
        || short_name.contains("Toggle")
        || short_name.contains("RadioButton")
    {
        return RemoteUiLayoutNodeKind::Toggle;
    }

    if looks_like_semantic_toggle(
        class_name,
        resource_id,
        content_description,
        bounds,
        clickable,
        focusable,
        in_agreement_group,
    ) {
        return RemoteUiLayoutNodeKind::Toggle;
    }

    if short_name.contains("Button") || short_name.contains("Chip") {
        return RemoteUiLayoutNodeKind::Button;
    }

    if short_name.contains("Image") {
        return RemoteUiLayoutNodeKind::Image;
    }

    if short_name.contains("TextView") || short_name.contains("Text") {
        return RemoteUiLayoutNodeKind::Text;
    }

    if looks_like_custom_toggle_view(class_name, resource_id, bounds, clickable, focusable) {
        return RemoteUiLayoutNodeKind::Toggle;
    }

    if looks_like_custom_button(resource_id, bounds, clickable, descendant_summary) {
        return RemoteUiLayoutNodeKind::Button;
    }

    if short_name.contains("Layout")
        || short_name.contains("ViewGroup")
        || short_name.contains("RecyclerView")
        || short_name.contains("ListView")
        || short_name.contains("ScrollView")
        || short_name.contains("WebView")
    {
        return RemoteUiLayoutNodeKind::Container;
    }

    RemoteUiLayoutNodeKind::Other
}

fn looks_like_semantic_toggle(
    class_name: &str,
    resource_id: &str,
    content_description: &str,
    bounds: &RemoteUiLayoutBounds,
    clickable: bool,
    focusable: bool,
    in_agreement_group: bool,
) -> bool {
    let width = bounds.width;
    let height = bounds.height;
    if !(16..=200).contains(&width) || !(16..=200).contains(&height) {
        return false;
    }

    let larger = width.max(height) as f32;
    let smaller = width.min(height).max(1) as f32;
    if larger / smaller > 3.2 {
        return false;
    }

    let lowered_res = resource_id.to_lowercase();
    let lowered_desc = content_description.to_lowercase();
    let has_toggle_res = lowered_res.contains(":id/scb_")
        || lowered_res.contains("/scb_")
        || lowered_res.contains("checkbox")
        || lowered_res.contains("check_box")
        || lowered_res.contains("protocol_checkbox")
        || lowered_res.contains("confirm_container")
        || lowered_res.contains("agree")
        || lowered_res.contains("consent")
        || lowered_res.contains("toggle")
        || lowered_res.contains("radio");

    let has_toggle_desc = lowered_desc.contains("勾选")
        || lowered_desc.contains("复选")
        || lowered_desc.contains("已选中")
        || lowered_desc.contains("未选中")
        || lowered_desc.contains("同意协议")
        || lowered_desc.contains("checkbox")
        || lowered_desc.contains("checked")
        || lowered_desc.contains("unchecked")
        || lowered_desc.contains("selected")
        || lowered_desc.contains("unselected");

    if has_toggle_res || has_toggle_desc {
        return clickable || focusable || !content_description.is_empty();
    }

    let short_name = class_name.split('.').last().unwrap_or("");
    let can_be_agreement_indicator = short_name.contains("Image")
        || short_name.contains("Button")
        || short_name.eq_ignore_ascii_case("View");

    in_agreement_group && can_be_agreement_indicator && (clickable || focusable) && width <= 96 && height <= 96
}

fn looks_like_custom_button(
    resource_id: &str,
    bounds: &RemoteUiLayoutBounds,
    clickable: bool,
    descendant_summary: &DescendantSummary,
) -> bool {
    if !clickable || descendant_summary.primary_label().is_none() {
        return false;
    }
    if bounds.width < 180 || !(60..=240).contains(&bounds.height) {
        return false;
    }

    let lowered = resource_id.to_lowercase();
    lowered.contains("button")
        || lowered.contains("_btn")
        || lowered.contains("btn_")
        || lowered.contains("login")
        || lowered.contains("submit")
        || lowered.contains("continue")
        || lowered.contains("next")
        || lowered.contains("verify")
        || lowered.contains("confirm")
}

fn looks_like_custom_toggle_view(
    class_name: &str,
    resource_id: &str,
    bounds: &RemoteUiLayoutBounds,
    clickable: bool,
    focusable: bool,
) -> bool {
    if !clickable && !focusable {
        return false;
    }

    let short_name = class_name.split('.').last().unwrap_or("");
    if !short_name.eq_ignore_ascii_case("View") {
        return false;
    }

    let lowered = resource_id.to_lowercase();
    let matches = lowered.contains(":id/scb_")
        || lowered.contains("/scb_")
        || lowered.contains("check")
        || lowered.contains("toggle")
        || lowered.contains("switch")
        || lowered.contains("radio");
    if !matches {
        return false;
    }

    let width = bounds.width;
    let height = bounds.height;
    if !(16..=96).contains(&width) || !(16..=96).contains(&height) {
        return false;
    }

    let larger = width.max(height) as f32;
    let smaller = width.min(height).max(1) as f32;
    larger / smaller <= 1.8
}

fn should_render(node: &RemoteUiLayoutNode) -> bool {
    if !node.visible_to_user || !node.bounds.has_area() {
        return false;
    }

    if should_ignore_system_node(node) {
        return false;
    }

    let has_semantic_content = !node.label.is_empty() || !node.text.is_empty() || !node.content_description.is_empty();
    let is_interesting_leaf = node.is_leaf
        && (node.kind == RemoteUiLayoutNodeKind::Text
            || node.kind == RemoteUiLayoutNodeKind::Button
            || node.kind == RemoteUiLayoutNodeKind::Toggle);
    let is_useful_image_leaf = node.is_leaf
        && node.kind == RemoteUiLayoutNodeKind::Image
        && (16..=160).contains(&node.bounds.width)
        && (16..=160).contains(&node.bounds.height);
    let is_interactive_leaf = node.is_leaf && (node.clickable || node.focusable || node.checkable || node.scrollable);
    let is_semantic_container = node.kind == RemoteUiLayoutNodeKind::Container
        && node.has_input_descendant
        && (node.has_text_descendant || node.has_button_descendant);
    let is_labeled_interactive_container = node.kind == RemoteUiLayoutNodeKind::Container
        && !node.label.is_empty()
        && (node.clickable || node.focusable);
    let is_custom_check_container = node.kind == RemoteUiLayoutNodeKind::Container
        && node.clickable
        && looks_like_checkable_container(node);

    node.kind == RemoteUiLayoutNodeKind::Input
        || node.kind == RemoteUiLayoutNodeKind::Toggle
        || is_semantic_container
        || is_labeled_interactive_container
        || is_custom_check_container
        || (has_semantic_content && node.kind != RemoteUiLayoutNodeKind::Container)
        || is_interesting_leaf
        || is_useful_image_leaf
        || is_interactive_leaf
}

fn should_ignore_system_node(node: &RemoteUiLayoutNode) -> bool {
    let resource_name = node
        .resource_id
        .split('/')
        .last()
        .unwrap_or("")
        .split(':')
        .last()
        .unwrap_or("")
        .trim()
        .to_lowercase();

    if IGNORED_RESOURCE_NAMES.contains(&resource_name.as_str()) {
        return true;
    }

    if should_ignore_decorative_indicator_node(node, &resource_name) {
        return true;
    }

    let short_class_name = node
        .class_name
        .split('.')
        .last()
        .unwrap_or(&node.class_name)
        .to_lowercase();
    IGNORED_CLASS_NAMES.contains(&short_class_name.as_str())
}

fn should_ignore_decorative_indicator_node(node: &RemoteUiLayoutNode, resource_name: &str) -> bool {
    if node.kind != RemoteUiLayoutNodeKind::Image {
        return false;
    }
    if !node.text.is_empty() || !node.content_description.is_empty() {
        return false;
    }
    if !node.is_leaf {
        return false;
    }

    let looks_like_check_indicator = resource_name.contains("confirm")
        || resource_name.contains("check")
        || resource_name.contains("tick");
    let is_small = node.bounds.width <= 80 && node.bounds.height <= 80;
    looks_like_check_indicator && is_small
}

fn looks_like_checkable_container(node: &RemoteUiLayoutNode) -> bool {
    let lowered = node.resource_id.to_lowercase();
    lowered.contains("check")
        || lowered.contains("checkbox")
        || lowered.contains("confirm")
        || lowered.contains("agree")
        || lowered.contains("accept")
        || lowered.contains("consent")
        || lowered.contains("policy")
        || node.has_check_indicator_descendant
}

fn has_direct_agreement_label(element: &ParsedXmlNode) -> bool {
    element.children.iter().filter(|c| c.name == "node").any(|c| {
        let text = c.attributes.get("text").map(|s| s.as_str()).unwrap_or("");
        let desc = c.attributes.get("content-desc").map(|s| s.as_str()).unwrap_or("");
        is_agreement_label(text) || is_agreement_label(desc)
    })
}

fn is_agreement_label(value: &str) -> bool {
    let normalized = normalize_label(value).to_lowercase();
    normalized.contains("阅读并同意")
        || normalized.contains("已阅读并同意")
        || normalized.contains("服务协议")
        || normalized.contains("用户协议")
        || normalized.contains("隐私政策")
        || normalized.contains("个人信息保护")
        || normalized.contains("privacy policy")
        || normalized.contains("terms of service")
}

fn summarize_descendants(element: &ParsedXmlNode) -> DescendantSummary {
    let mut summary = DescendantSummary::default();

    for child in element.children.iter().filter(|c| c.name == "node") {
        let child_class = child.attributes.get("class").map(|s| s.trim()).unwrap_or("");
        let child_kind = classify_descendant_kind(child_class);
        match child_kind {
            RemoteUiLayoutNodeKind::Input => summary.has_input = true,
            RemoteUiLayoutNodeKind::Text => summary.has_text = true,
            RemoteUiLayoutNodeKind::Button => summary.has_button = true,
            _ => {}
        }

        let child_text = normalize_label(child.attributes.get("text").map(|s| s.as_str()).unwrap_or(""));
        let child_desc = normalize_label(child.attributes.get("content-desc").map(|s| s.as_str()).unwrap_or(""));
        let sanitized_text = sanitize_primary_label(&child_text, child_kind);
        let sanitized_desc = sanitize_primary_label(&child_desc, child_kind);

        if summary.first_text_label.is_none() && !sanitized_text.is_empty() {
            summary.first_text_label = Some(ParsedLabel {
                text: sanitized_text,
                source: RemoteUiLayoutLabelSource::Text,
            });
        }
        if summary.first_content_description_label.is_none() && !sanitized_desc.is_empty() {
            summary.first_content_description_label = Some(ParsedLabel {
                text: sanitized_desc,
                source: RemoteUiLayoutLabelSource::ContentDescription,
            });
        }

        let child_res = child.attributes.get("resource-id").map(|s| s.to_lowercase()).unwrap_or_default();
        let lowered_desc = child_desc.to_lowercase();
        let short_name = child_class.split('.').last().unwrap_or("");
        if child_res.contains("check")
            || child_res.contains("checkbox")
            || child_res.contains("confirm")
            || child_res.contains("tick")
            || short_name.contains("CheckBox")
            || short_name.contains("Toggle")
            || lowered_desc.contains("勾选")
            || lowered_desc.contains("已选中")
            || lowered_desc.contains("未选中")
        {
            summary.has_check_indicator = true;
        }

        let sub_summary = summarize_descendants(child);
        summary.has_input = summary.has_input || sub_summary.has_input;
        summary.has_text = summary.has_text || sub_summary.has_text;
        summary.has_button = summary.has_button || sub_summary.has_button;
        summary.has_check_indicator = summary.has_check_indicator || sub_summary.has_check_indicator;

        if summary.first_text_label.is_none() {
            summary.first_text_label = sub_summary.first_text_label;
        }
        if summary.first_content_description_label.is_none() {
            summary.first_content_description_label = sub_summary.first_content_description_label;
        }
    }

    summary
}

fn classify_descendant_kind(class_name: &str) -> RemoteUiLayoutNodeKind {
    let short_name = class_name.split('.').last().unwrap_or("");
    if short_name.contains("EditText")
        || short_name.contains("TextInput")
        || short_name.contains("AutoComplete")
    {
        return RemoteUiLayoutNodeKind::Input;
    }

    if short_name.contains("CompoundButton")
        || short_name.contains("CheckBox")
        || short_name.contains("Switch")
        || short_name.contains("Toggle")
        || short_name.contains("RadioButton")
    {
        return RemoteUiLayoutNodeKind::Toggle;
    }

    if short_name.contains("Button") || short_name.contains("Chip") {
        return RemoteUiLayoutNodeKind::Button;
    }

    if short_name.contains("Image") {
        return RemoteUiLayoutNodeKind::Image;
    }

    if short_name.contains("Text") {
        return RemoteUiLayoutNodeKind::Text;
    }

    RemoteUiLayoutNodeKind::Other
}

fn derive_component_key(element: &ParsedXmlNode, inherited: Option<&str>) -> Option<String> {
    let clickable = parse_bool(element.attributes.get("clickable"), false);
    let focusable = parse_bool(element.attributes.get("focusable"), false);
    if !clickable && !focusable {
        return inherited.map(|s| s.to_string());
    }

    let package_name = element.attributes.get("package").map(|s| s.trim()).unwrap_or("");
    let resource_id = element.attributes.get("resource-id").map(|s| s.trim()).unwrap_or("");
    let class_name = element.attributes.get("class").map(|s| s.trim()).unwrap_or("");
    let bounds = element.attributes.get("bounds").map(|s| s.trim()).unwrap_or("");

    let identity = if !resource_id.is_empty() {
        resource_id
    } else if !class_name.is_empty() {
        class_name
    } else {
        "node"
    };

    Some(format!("{}|{}|{}", package_name, identity, bounds))
}

fn derive_xpath(element: &ParsedXmlNode, parent_xpath: &str, sibling_index: usize) -> String {
    let class_name = element.attributes.get("class").map(|s| s.trim()).unwrap_or("node");
    let resource_id = element.attributes.get("resource-id").map(|s| s.trim()).unwrap_or("");
    let text = element.attributes.get("text").map(|s| s.trim()).unwrap_or("");

    if !resource_id.is_empty() {
        format!("//{}/*[@resource-id='{}']", class_name, resource_id)
    } else if !text.is_empty() {
        format!("//{}/*[@text='{}']", class_name, text)
    } else if parent_xpath.is_empty() {
        format!("/hierarchy/{}[{}]", class_name, sibling_index + 1)
    } else {
        format!("{}/{}[{}]", parent_xpath, class_name, sibling_index + 1)
    }
}

fn traverse_tree(
    element: &ParsedXmlNode,
    out: &mut Vec<RemoteUiLayoutNode>,
    inherited_component_key: Option<&str>,
    in_agreement_group: bool,
    parent_xpath: &str,
    sibling_index: usize,
) {
    let child_nodes: Vec<&ParsedXmlNode> = element.children.iter().filter(|c| c.name == "node").collect();

    if element.name != "node" {
        for (i, child) in child_nodes.iter().enumerate() {
            traverse_tree(child, out, inherited_component_key, false, "", i);
        }
        return;
    }

    let current_component_key = derive_component_key(element, inherited_component_key);
    let descendant_summary = summarize_descendants(element);
    let xpath = derive_xpath(element, parent_xpath, sibling_index);

    if let Some(node) = parse_xml_node(
        element,
        child_nodes.is_empty(),
        current_component_key.as_deref(),
        &descendant_summary,
        in_agreement_group,
        &xpath,
    ) {
        if should_render(&node) {
            out.push(node);
        }
    }

    let children_in_agreement = has_direct_agreement_label(element);
    for (i, child) in child_nodes.iter().enumerate() {
        traverse_tree(
            child,
            out,
            current_component_key.as_deref(),
            children_in_agreement,
            &xpath,
            i,
        );
    }
}

fn parse_xml_node(
    element: &ParsedXmlNode,
    is_leaf: bool,
    component_key: Option<&str>,
    descendant_summary: &DescendantSummary,
    in_agreement_group: bool,
    xpath: &str,
) -> Option<RemoteUiLayoutNode> {
    let raw_bounds = element.attributes.get("bounds").map(|s| s.as_str()).unwrap_or("");
    let bounds = parse_bounds(raw_bounds)?;

    let class_name = element.attributes.get("class").map(|s| s.trim()).unwrap_or("").to_string();
    let package_name = element.attributes.get("package").map(|s| s.trim()).unwrap_or("").to_string();
    let resource_id = element.attributes.get("resource-id").map(|s| s.trim()).unwrap_or("").to_string();
    let text = normalize_label(element.attributes.get("text").map(|s| s.as_str()).unwrap_or(""));
    let content_description = normalize_label(element.attributes.get("content-desc").map(|s| s.as_str()).unwrap_or(""));
    let password = parse_bool(element.attributes.get("password"), false);
    let clickable = parse_bool(element.attributes.get("clickable"), false);
    let focusable = parse_bool(element.attributes.get("focusable"), false);
    let checkable = parse_bool(element.attributes.get("checkable"), false);
    let enabled = parse_bool(element.attributes.get("enabled"), true);
    let selected = parse_bool(element.attributes.get("selected"), false);
    let focused = parse_bool(element.attributes.get("focused"), false);
    let checked = parse_bool(element.attributes.get("checked"), false);
    let scrollable = parse_bool(element.attributes.get("scrollable"), false);
    let visible_to_user = parse_bool(element.attributes.get("visible-to-user"), true);

    let kind = classify_node(
        &class_name,
        &resource_id,
        &content_description,
        &bounds,
        clickable,
        focusable,
        checkable,
        in_agreement_group,
        descendant_summary,
    );

    let parsed_label = build_label(
        kind,
        &text,
        &content_description,
        &resource_id,
        password,
        descendant_summary,
    );

    Some(RemoteUiLayoutNode {
        bounds,
        label: parsed_label.text,
        label_source: parsed_label.source,
        component_key: component_key.map(|s| s.to_string()),
        kind,
        package_name,
        class_name,
        resource_id,
        text,
        content_description,
        is_leaf,
        clickable,
        enabled,
        focusable,
        focused,
        checkable,
        checked,
        selected,
        scrollable,
        password,
        visible_to_user,
        has_input_descendant: descendant_summary.has_input,
        has_text_descendant: descendant_summary.has_text,
        has_button_descendant: descendant_summary.has_button,
        has_check_indicator_descendant: descendant_summary.has_check_indicator,
        xpath: xpath.to_string(),
    })
}

fn node_priority(node: &RemoteUiLayoutNode) -> i32 {
    let source_score = match node.label_source {
        RemoteUiLayoutLabelSource::Text => 40,
        RemoteUiLayoutLabelSource::ContentDescription => 30,
        RemoteUiLayoutLabelSource::ResourceId => 20,
        RemoteUiLayoutLabelSource::Fallback => 10,
    };
    let kind_score = match node.kind {
        RemoteUiLayoutNodeKind::Input => 12,
        RemoteUiLayoutNodeKind::Toggle => 11,
        RemoteUiLayoutNodeKind::Button => 10,
        RemoteUiLayoutNodeKind::Text => 7,
        RemoteUiLayoutNodeKind::Image => 3,
        RemoteUiLayoutNodeKind::Other => 2,
        RemoteUiLayoutNodeKind::Container => 1,
    };
    source_score + kind_score
}

fn overlap_over_smaller_area(a: &RemoteUiLayoutBounds, b: &RemoteUiLayoutBounds) -> f32 {
    let left = a.left.max(b.left);
    let top = a.top.max(b.top);
    let right = a.right.min(b.right);
    let bottom = a.bottom.min(b.bottom);
    if right <= left || bottom <= top {
        return 0.0;
    }
    let intersection = (right - left) as i64 * (bottom - top) as i64;
    let smaller = a.area().min(b.area()).max(1);
    intersection as f32 / smaller as f32
}

fn is_redundant(candidate: &RemoteUiLayoutNode, existing: &RemoteUiLayoutNode) -> bool {
    let ratio = overlap_over_smaller_area(&candidate.bounds, &existing.bounds);
    if ratio < 0.88 {
        return false;
    }

    let cand_norm = candidate.label.replace(' ', "").to_lowercase();
    let exist_norm = existing.label.replace(' ', "").to_lowercase();
    if !cand_norm.is_empty() && cand_norm == exist_norm {
        return true;
    }

    if existing.kind == RemoteUiLayoutNodeKind::Container
        && candidate.kind == RemoteUiLayoutNodeKind::Container
        && existing.label.is_empty()
        && candidate.label.is_empty()
        && candidate.bounds.area() <= existing.bounds.area()
    {
        return true;
    }

    if existing.label_source == RemoteUiLayoutLabelSource::Text
        && candidate.label_source != RemoteUiLayoutLabelSource::Text
        && candidate.kind != RemoteUiLayoutNodeKind::Toggle
    {
        return true;
    }

    if (existing.kind == RemoteUiLayoutNodeKind::Text || existing.kind == RemoteUiLayoutNodeKind::Input)
        && (candidate.kind == RemoteUiLayoutNodeKind::Button
            || candidate.kind == RemoteUiLayoutNodeKind::Image
            || candidate.kind == RemoteUiLayoutNodeKind::Other)
    {
        return true;
    }

    false
}

fn post_process_nodes(nodes: Vec<RemoteUiLayoutNode>) -> Vec<RemoteUiLayoutNode> {
    let mut sorted = nodes;
    sorted.sort_by(|a, b| {
        let pa = node_priority(a);
        let pb = node_priority(b);
        if pa != pb {
            return pb.cmp(&pa);
        }
        b.bounds.area().cmp(&a.bounds.area())
    });

    let mut kept: Vec<RemoteUiLayoutNode> = Vec::new();
    for candidate in sorted {
        if !kept.iter().any(|existing| is_redundant(&candidate, existing)) {
            kept.push(candidate);
        }
    }

    kept.sort_by(|a, b| b.bounds.area().cmp(&a.bounds.area()));
    kept
}

fn infer_viewport_bounds(nodes: &[RemoteUiLayoutNode]) -> RemoteUiLayoutBounds {
    if nodes.is_empty() {
        return RemoteUiLayoutBounds::new(0, 0, 1080, 2400);
    }
    let left = nodes.iter().map(|n| n.bounds.left).min().unwrap_or(0);
    let top = nodes.iter().map(|n| n.bounds.top).min().unwrap_or(0);
    let right = nodes.iter().map(|n| n.bounds.right).max().unwrap_or(1080);
    let bottom = nodes.iter().map(|n| n.bounds.bottom).max().unwrap_or(2400);
    RemoteUiLayoutBounds::new(left, top, right, bottom)
}

fn build_parsed_xml_tree(xml: &str) -> Result<ParsedXmlNode, String> {
    let mut reader = Reader::from_str(xml);
    reader.config_mut().trim_text(true);

    let mut root: Option<ParsedXmlNode> = None;
    let mut stack: Vec<ParsedXmlNode> = Vec::new();

    let mut buf = Vec::new();
    loop {
        match reader.read_event_into(&mut buf) {
            Ok(Event::Start(ref e)) => {
                let name = e.name().as_ref().to_string();
                let mut attributes = HashMap::new();
                for attr in e.attributes().flatten() {
                    let key = attr.key.as_ref().to_string();
                    #[allow(deprecated)]
                    let val = attr
                        .unescape_value()
                        .map(|v| v.to_string())
                        .unwrap_or_default();
                    attributes.insert(key, val);
                }
                let node = ParsedXmlNode {
                    name,
                    attributes,
                    children: Vec::new(),
                };
                stack.push(node);
            }
            Ok(Event::Empty(ref e)) => {
                let name = e.name().as_ref().to_string();
                let mut attributes = HashMap::new();
                for attr in e.attributes().flatten() {
                    let key = attr.key.as_ref().to_string();
                    #[allow(deprecated)]
                    let val = attr
                        .unescape_value()
                        .map(|v| v.to_string())
                        .unwrap_or_default();
                    attributes.insert(key, val);
                }
                let node = ParsedXmlNode {
                    name,
                    attributes,
                    children: Vec::new(),
                };
                if let Some(parent) = stack.last_mut() {
                    parent.children.push(node);
                } else if root.is_none() {
                    root = Some(node);
                }
            }
            Ok(Event::End(_)) => {
                if let Some(node) = stack.pop() {
                    if let Some(parent) = stack.last_mut() {
                        parent.children.push(node);
                    } else if root.is_none() {
                        root = Some(node);
                    }
                }
            }
            Ok(Event::Eof) => break,
            Err(e) => return Err(format!("XML parsing error: {}", e)),
            _ => {}
        }
        buf.clear();
    }

    root.ok_or_else(|| "Empty XML root".to_string())
}

pub fn parse_snapshot_from_xml(xml: &str) -> Result<RemoteUiLayoutSnapshot, String> {
    let trimmed = xml.trim();
    if trimmed.is_empty() {
        return Ok(RemoteUiLayoutSnapshot {
            viewport_bounds: RemoteUiLayoutBounds::new(0, 0, 1080, 2400),
            nodes: Vec::new(),
        });
    }

    // Locate valid XML start if there is ADB logging preamble
    let xml_start = trimmed.find("<?xml").or_else(|| trimmed.find("<hierarchy")).unwrap_or(0);
    let xml_content = &trimmed[xml_start..];

    let root_node = build_parsed_xml_tree(xml_content)?;

    let mut nodes = Vec::new();
    traverse_tree(&root_node, &mut nodes, None, false, "", 0);

    let viewport = root_node
        .children
        .iter()
        .find(|c| c.name == "node")
        .and_then(|c| c.attributes.get("bounds"))
        .and_then(|b| parse_bounds(b))
        .unwrap_or_else(|| infer_viewport_bounds(&nodes));

    let processed_nodes = post_process_nodes(nodes);

    Ok(RemoteUiLayoutSnapshot {
        viewport_bounds: viewport,
        nodes: processed_nodes,
    })
}

/// Execute ADB commands to dump the UIAutomator hierarchy and parse it into a layout snapshot.
pub async fn dump_remote_ui_layout(
    serial: String,
    custom_path: Option<String>,
) -> Result<RemoteUiLayoutSnapshot, String> {
    let custom = custom_path.as_deref();

    // 1. Try `exec-out uiautomator dump /dev/tty` first for fast memory stream
    let fast_res = adb::execute_adb_async(
        custom,
        &["-s", &serial, "exec-out", "uiautomator", "dump", "/dev/tty"],
    )
    .await;

    if let Ok(ref stdout) = fast_res {
        if stdout.contains("<hierarchy") {
            if let Ok(snapshot) = parse_snapshot_from_xml(stdout) {
                if !snapshot.nodes.is_empty() {
                    return Ok(snapshot);
                }
            }
        }
    }

    // 2. Fallback: dump to device /data/local/tmp/window_dump.xml and cat
    let tmp_file = "/data/local/tmp/window_dump.xml";
    let dump_cmd = format!("uiautomator dump {} >/dev/null 2>&1 && cat {}", tmp_file, tmp_file);
    let res = adb::execute_adb_async(custom, &["-s", &serial, "shell", &dump_cmd]).await?;

    if !res.contains("<hierarchy") && !res.contains("<?xml") {
        return Err(format!("UIAutomator dump produced invalid output: {}", res.chars().take(200).collect::<String>()));
    }

    // Asynchronously cleanup temporary dump file
    let cleanup_serial = serial.clone();
    let cleanup_custom = custom_path.clone();
    tokio::spawn(async move {
        let _ = adb::execute_adb_async(
            cleanup_custom.as_deref(),
            &["-s", &cleanup_serial, "shell", "rm", "-f", tmp_file],
        )
        .await;
    });

    parse_snapshot_from_xml(&res)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_sample_xml() {
        let sample_xml = r#"<?xml version='1.0' encoding='UTF-8' standalone='yes' ?>
<hierarchy rotation="0">
  <node index="0" text="" resource-id="" class="android.widget.FrameLayout" package="com.example.app" content-desc="" checkable="false" checked="false" clickable="false" enabled="true" focusable="false" focused="false" scrollable="false" long-clickable="false" password="false" selected="false" bounds="[0,0][1080,2400]">
    <node index="0" text="Sign In" resource-id="com.example.app:id/btn_login" class="android.widget.Button" package="com.example.app" content-desc="" checkable="false" checked="false" clickable="true" enabled="true" focusable="true" focused="false" scrollable="false" long-clickable="false" password="false" selected="false" bounds="[100,500][980,640]" />
    <node index="1" text="" resource-id="com.example.app:id/input_user" class="android.widget.EditText" package="com.example.app" content-desc="Enter Username" checkable="false" checked="false" clickable="true" enabled="true" focusable="true" focused="true" scrollable="false" long-clickable="true" password="false" selected="false" bounds="[100,300][980,440]" />
    <node index="2" text="Remember Me" resource-id="com.example.app:id/cb_remember" class="android.widget.CheckBox" package="com.example.app" content-desc="" checkable="true" checked="true" clickable="true" enabled="true" focusable="true" focused="false" scrollable="false" long-clickable="false" password="false" selected="false" bounds="[100,700][500,780]" />
  </node>
</hierarchy>"#;

        let snapshot = parse_snapshot_from_xml(sample_xml).expect("Parsing should succeed");
        assert_eq!(snapshot.viewport_bounds.width, 1080);
        assert_eq!(snapshot.viewport_bounds.height, 2400);
        assert_eq!(snapshot.nodes.len(), 3);

        let login_btn = snapshot.nodes.iter().find(|n| n.resource_id.contains("btn_login")).unwrap();
        assert_eq!(login_btn.kind, RemoteUiLayoutNodeKind::Button);
        assert_eq!(login_btn.label, "Sign In");

        let input = snapshot.nodes.iter().find(|n| n.resource_id.contains("input_user")).unwrap();
        assert_eq!(input.kind, RemoteUiLayoutNodeKind::Input);
        assert_eq!(input.label, "Enter Username");

        let checkbox = snapshot.nodes.iter().find(|n| n.resource_id.contains("cb_remember")).unwrap();
        assert_eq!(checkbox.kind, RemoteUiLayoutNodeKind::Toggle);
        assert_eq!(checkbox.checked, true);
    }
}

