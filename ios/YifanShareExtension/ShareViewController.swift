import UIKit
import UniformTypeIdentifiers
import AVFoundation

class ShareViewController: UIViewController {
  private let appGroupID = "group.im.cxa.fanatter"
  private let appURLScheme = "yifan://compose"
  private let internalStatusCardFilePrefix = "share_status_card_"
  private var shouldReturnToHostWithoutOpeningApp = false

  private static let maxGifDimension: CGFloat = 480
  private static let maxGifFrames = 60
  private static let maxGifFPS: Float = 20.0
  private static let defaultGifFPS: Float = 20.0
  private static let maxStillImageDimension: CGFloat = 1920
  private static let stillImageCompressionQuality: CGFloat = 0.85
  private static let maxPhotoFileSize = 2 * 1024 * 1024

  override func viewDidLoad() {
    super.viewDidLoad()
    view.backgroundColor = .clear
    loadSharedContent()
  }

  private func writeDebugLog(_ text: String) {
    guard let container = FileManager.default.containerURL(
      forSecurityApplicationGroupIdentifier: appGroupID)
    else { return }

    let fileURL = container.appendingPathComponent("share-debug.txt")
    let existing = (try? String(contentsOf: fileURL, encoding: .utf8)) ?? ""
    let timestamp = ISO8601DateFormatter().string(from: Date())
    let next = "\(existing)[\(timestamp)] \(text)\n"
    let trimmed = String(next.suffix(12000))
    try? trimmed.write(to: fileURL, atomically: true, encoding: .utf8)
  }

  private static func dataPrefixHex(_ data: Data, limit: Int = 12) -> String {
    data.prefix(limit).map { String(format: "%02X", $0) }.joined(separator: " ")
  }

  private static func normalizedGifData(_ data: Data) -> Data {
    guard
      data.count >= 6,
      String(data: data.prefix(6), encoding: .ascii) == "GIF87a"
    else {
      return data
    }

    var normalized = data
    normalized.replaceSubrange(3..<6, with: Array("89a".utf8))
    return normalized
  }

  private func loadSharedContent() {
    guard
      let item = extensionContext?.inputItems.first as? NSExtensionItem,
      let attachments = item.attachments,
      !attachments.isEmpty
    else {
      writeDebugLog("No extension input items or attachments.")
      complete(success: false)
      return
    }

    writeDebugLog("Received \(attachments.count) attachment(s).")
    for (index, provider) in attachments.enumerated() {
      writeDebugLog("attachment[\(index)] types: \(provider.registeredTypeIdentifiers.joined(separator: ", "))")
    }

    if let livePhotoProvider = attachments.first(where: { Self.livePhotoBundleIdentifier(for: $0) != nil }) {
      writeDebugLog("Selected live photo provider.")
      loadSharedLivePhoto(provider: livePhotoProvider)
      return
    }

    if let movieProvider = attachments.first(where: { $0.hasItemConformingToTypeIdentifier(UTType.movie.identifier) }) {
      writeDebugLog("Selected movie provider.")
      loadSharedMovieAsGif(provider: movieProvider)
      return
    }

    // Try image
    let imageTypeIDs = [
      UTType.gif.identifier,
      UTType.jpeg.identifier,
      UTType.png.identifier,
      UTType.heic.identifier,
      UTType.image.identifier,
    ]

    if let provider = attachments.first(where: { p in
      imageTypeIDs.contains(where: { p.hasItemConformingToTypeIdentifier($0) })
    }) {
      writeDebugLog("Selected image provider.")
      loadSharedImage(provider: provider, imageTypeIDs: imageTypeIDs)
      return
    }

    // Try URL
    if let provider = attachments.first(where: { $0.hasItemConformingToTypeIdentifier(UTType.url.identifier) }) {
      writeDebugLog("Selected URL provider.")
      loadSharedURL(provider: provider)
      return
    }

    // Try plain text
    if let provider = attachments.first(where: { $0.hasItemConformingToTypeIdentifier(UTType.plainText.identifier) }) {
      writeDebugLog("Selected plain text provider.")
      loadSharedText(provider: provider)
      return
    }

    writeDebugLog("No supported attachment type found.")
    complete(success: false)
  }

