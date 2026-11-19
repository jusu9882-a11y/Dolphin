package com.dolphin.app

import android.Manifest
import android.app.Activity
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Bundle
import android.webkit.PermissionRequest
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
    private var pendingWebPermission: PermissionRequest? = null
    private var pendingWebResources: Array<String> = emptyArray()
    private var pendingAndroidPermissions: Array<String> = emptyArray()
    private var lastCameraPermissionGranted: Boolean? = null
    private var lastMicrophonePermissionGranted: Boolean? = null

    companion object { private const val DEVICE_PERMISSION_REQUEST = 701 }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        webView = WebView(this)
        setContentView(webView)

        val devUrl = intent.getStringExtra("wittleDevUrl")
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
        webView.webChromeClient = object : WebChromeClient() {
            override fun onPermissionRequest(request: PermissionRequest) {
                runOnUiThread { handleWebPermissionRequest(request) }
            }
            override fun onPermissionRequestCanceled(request: PermissionRequest) {
                if (pendingWebPermission === request) clearPendingPermission(deny = false)
            }
        }
        webView.webViewClient = object : WebViewClient() {
            override fun shouldInterceptRequest(view: WebView, request: WebResourceRequest) =
                assetLoader.shouldInterceptRequest(request.url)
            override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean =
                !isTrustedUrl(request.url)
        }

        bridge = WebAppInterface(this, webView)
        val allowedOrigins = mutableSetOf("https://appassets.androidplatform.net")
        if (BuildConfig.DEBUG && devOrigin != null) allowedOrigins.add(devOrigin!!)
        WebViewCompat.addWebMessageListener(webView, "WittleNative", allowedOrigins) { _, message, sourceOrigin, isMainFrame, _ ->
            if (!isMainFrame || !isTrustedOrigin(sourceOrigin)) return@addWebMessageListener
            val payload = message.data ?: return@addWebMessageListener
            bridge.handleMessage(payload)
        }

        val startUrl = if (BuildConfig.DEBUG && devOrigin != null) devUrl!! else
            "https://appassets.androidplatform.net/assets/www/index.html"
        webView.loadUrl(startUrl)
    }

    private fun handleWebPermissionRequest(request: PermissionRequest) {
        if (!isTrustedOrigin(request.origin) || pendingWebPermission != null) {
            request.deny()
            return
        }
        val resources = request.resources.distinct()
        if (resources.isEmpty() || resources.any {
                it != PermissionRequest.RESOURCE_VIDEO_CAPTURE &&
                it != PermissionRequest.RESOURCE_AUDIO_CAPTURE
            }) {
            request.deny()
            return
        }
        val androidPermissions = mutableListOf<String>()
        if (PermissionRequest.RESOURCE_VIDEO_CAPTURE in resources) androidPermissions.add(Manifest.permission.CAMERA)
        if (PermissionRequest.RESOURCE_AUDIO_CAPTURE in resources) androidPermissions.add(Manifest.permission.RECORD_AUDIO)

        val declared = packageManager.getPackageInfo(packageName, PackageManager.GET_PERMISSIONS)
            .requestedPermissions?.toSet() ?: emptySet()
        if (androidPermissions.any { it !in declared }) {
            request.deny()
            return
        }

        pendingWebPermission = request
        pendingWebResources = resources.toTypedArray()
        pendingAndroidPermissions = androidPermissions.toTypedArray()
        // Use Android's real runtime permission prompt directly.
        val missing = pendingAndroidPermissions.filter {
            checkSelfPermission(it) != PackageManager.PERMISSION_GRANTED
        }
        if (missing.isEmpty()) {
            grantPendingPermission()
        } else {
            requestPermissions(missing.toTypedArray(), DEVICE_PERMISSION_REQUEST)
        }
    }

    override fun onRequestPermissionsResult(
        requestCode: Int, permissions: Array<out String>, grantResults: IntArray
    ) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        if (requestCode != DEVICE_PERMISSION_REQUEST) return
        val allGranted = pendingAndroidPermissions.all {
            checkSelfPermission(it) == PackageManager.PERMISSION_GRANTED
        }
        if (allGranted) grantPendingPermission() else clearPendingPermission(deny = true)
    }

    private fun grantPendingPermission() {
        val request = pendingWebPermission ?: return
        val resources = pendingWebResources
        clearPendingPermission(deny = false)
        request.grant(resources)
    }

    private fun clearPendingPermission(deny: Boolean) {
        val request = pendingWebPermission
        pendingWebPermission = null
        pendingWebResources = emptyArray()
        pendingAndroidPermissions = emptyArray()
        if (deny) runCatching { request?.deny() }
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

    override fun onResume() {
        super.onResume()
        if (!::webView.isInitialized) return

        val cameraGranted = checkSelfPermission(Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED
        val microphoneGranted = checkSelfPermission(Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED
        val permissionWasRevoked =
            (lastCameraPermissionGranted == true && !cameraGranted) ||
            (lastMicrophonePermissionGranted == true && !microphoneGranted)

        lastCameraPermissionGranted = cameraGranted
        lastMicrophonePermissionGranted = microphoneGranted

        if (permissionWasRevoked) {
            // Reloading the trusted document tears down its active getUserMedia tracks.
            // Any subsequent capture request must pass through the disclosure and OS checks again.
            clearPendingPermission(deny = true)
            webView.stopLoading()
            webView.reload()
        }
    }

    override fun onPause() {
        if (::bridge.isInitialized) bridge.pauseSensors()
        super.onPause()
    }

    override fun onDestroy() {
        clearPendingPermission(deny = true)
        if (::bridge.isInitialized) bridge.close()
        if (::webView.isInitialized) webView.destroy()
        super.onDestroy()
    }
}
