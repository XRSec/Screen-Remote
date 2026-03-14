#!/usr/bin/env swift

import Foundation

struct VisiblePath {
    let pathData: String
    let fillColor: String
}

struct SourceBox {
    let x: Double
    let y: Double
    let width: Double
    let height: Double
}

enum ScriptError: Error, CustomStringConvertible {
    case invalidSVG(String)
    case noVisiblePaths(String)

    var description: String {
        switch self {
        case .invalidSVG(let message),
             .noVisiblePaths(let message):
            return message
        }
    }
}

private func scriptDirectory() -> URL {
    let current = URL(fileURLWithPath: FileManager.default.currentDirectoryPath, isDirectory: true)
    let invoked = URL(fileURLWithPath: CommandLine.arguments.first ?? FileManager.default.currentDirectoryPath, relativeTo: current)
    return invoked.standardizedFileURL.deletingLastPathComponent()
}

private func escaped(_ value: String) -> String {
    value
        .replacingOccurrences(of: "&", with: "&amp;")
        .replacingOccurrences(of: "\"", with: "&quot;")
        .replacingOccurrences(of: "<", with: "&lt;")
        .replacingOccurrences(of: ">", with: "&gt;")
}

private func styleMap(_ raw: String?) -> [String: String] {
    guard let raw, raw.isEmpty == false else {
        return [:]
    }
    var map: [String: String] = [:]
    for part in raw.split(separator: ";") {
        let pieces = part.split(separator: ":", maxSplits: 1).map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }
        if pieces.count == 2 {
            map[pieces[0]] = pieces[1]
        }
    }
    return map
}

private func hexByte(_ raw: String) -> UInt8? {
    UInt8(raw, radix: 16)
}

private func normalizeColor(_ raw: String, opacity: Double?) -> String? {
    let value = raw.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
    if value == "none" || value == "transparent" {
        return nil
    }

    let alphaFromOpacity: UInt8 = {
        guard let opacity else { return 0xFF }
        let clamped = min(max(opacity, 0.0), 1.0)
        return UInt8((clamped * 255.0).rounded())
    }()

    if value == "white" {
        return String(format: "#%02XFFFFFF", alphaFromOpacity)
    }
    if value == "black" {
        return String(format: "#%02X000000", alphaFromOpacity)
    }

    guard value.hasPrefix("#") else {
        return nil
    }

    let hex = String(value.dropFirst())
    switch hex.count {
    case 3:
        let chars = Array(hex)
        let r = String(repeating: String(chars[0]), count: 2)
        let g = String(repeating: String(chars[1]), count: 2)
        let b = String(repeating: String(chars[2]), count: 2)
        return String(format: "#%02X%@%@%@", alphaFromOpacity, r.uppercased(), g.uppercased(), b.uppercased())
    case 6:
        return String(format: "#%02X%@", alphaFromOpacity, hex.uppercased())
    case 8:
        let rr = String(hex.prefix(2))
        let gg = String(hex.dropFirst(2).prefix(2))
        let bb = String(hex.dropFirst(4).prefix(2))
        let aa = String(hex.dropFirst(6).prefix(2))
        guard let embeddedAlpha = hexByte(aa) else { return nil }
        let finalAlpha = UInt8((Double(embeddedAlpha) * Double(alphaFromOpacity) / 255.0).rounded())
        return String(format: "#%02X%@%@%@", finalAlpha, rr.uppercased(), gg.uppercased(), bb.uppercased())
    default:
        return nil
    }
}

private func firstMatch(_ pattern: String, in text: String) throws -> String? {
    let regex = try NSRegularExpression(pattern: pattern, options: [.dotMatchesLineSeparators])
    let nsText = text as NSString
    guard let match = regex.firstMatch(in: text, range: NSRange(location: 0, length: nsText.length)), match.numberOfRanges >= 2 else {
        return nil
    }
    return nsText.substring(with: match.range(at: 1))
}

private func allMatches(_ pattern: String, in text: String) throws -> [String] {
    let regex = try NSRegularExpression(pattern: pattern, options: [.dotMatchesLineSeparators])
    let nsText = text as NSString
    return regex.matches(in: text, range: NSRange(location: 0, length: nsText.length)).compactMap { match in
        guard match.numberOfRanges >= 2 else { return nil }
        return nsText.substring(with: match.range(at: 1))
    }
}