  private func markInternalStatusCardShareIfNeeded(fileName: String?) {
    guard
      let fileName,
      fileName.hasPrefix(internalStatusCardFilePrefix)
    else { return }

    shouldReturnToHostWithoutOpeningApp = true
    writeDebugLog("Detected internal status-card share: \(fileName)")
  }

  private func finishAfterWritingSharedContent() {
    DispatchQueue.main.async {
      if self.shouldReturnToHostWithoutOpeningApp {
        self.writeDebugLog("Completed internal status-card share without opening main app.")
        self.complete(success: true)
        return
      }

      self.openMainAppAndComplete()
    }
  }

  // MARK: - Live Photo handling

  private static func livePhotoBundleIdentifier(for provider: NSItemProvider) -> String? {
    provider.registeredTypeIdentifiers.first {
      $0.contains("live-photo-bundle") || $0 == "com.apple.live-photo"
    }
  }

  private static func firstFile(in rootURL: URL, extensions: Set<String>) -> URL? {
    if extensions.contains(rootURL.pathExtension.lowercased()) {
      return rootURL
    }

    guard let enumerator = FileManager.default.enumerator(
      at: rootURL,
      includingPropertiesForKeys: nil
    ) else {
      return nil
    }

    for case let url as URL in enumerator {
      if extensions.contains(url.pathExtension.lowercased()) {
        return url
      }
    }
    return nil
  }

  private func logDirectorySnapshot(near url: URL) {
    let roots = [
      url.deletingLastPathComponent(),
      url.deletingLastPathComponent().deletingLastPathComponent(),
      url.deletingLastPathComponent().deletingLastPathComponent().deletingLastPathComponent(),
    ]

    for root in roots {
      guard
        let contents = try? FileManager.default.contentsOfDirectory(
          at: root,
          includingPropertiesForKeys: [.isDirectoryKey],
          options: []
        )
      else { continue }

      let names = contents.prefix(30).map { child -> String in
        let isDirectory = (try? child.resourceValues(forKeys: [.isDirectoryKey]).isDirectory) ?? false
        return "\(child.lastPathComponent)\(isDirectory ? "/" : "")"
      }
      writeDebugLog("Directory \(root.lastPathComponent): \(names.joined(separator: ", "))")
    }
  }

  private func loadLivePhotoStillAndSearchMovie(provider: NSItemProvider) {
    let stillTypeIDs = [
      UTType.heic.identifier,
      UTType.jpeg.identifier,
      UTType.image.identifier,
    ]
    let typeID = stillTypeIDs.first { provider.hasItemConformingToTypeIdentifier($0) }
      ?? UTType.image.identifier

    writeDebugLog("Loading Live Photo still representation for movie search: \(typeID)")
    provider.loadFileRepresentation(forTypeIdentifier: typeID) { [weak self] url, error in
      guard let self else { return }

      guard let url else {
        self.writeDebugLog("Live Photo still file representation failed: \(error?.localizedDescription ?? "nil")")
        self.loadSharedImage(provider: provider, imageTypeIDs: [UTType.image.identifier])
        return
      }

      let scoped = url.startAccessingSecurityScopedResource()
      self.writeDebugLog("Live Photo still URL: \(url.path)")
      self.logDirectorySnapshot(near: url)

      let searchRoots = [
        url.deletingLastPathComponent(),
        url.deletingLastPathComponent().deletingLastPathComponent(),
        url.deletingLastPathComponent().deletingLastPathComponent().deletingLastPathComponent(),
      ]
      let videoURL = searchRoots.lazy.compactMap {
        Self.firstFile(in: $0, extensions: ["mov", "mp4"])
      }.first

      if let videoURL, let gifData = Self.createGifFromVideo(at: videoURL) {
        if scoped {
          url.stopAccessingSecurityScopedResource()
        }
        self.writeDebugLog("Found sibling movie and converted to GIF: \(videoURL.lastPathComponent), \(gifData.count) bytes.")
        self.writeSharedImageData(gifData, extension: "gif")
        return
      }

      let imageData = try? Data(contentsOf: url)
      if scoped {
        url.stopAccessingSecurityScopedResource()
      }

      guard let imageData else {
        self.writeDebugLog("Live Photo still data was nil after movie search.")
        self.loadSharedImage(provider: provider, imageTypeIDs: [UTType.image.identifier])
        return
      }

      let uploadImage = Self.preparedStillImageForUpload(
        imageData,
        typeIdentifier: typeID,
        sourceExtension: url.pathExtension
      )
      self.writeDebugLog(
        "No sibling movie found; using still image as \(uploadImage.ext): \(uploadImage.data.count) bytes."
      )
      self.writeSharedImageData(uploadImage.data, extension: uploadImage.ext, livePhotoStaticFallback: true)
    }
  }

