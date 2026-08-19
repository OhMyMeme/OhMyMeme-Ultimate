package cn.lorien.ohmymeme

import android.os.Bundle
import android.view.ViewGroup
import android.webkit.WebView
import androidx.activity.enableEdgeToEdge
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat

class MainActivity : TauriActivity() {
  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    enableEdgeToEdge()
  }

  override fun onWebViewCreate(webView: WebView) {
    super.onWebViewCreate(webView)
    webView.settings.useWideViewPort = true
    webView.settings.loadWithOverviewMode = true
    ViewCompat.setOnApplyWindowInsetsListener(window.decorView) { _, insets ->
      val safeArea = insets.getInsets(
        WindowInsetsCompat.Type.systemBars() or WindowInsetsCompat.Type.displayCutout()
      )
      val layoutParams = webView.layoutParams
      if (layoutParams is ViewGroup.MarginLayoutParams) {
        layoutParams.setMargins(safeArea.left, safeArea.top, safeArea.right, safeArea.bottom)
        webView.layoutParams = layoutParams
      } else {
        webView.setPadding(safeArea.left, safeArea.top, safeArea.right, safeArea.bottom)
      }
      insets
    }
    webView.post { ViewCompat.requestApplyInsets(window.decorView) }
  }
}
