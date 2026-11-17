package com.dolphin.app

import android.app.Activity
import android.net.Uri
import android.os.Bundle
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.webkit.WebViewAssetLoader
import androidx.webkit.WebViewAssetLoader.AssetsPathHandler
import androidx.webkit.WebViewCompat

class MainActivity : Activity() {
    private lateinit var webView: WebView
    private lateinit var bridge: WebAppInterface
    private var devOrigin: String? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        webView = WebView(this)
        setContentView(webView)

        val devUrl = intent.getStringExtra("dolphinDevUrl")
        devOrigin = devUrl?.takeIf { BuildConfig.DEBUG && isAllowedDevUrl(it) }?.let {
            Uri.parse(it).let { uri -> "${uri.scheme}://${uri.host}:${uri.port}" }
        }
        val assetLoader = WebViewAssetLoader.Builder()
            .addPathHandler("/assets/", AssetsPathHandler(this))
            .build()

        webView.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            allowFileAccess = false
            allowContentAccess = false
            mixedContentMode = android.webkit.WebSettings.MIXED_CONTENT_NEVER_ALLOW
            setSupportMultipleWindows(false)
            javaScriptCanOpenWindowsAutomatically = false
        }
        webView.webChromeClient = WebChromeClient()
        webView.webViewClient = object : WebViewClient() {
            override fun shouldInterceptRequest(view: WebView, request: WebResourceRequest) =
                assetLoader.shouldInterceptRequest(request.url)
            override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean =
                !isTrustedUrl(request.url)
        }

        bridge = WebAppInterface(this, webView)
        val allowedOrigins = mutableSetOf("https://appassets.androidplatform.net")
        if (BuildConfig.DEBUG && devOrigin != null) allowedOrigins.add(devOrigin!!)
        WebViewCompat.addWebMessageListener(webView, "DolphinNative", allowedOrigins) { _, message, sourceOrigin, isMainFrame, _ ->
            if (!isMainFrame || !isTrustedOrigin(sourceOrigin)) return@addWebMessageListener
            val payload = message.data ?: return@addWebMessageListener
            bridge.handleMessage(payload)
        }

        val startUrl = if (BuildConfig.DEBUG && devOrigin != null) devUrl!! else
            "https://appassets.androidplatform.net/assets/www/index.html"
        webView.loadUrl(startUrl)
    }

    private fun isAllowedDevUrl(value: String): Boolean {
        val uri = runCatching { Uri.parse(value) }.getOrNull() ?: return false
        return uri.scheme == "http" && uri.host == "127.0.0.1" &&
            uri.port in 1..65535 && uri.userInfo == null && uri.query == null && uri.fragment == null
    }
    private fun isTrustedOrigin(uri: Uri): Boolean {
        if (uri.scheme == "https" && uri.host == "appassets.androidplatform.net") return true
        return BuildConfig.DEBUG && devOrigin != null &&
            uri.scheme == "http" && uri.host == "127.0.0.1" && uri.port == Uri.parse(devOrigin).port
    }
    private fun isTrustedUrl(uri: Uri): Boolean =
        isTrustedOrigin(uri) &&
            (uri.host != "appassets.androidplatform.net" || uri.path?.startsWith("/assets/") == true)

    override fun onDestroy() {
        if (::bridge.isInitialized) bridge.close()
        webView.destroy()
        super.onDestroy()
    }
}