  private func loadSharedLivePhoto(provider: NSItemProvider) {
    guard let identifier = Self.livePhotoBundleIdentifier(for: provider) else {
      writeDebugLog("Live Photo provider had no live photo identifier; falling back to image.")
      loadSharedImage(provider: provider, imageTypeIDs: [UTType.image.identifier])
      return
    }

    writeDebugLog("Loading live photo representation: \(identifier)")
    provider.loadInPlaceFileRepresentation(forTypeIdentifier: identifier) { [weak self] inPlaceURL, inPlace, inPlaceError in
      guard let self else { return }
      self.writeDebugLog(
        "Live Photo in-place representation URL: \(inPlaceURL?.path ?? "nil"), inPlace: \(inPlace), error: \(inPlaceError?.localizedDescription ?? "nil")"
      )

      if let inPlaceURL {
        self.handleLivePhotoContainerURL(inPlaceURL, provider: provider)
        return
      }

      provider.loadItem(forTypeIdentifier: identifier) { [weak self] item, itemError in
        guard let self else { return }
        self.writeDebugLog(
          "Live Photo loadItem payload: \(String(describing: item)), type: \(item.map { String(describing: Swift.type(of: $0)) } ?? "nil"), error: \(itemError?.localizedDescription ?? "nil")"
        )

        if let url = item as? URL {
          self.handleLivePhotoContainerURL(url, provider: provider)
          return
        }

        self.loadLivePhotoFileRepresentation(provider: provider, identifier: identifier)
      }
    }
  }

  private func loadLivePhotoFileRepresentation(provider: NSItemProvider, identifier: String) {
    provider.loadFileRepresentation(forTypeIdentifier: identifier) { [weak self] url, _ in
      guard let self else { return }

      guard let url else {
        self.writeDebugLog("Live Photo file representation returned nil URL; falling back to image.")
        self.loadLivePhotoStillAndSearchMovie(provider: provider)
        return
      }

      self.handleLivePhotoContainerURL(url, provider: provider)
    }
  }