private func attributes(in tag: String) throws -> [String: String] {
    let regex = try NSRegularExpression(pattern: #"([A-Za-z_:][-A-Za-z0-9_:.]*)\s*=\s*"([^"]*)""#)
    let nsTag = tag as NSString
    let matches = regex.matches(in: tag, range: NSRange(location: 0, length: nsTag.length))
    var result: [String: String] = [:]
    for match in matches where match.numberOfRanges >= 3 {
        let key = nsTag.substring(with: match.range(at: 1))
        let value = nsTag.substring(with: match.range(at: 2))
        result[key] = value
    }
    return result
}

private func parseSVG(_ text: String) throws -> ([Double], SourceBox, [VisiblePath]) {
    guard let viewBoxRaw = try firstMatch(#"viewBox\s*=\s*"([^"]+)""#, in: text) else {
        throw ScriptError.invalidSVG("SVG is missing viewBox")
    }

    let viewBox = viewBoxRaw
        .split(whereSeparator: { $0 == " " || $0 == "," })
        .compactMap { Double($0) }
    guard viewBox.count == 4 else {
        throw ScriptError.invalidSVG("SVG has invalid viewBox: \(viewBoxRaw)")
    }

    let sourceBox = try parseSourceBox(text: text, viewBox: viewBox)

    let pathTags = try allMatches(#"(<path\b[^>]*>)"#, in: text)
    var visiblePaths: [VisiblePath] = []

    for pathTag in pathTags {
        let attrs = try attributes(in: pathTag)
        guard let d = attrs["d"], d.isEmpty == false else {
            continue
        }

        let styles = styleMap(attrs["style"])
        let opacity = (attrs["opacity"] ?? styles["opacity"]).flatMap(Double.init)
        if let opacity, opacity <= 0.0 {
            continue
        }

        let fill = attrs["fill"] ?? styles["fill"] ?? "black"
        guard let color = normalizeColor(fill, opacity: opacity) else {
            continue
        }

        visiblePaths.append(VisiblePath(pathData: d, fillColor: color))
    }

    if visiblePaths.isEmpty {
        throw ScriptError.noVisiblePaths("No visible <path> elements found")
    }

    return (viewBox, sourceBox, visiblePaths)
}

private func parseSourceBox(text: String, viewBox: [Double]) throws -> SourceBox {
    let rectTags = try allMatches(#"(<rect\b[^>]*>)"#, in: text)
    for rectTag in rectTags {
        let attrs = try attributes(in: rectTag)
        let styles = styleMap(attrs["style"])
        let opacity = (attrs["opacity"] ?? styles["opacity"]).flatMap(Double.init)
        let fill = (attrs["fill"] ?? styles["fill"] ?? "").trimmingCharacters(in: .whitespacesAndNewlines).lowercased()

        let isTransparent = (opacity != nil && opacity! <= 0.0) || fill == "none" || fill == "transparent"
        guard isTransparent else {
            continue
        }

        guard let width = (attrs["width"]).flatMap(Double.init),
              let height = (attrs["height"]).flatMap(Double.init),
              width > 0, height > 0 else {
            continue
        }

        let x = (attrs["x"]).flatMap(Double.init) ?? 0.0
        let y = (attrs["y"]).flatMap(Double.init) ?? 0.0
        return SourceBox(x: x, y: y, width: width, height: height)
    }

    return SourceBox(x: viewBox[0], y: viewBox[1], width: viewBox[2], height: viewBox[3])
}

private func vectorDrawableXML(sourceBox: SourceBox, sizeDp: Int, paths: [VisiblePath]) -> String {
    let viewportSize = Double(sizeDp)
    let scale = min(viewportSize / sourceBox.width, viewportSize / sourceBox.height)
    let translateX = ((viewportSize - (sourceBox.width * scale)) / 2.0) - (sourceBox.x * scale)
    let translateY = ((viewportSize - (sourceBox.height * scale)) / 2.0) - (sourceBox.y * scale)

    var lines: [String] = [
        "<?xml version=\"1.0\" encoding=\"utf-8\"?>",
        "<vector xmlns:android=\"http://schemas.android.com/apk/res/android\"",
        "    android:width=\"\(sizeDp)dp\"",
        "    android:height=\"\(sizeDp)dp\"",
        "    android:viewportWidth=\"\(viewportSize)\"",
        "    android:viewportHeight=\"\(viewportSize)\">"
    ]

    lines.append("    <group")
    lines.append("        android:scaleX=\"\(scale)\"")
    lines.append("        android:scaleY=\"\(scale)\"")
    lines.append("        android:translateX=\"\(translateX)\"")
    lines.append("        android:translateY=\"\(translateY)\">")

    let indent = "        "
    for path in paths {
        lines.append("\(indent)<path")
        lines.append("\(indent)    android:fillColor=\"\(path.fillColor)\"")
        lines.append("\(indent)    android:pathData=\"\(escaped(path.pathData))\" />")
    }

    lines.append("    </group>")
    lines.append("</vector>")
    return lines.joined(separator: "\n") + "\n"
}

private func convert(svgURL: URL, outputURL: URL, sizeDp: Int) throws {
    let text = try String(contentsOf: svgURL, encoding: .utf8)
    let (_, sourceBox, paths) = try parseSVG(text)
    let xml = vectorDrawableXML(sourceBox: sourceBox, sizeDp: sizeDp, paths: paths)
    try xml.write(to: outputURL, atomically: true, encoding: .utf8)
}

do {
    let directory = scriptDirectory()
    let sizeDp = 24
    let inputURL = directory.appendingPathComponent("in.svg")
    let outputURL = directory.appendingPathComponent("out.xml")

    guard FileManager.default.fileExists(atPath: inputURL.path) else {
        throw ScriptError.invalidSVG("Missing input file: \(inputURL.path)")
    }

    try convert(svgURL: inputURL, outputURL: outputURL, sizeDp: sizeDp)
    print("Converted \(inputURL.lastPathComponent) -> \(outputURL.lastPathComponent)")
} catch let error as ScriptError {
    FileHandle.standardError.write(Data((error.description + "\n").utf8))
    exit(1)
} catch {
    FileHandle.standardError.write(Data((String(describing: error) + "\n").utf8))
    exit(1)
}
