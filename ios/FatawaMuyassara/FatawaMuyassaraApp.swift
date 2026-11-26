// الفتاوى الميسّرة — تطبيق الآيفون والآيباد
// جمعه وأعده: عبد الحسيب منيب
import SwiftUI
import WebKit
import AVFoundation

@main
struct FatawaMuyassaraApp: App {
    init() {
        // التلاوة تعمل حتى مع وضع الصامت في الجهاز
        try? AVAudioSession.sharedInstance().setCategory(.playback, mode: .spokenAudio, options: [])
    }
    var body: some Scene {
        WindowGroup {
            GuideView()
                .ignoresSafeArea()
                .background(Color(red: 0.961, green: 0.953, blue: 0.925))
        }
    }
}

struct GuideView: UIViewRepresentable {
    func makeCoordinator() -> Coordinator { Coordinator() }

    func makeUIView(context: Context) -> WKWebView {
        let config = WKWebViewConfiguration()
        config.allowsInlineMediaPlayback = true
        let web = WKWebView(frame: .zero, configuration: config)
        web.navigationDelegate = context.coordinator
        web.scrollView.contentInsetAdjustmentBehavior = .never
        web.isOpaque = false
        web.backgroundColor = .clear
        if let www = Bundle.main.url(forResource: "www", withExtension: nil) {
            web.loadFileURL(www.appendingPathComponent("index.html"), allowingReadAccessTo: www)
        }
        return web
    }

    func updateUIView(_ uiView: WKWebView, context: Context) {}

    final class Coordinator: NSObject, WKNavigationDelegate {
        // الروابط الخارجية تُفتح في المتصفح
        func webView(_ webView: WKWebView, decidePolicyFor action: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
            if let u = action.request.url, let s = u.scheme, s.hasPrefix("http") {
                UIApplication.shared.open(u); decisionHandler(.cancel); return
            }
            decisionHandler(.allow)
        }
    }
}