  private func handleLivePhotoContainerURL(_ url: URL, provider: NSItemProvider) {
    let scoped = url.startAccessingSecurityScopedResource()
    writeDebugLog("Live Photo representation URL: \(url.path), isDirectory: \((try? url.resourceValues(forKeys: [.isDirectoryKey]).isDirectory) ?? false)")
    let videoURL = Self.firstFile(in: url, extensions: ["mov", "mp4"])
    let stillURL = Self.firstFile(in: url, extensions: ["heic", "heif", "jpg", "jpeg", "png"])
    writeDebugLog("Live Photo bundle video: \(videoURL?.lastPathComponent ?? "nil"), still: \(stillURL?.lastPathComponent ?? "nil")")

    if let videoURL, let gifData = Self.createGifFromVideo(at: videoURL) {
      if scoped {
        url.stopAccessingSecurityScopedResource()
      }
      writeDebugLog("Live Photo converted to GIF: \(gifData.count) bytes.")
      writeSharedImageData(gifData, extension: "gif")
      return
    }

    if let stillURL, let imageData = try? Data(contentsOf: stillURL) {
      if scoped {
        url.stopAccessingSecurityScopedResource()
      }
      let uploadImage = Self.preparedStillImageForUpload(
        imageData,
        typeIdentifier: UTType(filenameExtension: stillURL.pathExtension)?.identifier ?? UTType.image.identifier,
        sourceExtension: stillURL.pathExtension
      )
      writeDebugLog(
        "Live Photo GIF conversion failed; using still image as \(uploadImage.ext): \(uploadImage.data.count) bytes."
      )
      writeSharedImageData(uploadImage.data, extension: uploadImage.ext, livePhotoStaticFallback: true)
      return
    }

    if scoped {
      url.stopAccessingSecurityScopedResource()
    }
    writeDebugLog("Live Photo bundle had no usable video or still; falling back to image provider.")
    loadLivePhotoStillAndSearchMovie(provider: provider)
  }

  private func loadSharedMovieAsGif(provider: NSItemProvider) {
    provider.loadFileRepresentation(forTypeIdentifier: UTType.movie.identifier) { [weak self] url, _ in
      guard let self else { return }

      guard let url else {
        self.writeDebugLog("Movie file representation returned nil URL.")
        self.complete(success: false)
        return
      }

      self.writeDebugLog("Movie representation URL: \(url.path)")
      let scoped = url.startAccessingSecurityScopedResource()
      let gifData = Self.createGifFromVideo(at: url)
      if scoped {
        url.stopAccessingSecurityScopedResource()
      }

      guard let gifData else {
        self.writeDebugLog("Movie GIF conversion failed.")
        self.complete(success: false)
        return
      }

      self.writeDebugLog("Movie converted to GIF: \(gifData.count) bytes.")
      self.writeSharedImageData(gifData, extension: "gif")
    }
  }

  // MARK: - GIF conversion

  private static func createGifFromVideo(at videoURL: URL, maxDimension: CGFloat? = nil) -> Data? {
    let maxDim = maxDimension ?? maxGifDimension
    let asset = AVURLAsset(url: videoURL)
    let generator = AVAssetImageGenerator(asset: asset)
    generator.appliesPreferredTrackTransform = true
    generator.requestedTimeToleranceBefore = .zero
    generator.requestedTimeToleranceAfter = .zero
    generator.maximumSize = CGSize(width: maxDim, height: maxDim)

    let durationSeconds = CMTimeGetSeconds(asset.duration)
    guard durationSeconds > 0 else { return nil }

    // Read native frame rate from the video track
    var nativeFPS = defaultGifFPS
    if let track = asset.tracks(withMediaType: .video).first, track.nominalFrameRate > 0 {
      nativeFPS = track.nominalFrameRate
    }
    let gifFPS = min(nativeFPS, maxGifFPS)

    var frameCount = Int(durationSeconds * Double(gifFPS))
    if frameCount < 1 { frameCount = 1 }
    if frameCount > maxGifFrames { frameCount = maxGifFrames }
    let frameInterval = durationSeconds / Double(frameCount)
    let frameDelay = frameInterval

    let gifData = NSMutableData()
    guard let dest = CGImageDestinationCreateWithData(
      gifData as CFMutableData,
      "com.compuserve.gif" as CFString,
      frameCount,
      nil
    ) else { return nil }

    // Infinite loop
    let gifProps: [String: Any] = [
      kCGImagePropertyGIFDictionary as String: [
        kCGImagePropertyGIFLoopCount as String: 0,
      ],
    ]
    CGImageDestinationSetProperties(dest, gifProps as CFDictionary)

    let frameProps: [String: Any] = [
      kCGImagePropertyGIFDictionary as String: [
        kCGImagePropertyGIFDelayTime as String: frameDelay,
      ],
    ]

    var addedFrames = 0
    for i in 0..<frameCount {
      let time = CMTimeMakeWithSeconds(Double(i) * frameInterval, preferredTimescale: 600)
      if let image = try? generator.copyCGImage(at: time, actualTime: nil) {
        CGImageDestinationAddImage(dest, image, frameProps as CFDictionary)
        addedFrames += 1
      }
    }

    guard addedFrames > 0 else { return nil }
    guard CGImageDestinationFinalize(dest) else { return nil }

    let normalizedData = normalizedGifData(gifData as Data)
    if normalizedData.count > maxPhotoFileSize && maxDim > 160 {
      let scale = sqrt(Double(maxPhotoFileSize) / Double(normalizedData.count)) * 0.9
      let newDimension = max(CGFloat(Int(maxDim * CGFloat(scale))), 160)
      if let retry = createGifFromVideo(at: videoURL, maxDimension: newDimension) {
        return retry
      }
    }
    return normalizedData
  }

