import Foundation
import Capacitor
import WebKit

@objc(DisableWebViewBouncePlugin)
public class DisableWebViewBouncePlugin: CAPPlugin {
    
    @objc override public func load() {
        // Disable bounce/scroll on the main WKWebView
        if let webView = self.bridge?.webView {
            webView.scrollView.bounces = false
            webView.scrollView.isScrollEnabled = false
            webView.scrollView.alwaysBounceVertical = false
            webView.scrollView.alwaysBounceHorizontal = false
            
            // Prevent zoom
            let source = """
            var meta = document.createElement('meta');
            meta.name = 'viewport';
            meta.content = 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no';
            var head = document.getElementsByTagName('head')[0];
            head.appendChild(meta);
            """
            let script = WKUserScript(source: source, injectionTime: .atDocumentEnd, forMainFrameOnly: true)
            webView.configuration.userContentController.addUserScript(script)
        }
    }
}