  // MARK: - Image handling

  private static func preparedStillImageForUpload(
    _ data: Data,
    typeIdentifier: String,
    sourceExtension: String?
  ) -> (data: Data, ext: String) {
    let ext = sourceExtension?.lowercased()
    if typeIdentifier == UTType.gif.identifier || ext == "gif" {
      return (data, "gif")
    }
    guard
      let image = UIImage(data: data),
      let jpegData = Self.jpegDataForUpload(image)
    else {
      return (data, "jpg")
    }
    return (jpegData, "jpg")
  }

  private static func jpegDataForUpload(_ image: UIImage) -> Data? {
    let sourceSize = image.size
    var maxDim = maxStillImageDimension
    var result: Data?

    for _ in 0..<3 {
      let longestSide = max(sourceSize.width, sourceSize.height)
      let dimScale = longestSide > maxDim ? maxDim / longestSide : 1
      let targetSize = CGSize(
        width: max(1, sourceSize.width * dimScale),
        height: max(1, sourceSize.height * dimScale)
      )
      let format = UIGraphicsImageRendererFormat.default()
      format.scale = 1
      let renderer = UIGraphicsImageRenderer(size: targetSize, format: format)
      let resized = renderer.image { _ in
        image.draw(in: CGRect(origin: .zero, size: targetSize))
      }
      result = resized.jpegData(compressionQuality: stillImageCompressionQuality)
      guard let jpegData = result, jpegData.count > maxPhotoFileSize else { break }
      let sizeRatio = sqrt(Double(maxPhotoFileSize) / Double(jpegData.count)) * 0.9
      maxDim = max(maxDim * CGFloat(sizeRatio), 320)
    }

    return result
  }

  private func loadSharedImage(provider: NSItemProvider, imageTypeIDs: [String]) {
    let typeID = imageTypeIDs.first { provider.hasItemConformingToTypeIdentifier($0) }
      ?? UTType.image.identifier

    markInternalStatusCardShareIfNeeded(fileName: provider.suggestedName)
    writeDebugLog("Loading image representation: \(typeID)")
    provider.loadItem(forTypeIdentifier: typeID) { [weak self] data, _ in
      guard let self else { return }

      var imageData: Data?
      var sourceExtension: String?
      if let url = data as? URL {
        self.markInternalStatusCardShareIfNeeded(fileName: url.lastPathComponent)
        self.writeDebugLog("Image representation URL: \(url.path)")
        imageData = try? Data(contentsOf: url)
        sourceExtension = url.pathExtension
      } else if let img = data as? UIImage {
        self.writeDebugLog("Image representation UIImage.")
        imageData = img.jpegData(compressionQuality: 0.9)
        sourceExtension = "jpg"
      } else if let raw = data as? Data {
        self.writeDebugLog("Image representation Data: \(raw.count) bytes.")
        imageData = raw
      } else {
        self.writeDebugLog("Image representation unexpected payload: \(String(describing: data))")
      }

      guard let imageData else {
        self.writeDebugLog("Image data is nil.")
        self.complete(success: false)
        return
      }

      let uploadImage = Self.preparedStillImageForUpload(
        imageData,
        typeIdentifier: typeID,
        sourceExtension: sourceExtension
      )
      self.writeDebugLog("Writing still image as \(uploadImage.ext): \(uploadImage.data.count) bytes.")
      self.writeSharedImageData(uploadImage.data, extension: uploadImage.ext)
    }
  }

  private func writeSharedImageData(
    _ data: Data,
    extension ext: String,
    livePhotoStaticFallback: Bool = false
  ) {
    guard let container = FileManager.default.containerURL(
      forSecurityApplicationGroupIdentifier: appGroupID)
    else {
      complete(success: false)
      return
    }

    let timestamp = Int(Date().timeIntervalSince1970 * 1000)
    let dest = container.appendingPathComponent("share-image-\(timestamp).\(ext)")
    do {
      try data.write(to: dest, options: .atomic)
      if livePhotoStaticFallback {
        let marker = container.appendingPathComponent("share-image-\(timestamp).livephoto-fallback")
        try? "1".write(to: marker, atomically: true, encoding: .utf8)
      }
      writeDebugLog(
        "Wrote share-image-\(timestamp).\(ext): \(data.count) bytes, magic: \(Self.dataPrefixHex(data))."
      )
      finishAfterWritingSharedContent()
    } catch {
      writeDebugLog("Failed to write shared image: \(error.localizedDescription)")
      complete(success: false)
    }
  }

  // MARK: - Text / URL handling

  private func loadSharedURL(provider: NSItemProvider) {
    provider.loadItem(forTypeIdentifier: UTType.url.identifier) { [weak self] data, _ in
      guard let self else { return }

      var urlString: String?
      if let url = data as? URL {
        urlString = url.absoluteString
      }

      guard let text = urlString, !text.isEmpty else {
        self.complete(success: false)
        return
      }

      self.writeSharedText(text)
    }
  }

  private func loadSharedText(provider: NSItemProvider) {
    provider.loadItem(forTypeIdentifier: UTType.plainText.identifier) { [weak self] data, _ in
      guard let self else { return }

      var text: String?
      if let str = data as? String {
        text = str
      } else if let d = data as? Data {
        text = String(data: d, encoding: .utf8)
      }

      guard let text, !text.isEmpty else {
        self.complete(success: false)
        return
      }

      self.writeSharedText(text)
    }
  }

  private func writeSharedText(_ text: String) {
    guard let container = FileManager.default.containerURL(
      forSecurityApplicationGroupIdentifier: appGroupID)
    else {
      complete(success: false)
      return
    }

    let timestamp = Int(Date().timeIntervalSince1970 * 1000)
    let dest = container.appendingPathComponent("share-text-\(timestamp).txt")
    do {
      try text.write(to: dest, atomically: true, encoding: .utf8)
      finishAfterWritingSharedContent()
    } catch {
      complete(success: false)
    }
  }

  // MARK: - App launch

  private func openMainAppAndComplete() {
    guard let url = URL(string: appURLScheme) else {
      complete(success: true)
      return
    }
    // Walk the responder chain to reach UIApplication; works in share extensions on iOS 14+.
    var responder: UIResponder? = self
    while let r = responder {
      if let app = r as? UIApplication {
        app.open(url, options: [:]) { [weak self] _ in
          self?.complete(success: true)
        }
        return
      }
      responder = r.next
    }
    // Fallback: extensionContext open (iOS 16+)
    extensionContext?.open(url) { [weak self] _ in
      self?.complete(success: true)
    }
  }

  private func complete(success: Bool) {
    if success {
      extensionContext?.completeRequest(returningItems: [], completionHandler: nil)
    } else {
      extensionContext?.cancelRequest(withError: NSError(
        domain: "YifanShare", code: 0,
        userInfo: [NSLocalizedDescriptionKey: "Failed to load shared content"]))
    }
  }
}
